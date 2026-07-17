# Control de fichajes

Aplicación React/Vite conectada a Supabase. La autorización real se aplica en PostgreSQL mediante RLS y funciones RPC; los controles de la interfaz no se consideran una barrera de seguridad.

## Configuración

1. Copia `.env.example` a `.env`.
2. Configura únicamente la URL y la clave pública `anon` de Supabase.
3. Aplica, con un usuario propietario de la base de datos, las migraciones de `supabase/migrations` antes de publicar el frontend.
4. Ejecuta `npm install`, `npm run lint` y `npm run build`.

Nunca coloques `SUPABASE_SERVICE_ROLE_KEY`, contraseñas de PostgreSQL ni URLs administrativas en el directorio o entorno de compilación del frontend.

## Modelo de seguridad

- Administradores: Supabase Auth y perfil activo vinculado por `auth_user_id`.
- Empleados: PIN de exactamente cuatro dígitos, verificado en PostgreSQL con bcrypt, bloqueo de intentos y sesión efímera de cinco minutos.
- Terminales: secreto aleatorio almacenado solamente como SHA-256 en la base de datos; el alta queda pendiente de aprobación administrativa.
- Fichajes: hora, secuencia, identidad, empresa y centro se validan en una transacción del servidor.
- Cálculo laboral: jornadas diarias, calendarios, contratos, redondeos, multiplicadores y horas extra se calculan exclusivamente en PostgreSQL.
- Integridad: cada cambio de fichaje dispara un recálculo automático; los clientes no pueden escribir resúmenes ni ajustes directamente.
- Multiempresa: RLS filtra todas las tablas por el perfil autenticado.
- Auditoría: triggers inmutables; los clientes no pueden modificar el historial.
- Navegador: no persiste empleados, PIN, fichajes, GPS, incidencias ni auditoría en Web Storage.

La clave pública `anon` puede estar en el bundle. Su seguridad depende de que las migraciones RLS estén aplicadas.

## Despliegue

`public/_headers` contiene las cabeceras recomendadas para plataformas compatibles. Si el alojamiento no procesa ese archivo, configura las mismas cabeceras en el proxy/CDN, especialmente CSP, HSTS, `X-Content-Type-Options` y Permissions Policy.

Las fotografías siguen usando el campo histórico `photo_path`. Para un despliegue con gran volumen se recomienda migrarlas a un bucket privado de Supabase Storage y entregar URLs firmadas de corta duración.
