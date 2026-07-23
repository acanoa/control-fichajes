# Base de datos

## Alcance

La aplicación usa exclusivamente el esquema existente
`"Gestion_Fichajes"` del Supabase central. `auth.users` se comparte sólo para
la identidad; perfiles y roles funcionales están en
`"Gestion_Fichajes".profiles`. No hay objetos de aplicación nuevos en
`public`.

## Comparación realizada el 2026-07-23

La inspección de sólo lectura del catálogo central encontró:

- 23 tablas en `"Gestion_Fichajes"`, todas con RLS activo;
- políticas administrativas por empresa en todas las tablas accesibles por API;
- `employee_sessions` sin política y sin acceso de cliente, que es lo esperado;
- las RPC nuevas con `SECURITY DEFINER` y `search_path` fijo;
- tres migraciones funcionalmente presentes, aunque la instancia no dispone de
  `supabase_migrations.schema_migrations` para demostrar su historial;
- privilegios directos históricos demasiado amplios para `anon`;
- tres funciones heredadas no presentes en el repositorio:
  `get_admin_company_id`, `register_employee_punch` y
  `validate_employee_login`.
- PostgREST publica `public`, `storage`, `graphql_public`,
  `hacienda`, `"Gestion_Fichajes"` y `procesamiento_documentos`. El cliente de
  esta aplicación fija explícitamente `"Gestion_Fichajes"` y no usa un
  `search_path` compartido.

Las dos últimas funciones heredadas aceptan identidad o PIN enviados por el
cliente y omiten el contrato actual de sesión efímera. Además, las tres fueron
creadas como `SECURITY DEFINER` sin un `search_path` fijo. No se eliminaron ni
modificaron en producción.

## Reconciliación

`202607230001_reconcile_central_privileges.sql`:

1. revoca acceso directo de `anon` a tablas y secuencias;
2. quita privilegios estructurales innecesarios a `authenticated`;
3. conserva pero revoca la ejecución de las RPC heredadas;
4. no borra datos ni objetos.

Debe revisarse con los consumidores del Supabase central y probarse antes de
aplicarla. El rollback operativo consiste en restaurar únicamente los grants
documentados que un consumidor legítimo demuestre necesitar; no se recomienda
volver a publicar las RPC de PIN plano.

`202607230002_audit_overtime_adjustments.sql` añade la trazabilidad transaccional
que faltaba para altas, cambios y cancelaciones de ajustes de horas extra.

El 2026-07-23 ambas migraciones y `security_and_calculation.sql` superaron una
preflight conjunta dentro de una transacción finalizada con `ROLLBACK`.
Posteriormente, tras autorización explícita, las dos migraciones se aplicaron
atómicamente al Supabase central.

La verificación posterior confirmó:

- cero tablas del esquema sin RLS;
- cero privilegios directos de tabla para `anon`;
- cero privilegios `TRUNCATE`, `REFERENCES` o `TRIGGER` para `authenticated`;
- cero privilegios de cliente sobre `employee_sessions`;
- las tres RPC heredadas sin `EXECUTE` para `public`, `anon` y `authenticated`;
- el trigger de recálculo y el nuevo trigger de auditoría presentes;
- `audit_overtime_adjustment()` como `SECURITY DEFINER` con `search_path` fijo.

## Reglas

- Calificar siempre `"Gestion_Fichajes".objeto`.
- Toda tabla expuesta mantiene RLS.
- Toda función `SECURITY DEFINER` fija
  `search_path = pg_catalog, "Gestion_Fichajes"`.
- Sólo las RPC públicas de terminal reciben `EXECUTE` para `anon`.
- Resúmenes y auditoría no admiten escrituras directas del cliente.
- El trigger de fichajes mantiene el recálculo dentro de la transacción.

## Sincronización de tipos

`src/integrations/supabase/database.types.ts` contiene el contrato tipado de
tablas y RPC consumidas. El repositorio de carga excluye expresamente
`pin_hash`, `pin_digest`, `device_token` y `device_token_digest`. Conviene
regenerar y comparar este contrato en CI cuando el panel central disponga de un
generador automatizable.
