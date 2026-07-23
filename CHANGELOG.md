# Changelog

## v1.0.0 — 2026-07-23

Primera versión organizada y preparada para crecer de Gestión de Fichajes.

### Aplicación

- Arquitectura modular por configuración, integraciones, repositorios,
  servicios y dominios.
- Cliente Supabase único y tipado para el esquema `"Gestion_Fichajes"`.
- Validación temprana de variables públicas y protección frente a exposición de
  `service_role`.
- Acceso a datos retirado de las páginas visuales.
- Leaflet empaquetado localmente y panel administrativo cargado bajo demanda.
- Exportación PDF separada del bundle principal.
- Gestión homogénea de errores y logs con redacción de datos sensibles.
- Versión visible en la esquina inferior derecha de toda la aplicación.
- Historial de fichajes ordenado del más reciente al más antiguo y filtrable por empleado.

### Base de datos y seguridad

- RLS verificado en todas las tablas de la aplicación.
- Privilegios directos de `anon` revocados.
- RPC heredadas inseguras desactivadas.
- Sesiones efímeras de empleado y validación de dispositivos.
- Cálculo de jornada y horas extra mantenido en PostgreSQL.
- Auditoría transaccional añadida a ajustes de horas extra.

### Calidad y operación

- Pruebas de jornada, descansos, redondeos y horas extra.
- Pruebas SQL de RLS, permisos, funciones y triggers.
- CI para lint, typecheck, tests y build.
- Documentación de arquitectura, despliegue, base de datos y restauración.
