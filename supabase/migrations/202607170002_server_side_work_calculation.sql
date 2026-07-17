begin;

create extension if not exists btree_gist with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employee_weekly_contracts_no_overlap'
      and conrelid = '"Gestion_Fichajes".employee_weekly_contracts'::regclass
  ) then
    alter table "Gestion_Fichajes".employee_weekly_contracts
      add constraint employee_weekly_contracts_no_overlap
      exclude using gist (
        employee_id with =,
        daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
      );
  end if;
end $$;

alter table "Gestion_Fichajes".employee_weekly_contracts
  drop constraint if exists employee_weekly_contracts_dates_valid;
alter table "Gestion_Fichajes".employee_weekly_contracts
  add constraint employee_weekly_contracts_dates_valid
  check (effective_to is null or effective_to >= effective_from);

alter table "Gestion_Fichajes".employee_weekly_contracts
  drop constraint if exists employee_weekly_contracts_minutes_valid;
alter table "Gestion_Fichajes".employee_weekly_contracts
  add constraint employee_weekly_contracts_minutes_valid
  check (weekly_minutes between 1 and 10080);

alter table "Gestion_Fichajes".calendar_day_type_settings
  drop constraint if exists calendar_day_type_settings_values_valid;
alter table "Gestion_Fichajes".calendar_day_type_settings
  add constraint calendar_day_type_settings_values_valid
  check (
    work_multiplier between 0 and 5
    and (special_target_minutes is null or special_target_minutes between 0 and 1440)
  );

