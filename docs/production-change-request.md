# Solicitud de cambio en producción

Estado: **aplicado el 2026-07-23 tras autorización explícita**.

## Alcance exacto

Destino: únicamente el esquema `"Gestion_Fichajes"` del Supabase central.

La operación pendiente ejecuta, en una única transacción:

1. `202607230001_reconcile_central_privileges.sql`
   - revoca todos los privilegios directos de `anon` sobre tablas y secuencias
     del esquema;
   - revoca `TRUNCATE`, `REFERENCES` y `TRIGGER` a `authenticated`;
   - mantiene inaccesible `employee_sessions`;
   - revoca a `public`, `anon` y `authenticated` la ejecución de
     `get_admin_company_id`, `register_employee_punch` y
     `validate_employee_login`;
   - no elimina funciones, tablas ni datos.
2. `202607230002_audit_overtime_adjustments.sql`
   - crea `audit_overtime_adjustment()`;
   - crea un trigger de auditoría sobre `overtime_adjustments`;
   - no modifica filas existentes.

## Impacto posible

Un consumidor heredado que invoque las tres RPC antiguas o acceda directamente
como `anon` a tablas dejará de funcionar. El frontend actual no usa esas vías:
emplea `authenticate_employee`, `register_time_entry` y RPC con sesión efímera.

## Validación realizada

Las dos migraciones y las pruebas SQL se ejecutaron juntas en producción dentro
de una transacción que terminó en `ROLLBACK`. La preflight finalizó sin errores.

## Aprobación recibida

La autorización recibida aceptó explícitamente:

- revocar los grants directos de `anon`;
- desactivar la ejecución de las tres RPC heredadas;
- crear la función y trigger de auditoría de horas extra.
