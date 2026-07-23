# Despliegue

## Artefacto

El frontend se compila como sitio estático:

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Publicar únicamente el contenido de `dist/`. `deploy-package/` es un artefacto
local histórico no versionado y no es la fuente de verdad.

## Variables

El build del navegador sólo admite:

- `VITE_SUPABASE_URL`: URL HTTPS del Supabase central.
- `VITE_SUPABASE_ANON_KEY`: clave pública `anon`.

No configurar variables `VITE_` con `service_role`, JWT secrets, contraseñas de
PostgreSQL o credenciales administrativas. `src/config/env.ts` falla al
arrancar si falta configuración, la URL no es segura o se intenta exponer
`VITE_SUPABASE_SERVICE_ROLE_KEY`.

Las variables `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` pertenecen a un
entorno de backend/operaciones separado, nunca al job que compila Vite.

## Cabeceras y red

`public/_headers` define CSP, HSTS, permisos de cámara/geolocalización y
protecciones de aislamiento. El host debe soportar ese formato o trasladar las
cabeceras al proxy/CDN. La lista `connect-src` admite únicamente el Supabase
central y Nominatim.

Antes de producción, verificar en el panel central:

- que `"Gestion_Fichajes"` esté entre los esquemas publicados por PostgREST;
- orígenes CORS limitados a los dominios reales;
- Site URL y Redirect URLs de Auth sin comodines innecesarios;
- proveedores OAuth deshabilitados si no se usan;
- que la clave `anon` desplegada pertenezca a la instancia central correcta.

La consulta pública realizada el 2026-07-23 confirmó que todos los proveedores
OAuth están desactivados, pero el alta por email y teléfono está habilitada con
autoconfirmación y Auth responde con CORS `*`. Los usuarios sin perfil funcional
no superan las políticas de `"Gestion_Fichajes"`, pero endurecer estos valores
debe coordinarse de forma central porque puede afectar a otras aplicaciones.

## Base de datos

Las migraciones se revisan y aplican por un operador con una ventana de cambio.
Este repositorio no las ejecuta durante el build. Ejecutar primero
`supabase/tests/security_and_calculation.sql` en un entorno de ensayo
reconciliado.