create or replace function "Gestion_Fichajes".recalculate_employee_hours(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  employee_company_id uuid;
  day_record record;
  punch record;
  active_calendar "Gestion_Fichajes".labor_calendars;
  calendar_day "Gestion_Fichajes".calendar_days;
  day_setting "Gestion_Fichajes".calendar_day_type_settings;
  work_center uuid;
  last_entry_at timestamptz;
  break_started_at timestamptz;
  last_entry_type text;
  raw_minutes integer;
  break_minutes_value integer;
  rounded_minutes integer;
  multiplier numeric;
  weighted_minutes_value integer;
  complete_day boolean;
  incident_day boolean;
  week_record record;
  week_start_value date;
  week_end_value date;
  contracted_minutes integer;
  divisor integer;
  reference_minutes integer;
  reduction_minutes integer;
  special_adjustment integer;
  adjusted_target integer;
  actual_minutes integer;
  weighted_week_minutes integer;
  incomplete_week boolean;
  automatic_overtime integer;
  manual_adjustment integer;
  final_overtime integer;
  summary_id uuid;
  date_cursor date;
  setting_for_date "Gestion_Fichajes".calendar_day_type_settings;
  day_of_week integer;
  is_model_working_day boolean;
begin
  select e.company_id into employee_company_id
  from "Gestion_Fichajes".employees e
  where e.id = p_employee_id;

  if employee_company_id is null
    or (
      not "Gestion_Fichajes".can_access_company(employee_company_id)
      and coalesce(current_setting('app.secure_internal_recalc', true), '') <> 'on'
    ) then
    raise exception 'Operación no autorizada';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('work-summary:' || p_employee_id::text, 0));

  for day_record in
    select (t.registered_at at time zone 'Europe/Madrid')::date as work_date
    from "Gestion_Fichajes".time_entries t
    where t.employee_id = p_employee_id and t.status = 'active'
    group by 1
    order by 1
  loop
    select t.work_center_id into work_center
    from "Gestion_Fichajes".time_entries t
    where t.employee_id = p_employee_id
      and t.status = 'active'
      and (t.registered_at at time zone 'Europe/Madrid')::date = day_record.work_date
    order by t.registered_at, t.id
    limit 1;

    active_calendar := null;
    select c.* into active_calendar
    from "Gestion_Fichajes".labor_calendars c
    where c.company_id = employee_company_id
      and c.work_center_id = work_center
      and c.year = extract(year from day_record.work_date)::integer
      and c.status = 'active'
    limit 1;

    calendar_day := null;
    day_setting := null;
    if active_calendar.id is not null then
      select d.* into calendar_day
      from "Gestion_Fichajes".calendar_days d
      where d.calendar_id = active_calendar.id and d.date = day_record.work_date
      limit 1;
      if calendar_day.id is not null then
        select s.* into day_setting
        from "Gestion_Fichajes".calendar_day_type_settings s
        where s.id = calendar_day.day_type_setting_id and s.status = 'active'
        limit 1;
      end if;
    end if;

    day_of_week := extract(isodow from day_record.work_date)::integer;
    if day_setting.id is null then
      if day_of_week = 7
        or (day_of_week = 6 and coalesce(active_calendar.working_week_model, 'monday_to_friday') = 'monday_to_friday') then
        select s.* into day_setting
        from "Gestion_Fichajes".calendar_day_type_settings s
        where s.company_id = employee_company_id and s.classification = 'sunday' and s.status = 'active'
        order by s.is_system_type desc, s.created_at
        limit 1;
      else
        select s.* into day_setting
        from "Gestion_Fichajes".calendar_day_type_settings s
        where s.company_id = employee_company_id and s.classification = 'working_day' and s.status = 'active'
        order by s.is_system_type desc, s.created_at
        limit 1;
      end if;
    end if;

    raw_minutes := 0;
    break_minutes_value := 0;
    last_entry_at := null;
    break_started_at := null;
    last_entry_type := null;
    incident_day := false;

    for punch in
      select t.*
      from "Gestion_Fichajes".time_entries t
      where t.employee_id = p_employee_id
        and t.status = 'active'
        and (t.registered_at at time zone 'Europe/Madrid')::date = day_record.work_date
      order by t.registered_at, t.id
    loop
      last_entry_type := punch.entry_type;
      incident_day := incident_day or punch.has_incident;
      case punch.entry_type
        when 'entry' then
          last_entry_at := punch.registered_at;
        when 'break_start' then
          break_started_at := punch.registered_at;
          if last_entry_at is not null then
            raw_minutes := raw_minutes + greatest(0, round(extract(epoch from (punch.registered_at - last_entry_at)) / 60.0)::integer);
            last_entry_at := null;
          end if;
        when 'break_end' then
          if break_started_at is not null then
            break_minutes_value := break_minutes_value + greatest(0, round(extract(epoch from (punch.registered_at - break_started_at)) / 60.0)::integer);
            break_started_at := null;
          end if;
          last_entry_at := punch.registered_at;
        when 'exit' then
          if last_entry_at is not null then
            raw_minutes := raw_minutes + greatest(0, round(extract(epoch from (punch.registered_at - last_entry_at)) / 60.0)::integer);
            last_entry_at := null;
          end if;
      end case;
    end loop;

    complete_day := coalesce(last_entry_type, '') = 'exit';
    rounded_minutes := case when complete_day then floor(raw_minutes / 15.0)::integer * 15 else raw_minutes end;
    multiplier := coalesce(day_setting.work_multiplier, 1.0);
    weighted_minutes_value := round(rounded_minutes * multiplier)::integer;

    insert into "Gestion_Fichajes".daily_work_summaries (
      id, company_id, employee_id, work_center_id, work_date, calendar_id, calendar_day_id,
      raw_worked_minutes, break_minutes, rounded_worked_minutes, effective_multiplier,
      weighted_minutes, is_complete, has_incident, calculated_at, calculation_version
    ) values (
      gen_random_uuid(), employee_company_id, p_employee_id, work_center, day_record.work_date,
      active_calendar.id, calendar_day.id, raw_minutes, break_minutes_value, rounded_minutes,
      multiplier, weighted_minutes_value, complete_day, incident_day, now(), 2
    )
    on conflict (employee_id, work_date) do update set
      company_id = excluded.company_id,
      work_center_id = excluded.work_center_id,
      calendar_id = excluded.calendar_id,
      calendar_day_id = excluded.calendar_day_id,
      raw_worked_minutes = excluded.raw_worked_minutes,
      break_minutes = excluded.break_minutes,
      rounded_worked_minutes = excluded.rounded_worked_minutes,
      effective_multiplier = excluded.effective_multiplier,
      weighted_minutes = excluded.weighted_minutes,
      is_complete = excluded.is_complete,
      has_incident = excluded.has_incident,
      calculated_at = excluded.calculated_at,
      calculation_version = excluded.calculation_version;
  end loop;

  delete from "Gestion_Fichajes".daily_work_summaries d
  where d.employee_id = p_employee_id
    and not exists (
      select 1 from "Gestion_Fichajes".time_entries t
      where t.employee_id = p_employee_id and t.status = 'active'
        and (t.registered_at at time zone 'Europe/Madrid')::date = d.work_date
    );

  for week_record in
    select distinct date_trunc('week', d.work_date)::date as week_start
    from "Gestion_Fichajes".daily_work_summaries d
    where d.employee_id = p_employee_id
    order by 1
  loop
    week_start_value := week_record.week_start;
    week_end_value := week_start_value + 6;

    select c.weekly_minutes into contracted_minutes
    from "Gestion_Fichajes".employee_weekly_contracts c
    where c.employee_id = p_employee_id
      and c.effective_from <= week_start_value
      and (c.effective_to is null or c.effective_to >= week_start_value)
    order by c.effective_from desc
    limit 1;
    contracted_minutes := coalesce(contracted_minutes, 2400);

    active_calendar := null;
    select c.* into active_calendar
    from "Gestion_Fichajes".daily_work_summaries d
    join "Gestion_Fichajes".labor_calendars c on c.id = d.calendar_id
    where d.employee_id = p_employee_id
      and d.work_date between week_start_value and week_end_value
    order by d.work_date
    limit 1;

    divisor := case when active_calendar.working_week_model = 'monday_to_saturday' then 6 else 5 end;
    reference_minutes := round(contracted_minutes::numeric / divisor)::integer;
    reduction_minutes := 0;
    special_adjustment := 0;

    for date_cursor in
      select generate_series(week_start_value, week_end_value, interval '1 day')::date
    loop
      setting_for_date := null;
      if active_calendar.id is not null then
        select s.* into setting_for_date
        from "Gestion_Fichajes".calendar_days d
        join "Gestion_Fichajes".calendar_day_type_settings s on s.id = d.day_type_setting_id
        where d.calendar_id = active_calendar.id and d.date = date_cursor and s.status = 'active'
        limit 1;
      end if;
      day_of_week := extract(isodow from date_cursor)::integer;
      if setting_for_date.id is null and day_of_week = 7 then
        select s.* into setting_for_date
        from "Gestion_Fichajes".calendar_day_type_settings s
        where s.company_id = employee_company_id and s.classification = 'sunday' and s.status = 'active'
        order by s.is_system_type desc, s.created_at
        limit 1;
      end if;

      is_model_working_day := day_of_week between 1 and divisor;
      if setting_for_date.id is not null and is_model_working_day then
        if setting_for_date.reduces_weekly_target then
          reduction_minutes := reduction_minutes + reference_minutes;
        end if;
        if setting_for_date.special_target_minutes is not null then
          special_adjustment := special_adjustment + greatest(0, reference_minutes - setting_for_date.special_target_minutes);
        end if;
      end if;
    end loop;

    adjusted_target := greatest(0, contracted_minutes - reduction_minutes - special_adjustment);
    select
      coalesce(sum(d.rounded_worked_minutes), 0)::integer,
      coalesce(sum(d.weighted_minutes), 0)::integer,
      coalesce(bool_or(not d.is_complete), false)
    into actual_minutes, weighted_week_minutes, incomplete_week
    from "Gestion_Fichajes".daily_work_summaries d
    where d.employee_id = p_employee_id and d.work_date between week_start_value and week_end_value;

    automatic_overtime := greatest(0, weighted_week_minutes - adjusted_target);
    select w.id into summary_id
    from "Gestion_Fichajes".weekly_work_summaries w
    where w.employee_id = p_employee_id and w.week_start = week_start_value;
    summary_id := coalesce(summary_id, gen_random_uuid());

    select coalesce(sum(a.adjustment_minutes), 0)::integer into manual_adjustment
    from "Gestion_Fichajes".overtime_adjustments a
    where a.weekly_summary_id = summary_id and a.cancelled_at is null;
    final_overtime := greatest(0, automatic_overtime + manual_adjustment);

    insert into "Gestion_Fichajes".weekly_work_summaries (
      id, company_id, employee_id, week_start, week_end, contracted_weekly_minutes,
      working_days_divisor, reference_daily_minutes, target_reduction_minutes,
      special_target_adjustment_minutes, adjusted_target_minutes, actual_worked_minutes,
      weighted_worked_minutes, automatic_overtime_minutes, manual_adjustment_minutes,
      final_overtime_minutes, has_incomplete_days, calculated_at, calculation_version
    ) values (
      summary_id, employee_company_id, p_employee_id, week_start_value, week_end_value,
      contracted_minutes, divisor, reference_minutes, reduction_minutes, special_adjustment,
      adjusted_target, actual_minutes, weighted_week_minutes, automatic_overtime,
      manual_adjustment, final_overtime, incomplete_week, now(), 2
    )
    on conflict (employee_id, week_start) do update set
      company_id = excluded.company_id,
      week_end = excluded.week_end,
      contracted_weekly_minutes = excluded.contracted_weekly_minutes,
      working_days_divisor = excluded.working_days_divisor,
      reference_daily_minutes = excluded.reference_daily_minutes,
      target_reduction_minutes = excluded.target_reduction_minutes,
      special_target_adjustment_minutes = excluded.special_target_adjustment_minutes,
      adjusted_target_minutes = excluded.adjusted_target_minutes,
      actual_worked_minutes = excluded.actual_worked_minutes,
      weighted_worked_minutes = excluded.weighted_worked_minutes,
      automatic_overtime_minutes = excluded.automatic_overtime_minutes,
      manual_adjustment_minutes = excluded.manual_adjustment_minutes,
      final_overtime_minutes = excluded.final_overtime_minutes,
      has_incomplete_days = excluded.has_incomplete_days,
      calculated_at = excluded.calculated_at,
      calculation_version = excluded.calculation_version;
  end loop;

  delete from "Gestion_Fichajes".weekly_work_summaries w
  where w.employee_id = p_employee_id
    and not exists (
      select 1 from "Gestion_Fichajes".daily_work_summaries d
      where d.employee_id = p_employee_id and d.work_date between w.week_start and w.week_end
    )
    and not exists (
      select 1 from "Gestion_Fichajes".overtime_adjustments a
      where a.weekly_summary_id = w.id
    );

  return jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.work_date)
      from "Gestion_Fichajes".daily_work_summaries d where d.employee_id = p_employee_id
    ), '[]'::jsonb),
    'weekly', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.week_start)
      from "Gestion_Fichajes".weekly_work_summaries w where w.employee_id = p_employee_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function "Gestion_Fichajes".recalculate_after_time_entry_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  affected_employee_id uuid := coalesce(new.employee_id, old.employee_id);
