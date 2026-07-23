begin;

create temporary table security_assertions (
  name text primary key,
  passed boolean not null check (passed)
) on commit drop;

insert into security_assertions(name, passed)
values
  (
    'all application tables have RLS',
    not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'Gestion_Fichajes'
        and c.relkind = 'r'
        and not c.relrowsecurity
    )
  ),
  (
    'anon has no direct table privileges',
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'Gestion_Fichajes' and grantee = 'anon'
    )
  ),
  (
    'authenticated has no structural table privileges',
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'Gestion_Fichajes'
        and grantee = 'authenticated'
        and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    )
  ),
  (
    'employee sessions are inaccessible to clients',
    not pg_catalog.has_table_privilege(
      'authenticated',
      '"Gestion_Fichajes".employee_sessions',
      'SELECT'
    )
  ),
  (
    'critical functions use safe SECURITY DEFINER',
    not exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'Gestion_Fichajes'
        and p.proname in (
          'authenticate_employee',
          'register_time_entry',
          'recalculate_employee_hours',
          'recalculate_company_hours',
          'add_overtime_adjustment',
          'audit_overtime_adjustment'
        )
        and (
          not p.prosecdef
          or p.proconfig is null
          or not p.proconfig @> array['search_path=pg_catalog, "Gestion_Fichajes"']
        )
    )
  ),
  (
    'legacy functions are not executable by clients',
    not exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'Gestion_Fichajes'
        and p.proname in (
          'get_admin_company_id',
          'register_employee_punch',
          'validate_employee_login'
        )
        and (
          pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
        )
    )
  ),
  (
    'anon cannot recalculate work summaries',
    not pg_catalog.has_function_privilege(
      'anon',
      '"Gestion_Fichajes".recalculate_employee_hours(uuid)',
      'EXECUTE'
    )
  ),
  (
    'authenticated can invoke authorized recalculation',
    pg_catalog.has_function_privilege(
      'authenticated',
      '"Gestion_Fichajes".recalculate_employee_hours(uuid)',
      'EXECUTE'
    )
  ),
  (
    'time entries trigger automatic recalculation',
    exists (
      select 1
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'Gestion_Fichajes'
        and c.relname = 'time_entries'
        and t.tgname = 'recalculate_work_summaries_trigger'
        and not t.tgisinternal
    )
  ),
  (
    'overtime adjustments trigger immutable audit',
    exists (
      select 1
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'Gestion_Fichajes'
        and c.relname = 'overtime_adjustments'
        and t.tgname = 'immutable_audit_trigger'
        and not t.tgisinternal
    )
  );

select pg_catalog.jsonb_object_agg(name, passed order by name) as assertions
from security_assertions;

rollback;

select 'security_and_calculation_ok' as result;
