begin;

create extension if not exists pgcrypto;

alter table "Gestion_Fichajes".employees
  add column if not exists pin_digest text;
alter table "Gestion_Fichajes".authorized_devices
  add column if not exists device_token_digest text,
  add column if not exists auth_failed_attempts integer not null default 0,
  add column if not exists auth_locked_until timestamptz;

alter table "Gestion_Fichajes".authorized_devices
  drop constraint if exists authorized_devices_device_token_key;
create unique index if not exists authorized_devices_device_token_digest_key
  on "Gestion_Fichajes".authorized_devices(device_token_digest)
  where device_token_digest is not null;

create table if not exists "Gestion_Fichajes".employee_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references "Gestion_Fichajes".employees(id) on delete cascade,
  device_id uuid not null references "Gestion_Fichajes".authorized_devices(id) on delete cascade,
  token_digest text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

revoke all on "Gestion_Fichajes".employee_sessions from anon, authenticated;

update "Gestion_Fichajes".employees
set pin_digest = extensions.crypt(pin_hash, extensions.gen_salt('bf', 12)),
    pin_hash = '***'
where pin_digest is null
  and pin_hash is not null
  and pin_hash <> '***';

update "Gestion_Fichajes".authorized_devices
set device_token_digest = encode(extensions.digest(device_token, 'sha256'), 'hex'),
    device_token = '***'
where device_token_digest is null
  and device_token is not null
  and device_token <> '***';

create or replace function "Gestion_Fichajes".protect_employee_pin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
begin
  if new.pin_hash is not null and new.pin_hash <> '***' then
    if new.pin_hash !~ '^[0-9]{4}$' then
      raise exception 'El PIN debe contener exactamente 4 dígitos';
    end if;
    new.pin_digest := extensions.crypt(new.pin_hash, extensions.gen_salt('bf', 12));
    new.pin_hash := '***';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_employee_pin_trigger on "Gestion_Fichajes".employees;
create trigger protect_employee_pin_trigger
before insert or update of pin_hash on "Gestion_Fichajes".employees
for each row execute function "Gestion_Fichajes".protect_employee_pin();

create or replace function "Gestion_Fichajes".protect_device_token()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
begin
  if new.device_token is not null and new.device_token <> '***' then
    new.device_token_digest := encode(extensions.digest(new.device_token, 'sha256'), 'hex');
    new.device_token := '***';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_device_token_trigger on "Gestion_Fichajes".authorized_devices;
create trigger protect_device_token_trigger
before insert or update of device_token on "Gestion_Fichajes".authorized_devices
for each row execute function "Gestion_Fichajes".protect_device_token();

create or replace function "Gestion_Fichajes".current_profile()
returns "Gestion_Fichajes".profiles
language sql
stable
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
  select p
  from "Gestion_Fichajes".profiles p
  where p.auth_user_id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

create or replace function "Gestion_Fichajes".is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
  select exists (
    select 1 from "Gestion_Fichajes".profiles p
    where p.auth_user_id = auth.uid() and p.status = 'active' and p.role = 'superadmin'
  )
$$;

create or replace function "Gestion_Fichajes".can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
  select exists (
    select 1
    from "Gestion_Fichajes".profiles p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
      and (p.role = 'superadmin' or (p.role = 'company_admin' and p.company_id = target_company_id))
  )
$$;

revoke all on function "Gestion_Fichajes".current_profile() from public;
revoke all on function "Gestion_Fichajes".is_superadmin() from public;
revoke all on function "Gestion_Fichajes".can_access_company(uuid) from public;
grant execute on function "Gestion_Fichajes".current_profile() to authenticated;
grant execute on function "Gestion_Fichajes".is_superadmin() to authenticated;
grant execute on function "Gestion_Fichajes".can_access_company(uuid) to authenticated;

