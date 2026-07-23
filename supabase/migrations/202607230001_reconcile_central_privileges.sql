begin;

-- Reconciliación preparada tras comparar el catálogo central el 2026-07-23.
-- No elimina objetos ni datos. Las RPC públicas usan SECURITY DEFINER y no
-- necesitan privilegios directos sobre tablas para anon.
revoke all privileges on all tables in schema "Gestion_Fichajes" from anon;
revoke all privileges on all sequences in schema "Gestion_Fichajes" from anon;

-- Un cliente autenticado nunca necesita administrar la estructura ni truncar
-- tablas. RLS continúa decidiendo SELECT/INSERT/UPDATE/DELETE por empresa.
revoke truncate, references, trigger
on all tables in schema "Gestion_Fichajes"
from authenticated;

revoke all privileges
on "Gestion_Fichajes".employee_sessions
from anon, authenticated;

-- Funciones heredadas detectadas en producción. No aparecen en el código ni en
-- las migraciones actuales y permiten saltarse los contratos seguros nuevos.
-- Se conservan temporalmente para facilitar rollback, pero quedan inaccesibles.
revoke all
on function "Gestion_Fichajes".get_admin_company_id()
from public, anon, authenticated;

revoke all
on function "Gestion_Fichajes".register_employee_punch(
  uuid, uuid, uuid, text, text, numeric, numeric, text, text, uuid
)
from public, anon, authenticated;

revoke all
on function "Gestion_Fichajes".validate_employee_login(text, text)
from public, anon, authenticated;

comment on function "Gestion_Fichajes".get_admin_company_id()
is 'LEGACY: acceso revocado; sustituida por current_profile/can_access_company.';
comment on function "Gestion_Fichajes".register_employee_punch(
  uuid, uuid, uuid, text, text, numeric, numeric, text, text, uuid
)
is 'LEGACY: acceso revocado; sustituida por register_time_entry con sesión efímera.';
comment on function "Gestion_Fichajes".validate_employee_login(text, text)
is 'LEGACY: acceso revocado; sustituida por authenticate_employee con bcrypt.';

commit;
