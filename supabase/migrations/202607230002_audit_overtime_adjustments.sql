begin;

create or replace function "Gestion_Fichajes".audit_overtime_adjustment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, "Gestion_Fichajes"
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_employee_id uuid := coalesce(new.employee_id, old.employee_id);
  target_company_id uuid;
  target_id uuid := coalesce(new.id, old.id);
  actor_id uuid := coalesce(
    new.created_by,
    new.cancelled_by,
    old.created_by,
    old.cancelled_by
  );
begin
  select e.company_id into target_company_id
  from "Gestion_Fichajes".employees e
  where e.id = target_employee_id;

  if target_company_id is null then
    raise exception 'No se puede auditar el ajuste sin empresa';
  end if;

  insert into "Gestion_Fichajes".audit_logs (
    id,
    company_id,
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    reason,
    performed_by,
    performed_at
  ) values (
    gen_random_uuid(),
    target_company_id,
    'overtime_adjustments',
    target_id,
    lower(tg_op),
    old_row,
    new_row,
    coalesce(new.reason, new.cancellation_reason, old.reason, old.cancellation_reason),
    actor_id,
    now()
  );

  return null;
end;
$$;

revoke all
on function "Gestion_Fichajes".audit_overtime_adjustment()
from public, anon, authenticated;

drop trigger if exists immutable_audit_trigger
on "Gestion_Fichajes".overtime_adjustments;

create trigger immutable_audit_trigger
after insert or update or delete
on "Gestion_Fichajes".overtime_adjustments
for each row
execute function "Gestion_Fichajes".audit_overtime_adjustment();

commit;