do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'companies', 'work_centers', 'profiles', 'employees', 'authorized_devices',
    'time_entries', 'time_entry_incidents', 'correction_requests', 'audit_logs',
    'employee_work_centers', 'labor_calendars', 'calendar_day_type_settings',
    'calendar_days', 'calendar_import_runs', 'calendar_import_conflicts',
    'employee_weekly_contracts', 'daily_work_summaries', 'weekly_work_summaries',
    'overtime_adjustments', 'device_camera_tests', 'global_settings',
    'weekly_schedules', 'employee_sessions'
  ]
  loop
    if to_regclass(format('%I.%I', 'Gestion_Fichajes', table_name)) is not null then
      execute format('alter table %I.%I enable row level security', 'Gestion_Fichajes', table_name);
      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'Gestion_Fichajes' and tablename = table_name
      loop
        execute format(
          'drop policy if exists %I on %I.%I',
          policy_record.policyname, 'Gestion_Fichajes', table_name
        );
      end loop;
    end if;
  end loop;
end $$;

create policy secure_admin_access on "Gestion_Fichajes".companies
for all to authenticated
using ("Gestion_Fichajes".can_access_company(id))
with check ("Gestion_Fichajes".can_access_company(id));

create policy secure_admin_access on "Gestion_Fichajes".profiles
for all to authenticated
using (
  auth_user_id = auth.uid()
  or "Gestion_Fichajes".is_superadmin()
  or "Gestion_Fichajes".can_access_company(company_id)
)
with check (
  "Gestion_Fichajes".is_superadmin()
  or (
    "Gestion_Fichajes".can_access_company(company_id)
    and role = 'company_admin'
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'work_centers', 'employees', 'authorized_devices', 'time_entries',
    'time_entry_incidents', 'correction_requests', 'audit_logs',
    'labor_calendars', 'calendar_day_type_settings', 'daily_work_summaries',
    'weekly_work_summaries'
  ]
  loop
    if to_regclass(format('%I.%I', 'Gestion_Fichajes', table_name)) is not null then
      execute format(
        'create policy secure_admin_access on %I.%I for all to authenticated using ("Gestion_Fichajes".can_access_company(company_id)) with check ("Gestion_Fichajes".can_access_company(company_id))',
        'Gestion_Fichajes', table_name
      );
    end if;
  end loop;
end $$;

create policy secure_admin_access on "Gestion_Fichajes".employee_work_centers
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".calendar_days
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".labor_calendars c
  where c.id = calendar_id and "Gestion_Fichajes".can_access_company(c.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".labor_calendars c
  where c.id = calendar_id and "Gestion_Fichajes".can_access_company(c.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".calendar_import_runs
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".labor_calendars c
  where c.id = calendar_id and "Gestion_Fichajes".can_access_company(c.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".labor_calendars c
  where c.id = calendar_id and "Gestion_Fichajes".can_access_company(c.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".calendar_import_conflicts
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".labor_calendars c
  where c.id = calendar_id and "Gestion_Fichajes".can_access_company(c.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".labor_calendars c
  where c.id = calendar_id and "Gestion_Fichajes".can_access_company(c.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".employee_weekly_contracts
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".overtime_adjustments
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".device_camera_tests
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".authorized_devices d
  where d.id = device_id and "Gestion_Fichajes".can_access_company(d.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".authorized_devices d
  where d.id = device_id and "Gestion_Fichajes".can_access_company(d.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".weekly_schedules
for all to authenticated
using (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
))
with check (exists (
  select 1 from "Gestion_Fichajes".employees e
  where e.id = employee_id and "Gestion_Fichajes".can_access_company(e.company_id)
));

create policy secure_admin_access on "Gestion_Fichajes".global_settings
for all to authenticated
using ("Gestion_Fichajes".is_superadmin())
with check ("Gestion_Fichajes".is_superadmin());

revoke select on "Gestion_Fichajes".employees from anon, authenticated;
grant select (
  id, company_id, dni, full_name, employee_counter, employee_code, email, phone,
  job_title, department, hire_date, termination_date, status, created_at, updated_at
) on "Gestion_Fichajes".employees to authenticated;

revoke select on "Gestion_Fichajes".authorized_devices from anon, authenticated;
grant select (
  id, company_id, work_center_id, name, status, camera_validation_status,
  camera_validated_at, camera_validation_error, camera_validated_by,
  registered_at, last_used_at, created_at, updated_at
) on "Gestion_Fichajes".authorized_devices to authenticated;

create or replace function "Gestion_Fichajes".write_immutable_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_id uuid := coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  target_company uuid := coalesce((new_row->>'company_id')::uuid, (old_row->>'company_id')::uuid);
  actor_id uuid;
begin
  select p.id into actor_id from "Gestion_Fichajes".profiles p where p.auth_user_id = auth.uid() limit 1;
  insert into "Gestion_Fichajes".audit_logs(
    id, company_id, entity_type, entity_id, action, old_values, new_values, performed_by, performed_at
  ) values (
    gen_random_uuid(), target_company, tg_table_name, target_id, lower(tg_op),
    case when old_row is null then null else old_row - 'pin_hash' - 'pin_digest' - 'device_token' - 'device_token_digest' end,
    case when new_row is null then null else new_row - 'pin_hash' - 'pin_digest' - 'device_token' - 'device_token_digest' end,
    actor_id, now()
  );
  return null;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['employees', 'authorized_devices', 'time_entries', 'correction_requests']
  loop
    execute format('drop trigger if exists immutable_audit_trigger on %I.%I', 'Gestion_Fichajes', table_name);
    execute format(
      'create trigger immutable_audit_trigger after insert or update or delete on %I.%I for each row execute function %I.write_immutable_audit()',
      'Gestion_Fichajes', table_name, 'Gestion_Fichajes'
    );
  end loop;
end $$;

revoke insert, update, delete, truncate on "Gestion_Fichajes".audit_logs from anon, authenticated;

create or replace function "Gestion_Fichajes".list_device_registration_options()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
  select jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'commercial_name', c.commercial_name))
      from "Gestion_Fichajes".companies c where c.status = 'active'
    ), '[]'::jsonb),
    'work_centers', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'company_id', w.company_id, 'name', w.name))
      from "Gestion_Fichajes".work_centers w
      join "Gestion_Fichajes".companies c on c.id = w.company_id
      where w.status = 'active' and c.status = 'active'
    ), '[]'::jsonb)
  )
