# Copias y restauración

## Responsabilidad

Las copias pertenecen al Supabase central y deben coordinarse con el resto de
aplicaciones de la instancia. Este repositorio no crea otro PostgreSQL ni
ejecuta restauraciones automáticas.

## Copia recomendada

- Mantener backups gestionados y recuperación a un punto en el tiempo según el
  RPO/RTO acordado.
- Antes de una migración, crear una copia lógica limitada a
  `"Gestion_Fichajes"` con esquema y datos, y registrar versión de migración,
  fecha y checksum en un almacén cifrado.
- Respaldar por separado el bucket privado exclusivo cuando se implante
  Storage. No incluir secretos Auth en artefactos del proyecto.

## Ensayo de restauración

1. Restaurar en una instancia aislada, nunca sobre producción.
2. Confirmar que sólo se importó `"Gestion_Fichajes"` y sus referencias
   necesarias a usuarios de prueba.
3. Aplicar migraciones pendientes en orden.
4. Ejecutar `supabase/tests/security_and_calculation.sql`.
5. Probar inicio de administrador, alta/aprobación de terminal, login de
   empleado, secuencia completa de fichajes, corrección y recálculo semanal.
6. Medir el tiempo real y documentar cualquier paso manual.

## Recuperación de una migración

Las migraciones de seguridad se revierten con grants explícitos previamente
capturados, no restaurando toda la base. Una restauración completa requiere
autorización, ventana de mantenimiento y validación de todas las aplicaciones
que comparten el Supabase central.