begin
  perform set_config('app.secure_internal_recalc', 'on', true);
  perform "Gestion_Fichajes".recalculate_employee_hours(affected_employee_id);
  return null;
end;
$$;

drop trigger if exists recalculate_work_summaries_trigger on "Gestion_Fichajes".time_entries;
create trigger recalculate_work_summaries_trigger
after insert or update or delete on "Gestion_Fichajes".time_entries
for each row execute function "Gestion_Fichajes".recalculate_after_time_entry_change();

create or replace function "Gestion_Fichajes".recalculate_company_hours(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  employee_record record;
  employee_result jsonb;
  employee_count integer := 0;
begin
  if not "Gestion_Fichajes".can_access_company(p_company_id) then
    raise exception 'Operación no autorizada';
  end if;
  for employee_record in
    select e.id from "Gestion_Fichajes".employees e where e.company_id = p_company_id
  loop
    employee_result := "Gestion_Fichajes".recalculate_employee_hours(employee_record.id);
    employee_count := employee_count + 1;
  end loop;
  return jsonb_build_object('employees_recalculated', employee_count);
end;
$$;

create or replace function "Gestion_Fichajes".add_overtime_adjustment(
  p_weekly_summary_id uuid,
  p_employee_id uuid,
  p_adjustment_minutes integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  actor_profile "Gestion_Fichajes".profiles;
  employee_company_id uuid;
  created_adjustment "Gestion_Fichajes".overtime_adjustments;
begin
  select p.* into actor_profile from "Gestion_Fichajes".profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active' limit 1;
  select e.company_id into employee_company_id from "Gestion_Fichajes".employees e where e.id = p_employee_id;
  if actor_profile.id is null or not "Gestion_Fichajes".can_access_company(employee_company_id) then
    raise exception 'Operación no autorizada';
  end if;
  if abs(p_adjustment_minutes) > 10080 or length(trim(p_reason)) < 10 or length(trim(p_reason)) > 1000 then
    raise exception 'Ajuste o justificación no válidos';
  end if;
  if not exists (
    select 1 from "Gestion_Fichajes".weekly_work_summaries w
    where w.id = p_weekly_summary_id and w.employee_id = p_employee_id and w.company_id = employee_company_id
  ) then
    raise exception 'Resumen semanal no válido';
  end if;

  insert into "Gestion_Fichajes".overtime_adjustments(
    id, weekly_summary_id, employee_id, adjustment_minutes, reason, created_by, created_at
  ) values (
    gen_random_uuid(), p_weekly_summary_id, p_employee_id, p_adjustment_minutes,
    trim(p_reason), actor_profile.id, now()
  ) returning * into created_adjustment;

  perform "Gestion_Fichajes".recalculate_employee_hours(p_employee_id);
  return to_jsonb(created_adjustment);
end;
$$;

revoke all on function "Gestion_Fichajes".recalculate_employee_hours(uuid) from public;
revoke all on function "Gestion_Fichajes".recalculate_company_hours(uuid) from public;
revoke all on function "Gestion_Fichajes".add_overtime_adjustment(uuid, uuid, integer, text) from public;
grant execute on function "Gestion_Fichajes".recalculate_employee_hours(uuid) to authenticated;
grant execute on function "Gestion_Fichajes".recalculate_company_hours(uuid) to authenticated;
grant execute on function "Gestion_Fichajes".add_overtime_adjustment(uuid, uuid, integer, text) to authenticated;

revoke insert, update, delete, truncate on "Gestion_Fichajes".daily_work_summaries from anon, authenticated;
revoke insert, update, delete, truncate on "Gestion_Fichajes".weekly_work_summaries from anon, authenticated;
revoke insert, update, delete, truncate on "Gestion_Fichajes".overtime_adjustments from anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'labor_calendars', 'calendar_day_type_settings', 'calendar_days',
    'employee_weekly_contracts', 'daily_work_summaries',
    'weekly_work_summaries', 'overtime_adjustments'
  ]
  loop
    execute format('drop trigger if exists immutable_audit_trigger on %I.%I', 'Gestion_Fichajes', table_name);
    execute format(
      'create trigger immutable_audit_trigger after insert or update or delete on %I.%I for each row execute function %I.write_immutable_audit()',
      'Gestion_Fichajes', table_name, 'Gestion_Fichajes'
    );
  end loop;
end $$;

commit;