$$;

create or replace function "Gestion_Fichajes".request_device_registration(
  p_name text,
  p_company_id uuid,
  p_work_center_id uuid,
  p_camera_working boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  created_device "Gestion_Fichajes".authorized_devices;
begin
  if length(trim(p_name)) < 3 or length(trim(p_name)) > 100 then
    raise exception 'Nombre de terminal no válido';
  end if;
  if not exists (
    select 1
    from "Gestion_Fichajes".work_centers w
    join "Gestion_Fichajes".companies c on c.id = w.company_id
    where w.id = p_work_center_id and w.company_id = p_company_id
      and w.status = 'active' and c.status = 'active'
  ) then
    raise exception 'Empresa o centro no válido';
  end if;
  if exists (
    select 1
    from "Gestion_Fichajes".authorized_devices d
    where d.company_id = p_company_id
      and d.work_center_id = p_work_center_id
      and d.status = 'pending'
  ) then
    raise exception 'Ya existe una solicitud pendiente para este centro';
  end if;
  if (
    select count(*) from "Gestion_Fichajes".authorized_devices d
    where d.company_id = p_company_id and d.work_center_id = p_work_center_id
      and d.status = 'pending' and d.registered_at >= now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Demasiadas solicitudes pendientes para este centro';
  end if;

  insert into "Gestion_Fichajes".authorized_devices (
    id, company_id, work_center_id, name, device_token, device_token_digest,
    status, camera_validation_status, camera_validation_error,
    registered_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_company_id, p_work_center_id, trim(p_name), '***',
    encode(extensions.digest(raw_token, 'sha256'), 'hex'), 'pending',
    case when p_camera_working then 'pending' else 'failed' end,
    case when p_camera_working then null else 'Cámara no disponible durante el registro' end,
    now(), now(), now()
  ) returning * into created_device;

  return jsonb_build_object(
    'device_token', raw_token,
    'device', to_jsonb(created_device) - 'device_token_digest'
  );
end;
$$;

create or replace function "Gestion_Fichajes".validate_device(p_device_token text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
  select to_jsonb(d) - 'device_token_digest'
  from "Gestion_Fichajes".authorized_devices d
  join "Gestion_Fichajes".companies c on c.id = d.company_id and c.status = 'active'
  join "Gestion_Fichajes".work_centers w on w.id = d.work_center_id and w.status = 'active'
  where d.device_token_digest = encode(extensions.digest(p_device_token, 'sha256'), 'hex')
    and d.status in ('pending', 'active')
  limit 1
$$;

create or replace function "Gestion_Fichajes".authenticate_employee(
  p_device_token text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  target_device "Gestion_Fichajes".authorized_devices;
  target_employee "Gestion_Fichajes".employees;
  target_company "Gestion_Fichajes".companies;
  target_center "Gestion_Fichajes".work_centers;
  raw_session_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if p_pin !~ '^[0-9]{4}$' then
    perform pg_sleep(0.2);
    raise exception 'Credenciales incorrectas';
  end if;

  select d.* into target_device
  from "Gestion_Fichajes".authorized_devices d
  where d.device_token_digest = encode(extensions.digest(p_device_token, 'sha256'), 'hex')
    and d.status = 'active' and d.camera_validation_status = 'validated'
    and (d.auth_locked_until is null or d.auth_locked_until <= now())
  for update;
  if not found then
    raise exception 'Terminal no autorizado';
  end if;

  select e.* into target_employee
  from "Gestion_Fichajes".employees e
  join "Gestion_Fichajes".employee_work_centers ew on ew.employee_id = e.id
  where e.company_id = target_device.company_id
    and ew.work_center_id = target_device.work_center_id
    and e.status = 'active'
    and (e.locked_until is null or e.locked_until <= now())
    and e.pin_digest = extensions.crypt(p_pin, e.pin_digest)
  limit 1;
  if not found then
    update "Gestion_Fichajes".authorized_devices
    set auth_failed_attempts = auth_failed_attempts + 1,
        auth_locked_until = case when auth_failed_attempts + 1 >= 10 then now() + interval '15 minutes' else auth_locked_until end,
        updated_at = now()
    where id = target_device.id;
    perform pg_sleep(0.25);
    return jsonb_build_object('error', 'Credenciales incorrectas');
  end if;

  select * into target_company from "Gestion_Fichajes".companies
  where id = target_employee.company_id and status = 'active';
  select * into target_center from "Gestion_Fichajes".work_centers
  where id = target_device.work_center_id and status = 'active';
  if target_company.id is null or target_center.id is null then
    raise exception 'Empresa o centro bloqueado';
  end if;

  delete from "Gestion_Fichajes".employee_sessions
  where expires_at <= now() or (employee_id = target_employee.id and device_id = target_device.id);
  insert into "Gestion_Fichajes".employee_sessions(employee_id, device_id, token_digest, expires_at)
  values (target_employee.id, target_device.id, encode(extensions.digest(raw_session_token, 'sha256'), 'hex'), now() + interval '5 minutes');
  update "Gestion_Fichajes".authorized_devices
  set last_used_at = now(), auth_failed_attempts = 0, auth_locked_until = null, updated_at = now()
  where id = target_device.id;

  return jsonb_build_object(
    'employee_session_token', raw_session_token,
    'employee', to_jsonb(target_employee) - 'pin_hash' - 'pin_digest' - 'failed_pin_attempts' - 'locked_until',
    'company', to_jsonb(target_company),
    'work_center', to_jsonb(target_center),
    'time_entries', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.registered_at desc)
      from "Gestion_Fichajes".time_entries t
      where t.employee_id = target_employee.id and t.registered_at >= now() - interval '90 days'
    ), '[]'::jsonb),
    'correction_requests', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from "Gestion_Fichajes".correction_requests r
      where r.employee_id = target_employee.id and r.created_at >= now() - interval '1 year'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function "Gestion_Fichajes".register_time_entry(
  p_employee_session_token text,
  p_device_token text,
  p_entry_type text,
  p_photo_data text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_camera_error text default null,
  p_gps_error text default null,
  p_manual_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  active_session "Gestion_Fichajes".employee_sessions;
  target_device "Gestion_Fichajes".authorized_devices;
  previous_type text;
  created_entry "Gestion_Fichajes".time_entries;
  photo_state text;
  gps_state text;
  incident boolean;
begin
  if p_entry_type not in ('entry', 'break_start', 'break_end', 'exit') then
    raise exception 'Tipo de fichaje no válido';
  end if;
  if p_photo_data is not null and length(p_photo_data) > 2800000 then
    raise exception 'Fotografía demasiado grande';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'Latitud no válida';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'Longitud no válida';
  end if;

  select s.* into active_session
  from "Gestion_Fichajes".employee_sessions s
  where s.token_digest = encode(extensions.digest(p_employee_session_token, 'sha256'), 'hex')
    and s.expires_at > now()
  for update;
  if not found then raise exception 'Sesión de empleado caducada'; end if;

  select d.* into target_device
  from "Gestion_Fichajes".authorized_devices d
  where d.id = active_session.device_id
    and d.device_token_digest = encode(extensions.digest(p_device_token, 'sha256'), 'hex')
    and d.status = 'active' and d.camera_validation_status = 'validated'
  for update;
  if not found then raise exception 'Terminal no autorizado'; end if;

  perform pg_advisory_xact_lock(hashtextextended(active_session.employee_id::text, 0));
  select t.entry_type::text into previous_type
  from "Gestion_Fichajes".time_entries t
  where t.employee_id = active_session.employee_id
    and t.status = 'active'
    and (t.registered_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date
  order by t.registered_at desc limit 1;

  if (p_entry_type = 'entry' and previous_type is not null and previous_type <> 'exit')
    or (p_entry_type = 'break_start' and previous_type <> 'entry')
    or (p_entry_type = 'break_end' and previous_type <> 'break_start')
    or (p_entry_type = 'exit' and coalesce(previous_type, '') not in ('entry', 'break_end')) then
    raise exception 'Secuencia de fichaje no válida';
  end if;

  photo_state := case when p_photo_data is not null then 'success' when p_camera_error is not null then 'failed' else 'missing' end;
  gps_state := case when p_latitude is not null and p_longitude is not null then 'success' when p_gps_error is not null then 'failed' else 'missing' end;
  incident := photo_state <> 'success' or gps_state <> 'success' or nullif(trim(p_manual_reason), '') is not null;

  insert into "Gestion_Fichajes".time_entries (
    id, company_id, work_center_id, employee_id, device_id, entry_type,
    registered_at, photo_path, latitude, longitude, photo_status, gps_status,
    has_incident, source, status, manual_reason, created_by, created_at, updated_at
  ) values (
    gen_random_uuid(), target_device.company_id, target_device.work_center_id,
    active_session.employee_id, target_device.id, p_entry_type, now(),
    p_photo_data, p_latitude, p_longitude, photo_state, gps_state, incident,
    'employee', 'active', nullif(trim(p_manual_reason), ''), active_session.employee_id,
    now(), now()
  ) returning * into created_entry;

  if incident then
    insert into "Gestion_Fichajes".time_entry_incidents (
      id, company_id, work_center_id, employee_id, device_id, time_entry_id,
      incident_type, description, missing_photo, missing_gps, created_at
    ) values (
      gen_random_uuid(), target_device.company_id, target_device.work_center_id,
      active_session.employee_id, target_device.id, created_entry.id,
      case when nullif(trim(p_manual_reason), '') is not null then 'Reporte Manual' else 'Fichaje incompleto' end,
      left(concat_ws(' ', nullif(trim(p_manual_reason), ''), p_camera_error, p_gps_error), 1000),
      photo_state <> 'success', gps_state <> 'success', now()
    );
  end if;

  update "Gestion_Fichajes".employee_sessions
  set last_used_at = now(), expires_at = now() + interval '5 minutes'
  where id = active_session.id;
  return to_jsonb(created_entry);
end;
$$;

create or replace function "Gestion_Fichajes".submit_correction_request(
  p_employee_session_token text,
  p_device_token text,
  p_request_type text,
  p_requested_date date,
  p_requested_time time,
  p_entry_type text,
  p_reason text,
  p_time_entry_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  active_session "Gestion_Fichajes".employee_sessions;
  target_device "Gestion_Fichajes".authorized_devices;
  created_request "Gestion_Fichajes".correction_requests;
begin
  if p_request_type not in ('modify_existing', 'create_missing')
    or p_entry_type not in ('entry', 'break_start', 'break_end', 'exit') then
    raise exception 'Solicitud no válida';
  end if;
  if length(trim(p_reason)) < 10 or length(trim(p_reason)) > 1000 then
    raise exception 'El motivo debe contener entre 10 y 1000 caracteres';
  end if;
  if p_requested_date < current_date - 365 or p_requested_date > current_date + 1 then
    raise exception 'Fecha solicitada fuera del rango permitido';
  end if;

  select s.* into active_session
  from "Gestion_Fichajes".employee_sessions s
  where s.token_digest = encode(extensions.digest(p_employee_session_token, 'sha256'), 'hex')
    and s.expires_at > now()
  for update;
  if not found then raise exception 'Sesión de empleado caducada'; end if;

  select d.* into target_device
  from "Gestion_Fichajes".authorized_devices d
  where d.id = active_session.device_id
    and d.device_token_digest = encode(extensions.digest(p_device_token, 'sha256'), 'hex')
    and d.status = 'active'
  limit 1;
  if not found then raise exception 'Terminal no autorizado'; end if;

  if p_request_type = 'modify_existing' and not exists (
    select 1 from "Gestion_Fichajes".time_entries t
    where t.id = p_time_entry_id and t.employee_id = active_session.employee_id and t.status = 'active'
  ) then
    raise exception 'El fichaje indicado no pertenece al empleado';
  end if;

  insert into "Gestion_Fichajes".correction_requests (
    id, company_id, employee_id, time_entry_id, request_type, requested_date,
    requested_time, requested_entry_type, employee_reason, status, created_at
  ) values (
    gen_random_uuid(), target_device.company_id, active_session.employee_id,
    case when p_request_type = 'modify_existing' then p_time_entry_id else null end,
    p_request_type, p_requested_date, p_requested_time, p_entry_type,
    trim(p_reason), 'pending', now()
  ) returning * into created_request;

  update "Gestion_Fichajes".employee_sessions
  set last_used_at = now(), expires_at = now() + interval '5 minutes'
  where id = active_session.id;
  return to_jsonb(created_request);
end;
$$;

create or replace function "Gestion_Fichajes".set_employee_pin(p_employee_id uuid, p_new_pin text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  target_company_id uuid;
begin
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe contener exactamente 4 dígitos';
  end if;
  select company_id into target_company_id
  from "Gestion_Fichajes".employees where id = p_employee_id;
  if target_company_id is null or not "Gestion_Fichajes".can_access_company(target_company_id) then
    raise exception 'Operación no autorizada';
  end if;
  if exists (
    select 1 from "Gestion_Fichajes".employees e
    where e.company_id = target_company_id and e.id <> p_employee_id
      and e.status = 'active' and e.pin_digest = extensions.crypt(p_new_pin, e.pin_digest)
  ) then
    raise exception 'Este PIN ya está en uso en la empresa';
  end if;
  update "Gestion_Fichajes".employees
  set pin_digest = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)), pin_hash = '***', updated_at = now()
  where id = p_employee_id;
end;
$$;

revoke all on function "Gestion_Fichajes".list_device_registration_options() from public;
revoke all on function "Gestion_Fichajes".request_device_registration(text, uuid, uuid, boolean) from public;
revoke all on function "Gestion_Fichajes".validate_device(text) from public;
revoke all on function "Gestion_Fichajes".authenticate_employee(text, text) from public;
revoke all on function "Gestion_Fichajes".register_time_entry(text, text, text, text, numeric, numeric, text, text, text) from public;
revoke all on function "Gestion_Fichajes".submit_correction_request(text, text, text, date, time, text, text, uuid) from public;
revoke all on function "Gestion_Fichajes".set_employee_pin(uuid, text) from public;
grant execute on function "Gestion_Fichajes".list_device_registration_options() to anon, authenticated;
grant execute on function "Gestion_Fichajes".request_device_registration(text, uuid, uuid, boolean) to anon, authenticated;
grant execute on function "Gestion_Fichajes".validate_device(text) to anon, authenticated;
grant execute on function "Gestion_Fichajes".authenticate_employee(text, text) to anon, authenticated;
grant execute on function "Gestion_Fichajes".register_time_entry(text, text, text, text, numeric, numeric, text, text, text) to anon, authenticated;
grant execute on function "Gestion_Fichajes".submit_correction_request(text, text, text, date, time, text, text, uuid) to anon, authenticated;
grant execute on function "Gestion_Fichajes".set_employee_pin(uuid, text) to authenticated;

commit;
