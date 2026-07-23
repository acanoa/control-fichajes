# Arquitectura

## Estado y decisión

La aplicación sigue siendo una SPA React 19 + Vite 8. No se introduce un
servidor adicional porque las operaciones sensibles existentes ya se ejecutan
como funciones transaccionales de PostgreSQL en el Supabase central. Cambiar de
framework no aportaría por sí mismo una frontera de seguridad mejor.

La frontera queda organizada así:

- `src/pages` y `src/components`: presentación e interacción.
- `src/features`: servicios y reglas agrupados por dominio.
- `src/repositories`: persistencia de la aplicación. Las páginas no construyen
  consultas complejas.
- `src/integrations`: clientes de Supabase y servicios externos.
- `src/config`: lectura y validación de configuración pública.
- `src/lib`: errores y logging sin secretos.
- `supabase/migrations`: backend transaccional, autorización y persistencia.

`src/services/supabase.ts` es un adaptador temporal para imports históricos;
la única creación del cliente está en `src/integrations/supabase/client.ts`.

## Dominios

| Dominio | Implementación actual |
| --- | --- |
| Autenticación y perfiles | Supabase Auth para administradores; RPC con PIN bcrypt y sesión efímera para empleados |
| Empresas y centros | Tablas con RLS por empresa |
| Empleados | Tablas con RLS; el navegador no selecciona hashes de PIN |
| Fichajes y sesiones | RPC `register_time_entry`; secuencia y sesión se validan en una transacción |
| Calendarios y horarios | Tablas calificadas en `"Gestion_Fichajes"` |
| Incidencias y correcciones | RPC para empleado; administración protegida por RLS |
| Resúmenes semanales | RPC y trigger de recálculo; PostgreSQL es la autoridad |
| Auditoría | Trigger inmutable; repositorio de aplicación para eventos explícitos |
| Dispositivos | Token opaco local, digest SHA-256 en base y aprobación administrativa |

## Contratos y errores

Las RPC son los contratos de backend para operaciones sensibles. Los
repositorios encapsulan lecturas y escrituras directas sujetas a RLS.
`AppError` normaliza fallos técnicos y `logger` redacta claves cuyo nombre
parezca contener tokens, secretos, contraseñas, PIN o fotografías.
La auditoría crítica se escribe mediante triggers dentro de la misma
transacción que modifica el dato.

## Decisiones pendientes

- `AppContext.tsx` sigue siendo un módulo grande. La migración debe continuar
  por dominio en cambios pequeños para no alterar el MVP: autenticación,
  dispositivos, empleados, fichajes, calendarios y auditoría.
- `AdminPage.tsx` debe dividirse en rutas o paneles de dominio. Ya se carga de
  forma diferida para sacar PDF y administración del bundle inicial.
- Las fotografías están en el campo histórico `photo_path`. Antes de crecer,
  deben migrarse a un bucket privado exclusivo y URLs firmadas breves.
