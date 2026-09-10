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

Producción: `https://integraprocesos.es/apps/control-fichajes/`, servida por
Nginx en `192.168.2.176` detrás de Cloudflare. El build fija la base de recursos
en `/apps/control-fichajes/`; el servidor de desarrollo conserva `/`.
Publicar el contenido de `dist/` en el directorio que Nginx tenga asignado a esa
ruta, conservando una copia de la versión anterior. No sustituir la raíz de la
web Integra Procesos. Verificar el HTML y sus recursos JavaScript/CSS tanto en
el origen como en la URL pública. Un fallo de actualización puede dejar la
versión anterior en servicio aunque `main` ya contenga el cambio.

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

Para comprobar un terminal móvil, abrir siempre el mismo origen y navegador
normal usados en su registro. Cambiar HTTP/HTTPS, dominio, puerto, navegador o
borrar los datos del sitio separa o elimina su identificación local. Aprobar el
terminal en administración y comprobar que pasa a validado en el móvil en un
máximo aproximado de 15 segundos con conexión. Simular un fallo de red y verificar
que al reconectar conserva su identificación. Nunca copiar tokens en incidencias
ni introducir credenciales administrativas en el navegador del terminal.

Las migraciones se revisan y aplican por un operador con una ventana de cambio.
Este repositorio no las ejecuta durante el build. Ejecutar primero
`supabase/tests/security_and_calculation.sql` en un entorno de ensayo
reconciliado.
