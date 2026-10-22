# Operación y contingencia

## Local y auditorio

1. Ejecutar `npm run setup`, `npm run check` y `npm test` con Node 24.
2. Arrancar con `npm start`. Revisar `/healthz` y acceder a los dos grupos desde Control Center. No iniciar las sesiones reales durante el ensayo: usar una base de ensayo mediante otra ruta `DATABASE_PATH`.
3. Para dispositivos del auditorio, configurar host de red, firewall, dominio y TLS; probar desde la red Wi-Fi prevista. Un teléfono no puede acceder al `127.0.0.1` de otro equipo. No publicar `.env`, respaldos ni la contraseña del conferencista.
4. Abrir Studio y pulsar «Abrir proyección 16:9»: el proyector usa una pestaña independiente con cookie propia en el mismo navegador. Para comprobar las restricciones del estudiante usar otro perfil sin credenciales del conferencista. Mostrar al público solo la pestaña de proyección, preferiblemente en pantalla completa; los participantes seleccionan su horario sin ingresar código de sala. Studio muestra el código estadístico automático para reportes.
5. Definir participantes objetivo, ensayo de picos de ingreso y concurrencia, política de privacidad, retención, acceso y eliminación antes de recolectar información real. El cupo inicial es 200 equipos por sala, con máximo seis integrantes por equipo; no representa capacidad certificada.

## Salud y protección

`GET /healthz` verifica proceso y acceso a base de datos. stdout emite JSON con requestId, método, estado y duración; los errores internos no registran cuerpos, contraseñas ni prompts. Todavía faltan paneles, métricas agregadas, trazas y alertas. Los logs actuales no cuentan conexiones activas SSE como peticiones terminadas.

Límites por minuto (configurables con `RATE_LIMIT_*_PER_MIN`): 6000 por IP, porque en el auditorio cientos de celulares comparten la IP pública del Wi-Fi; 600 por acceso (cookie); 20 intentos de contraseña de Studio o enlace de proyector por IP. Detrás de un proxy HTTPS definir `TRUST_PROXY=true` para usar la IP real; sin proxy, dejarlo en `false`. Otros límites: 5 streams por identidad, 16 KiB por petición, 3 generaciones por equipo, expiración máxima 24 horas. Ajustar después de probar la red del auditorio: muchos asistentes detrás de una IP compartida pueden activar estos límites. No confiar en X-Forwarded-For sin una política de proxy conocido; la implementación actual usa la IP del socket.

La contraseña de arranque controla las dos salas: la cookie resultante solo autoriza la elegida al autenticar. No hay cuentas personales de conferencista ni revocación administrativa todavía. Para invalidar accesos activos, detener el servicio y eliminar los registros de `tokens` desde una herramienta SQLite autorizada; cambiar la contraseña evita nuevos ingresos pero no revoca automáticamente cookies existentes.

## Prueba de carga

`npm run load` levanta un servidor propio con base temporal (no toca `data/`), registra 300 participantes en 50 equipos, abre 302 conexiones en vivo y recorre las fases con ráfagas de entregas, incidentes, pausa y cierre. Reporta latencias p50/p95/máx, tiempo de difusión a todas las pantallas, datos recibidos, memoria y consistencia final; termina con código 1 si alguna pantalla queda desactualizada o hay errores. `--teams` y `--members` ajustan la cantidad.

Resultado de referencia (22 oct 2026, portátil de desarrollo): 300/300 registros en 0,3 s; difusión de un cambio de fase a 302 pantallas en 24–43 ms; ráfaga de 50 entregas simultáneas en 96–203 ms; Studio recibió 59 eventos; 133 MB de memoria; sin errores. Con 600 participantes también terminó sin errores ni pantallas desactualizadas.

Para sostener esa carga, cada difusión calcula una sola instantánea compartida, las entregas de un equipo solo se envían a sus integrantes y las actualizaciones de Studio y proyector por entregas o conexiones se agrupan cada 250 ms. Repetir la prueba en el servidor de producción y desde la red del auditorio antes del evento.

## Respaldos y recuperación

`npm run backup` crea una copia SQLite consistente en `data/backups`. Validar el archivo con `PRAGMA integrity_check` y conservarlo en almacenamiento con permisos restringidos. Programación externa y cifrado no están configurados. En contenedor, el volumen conserva los datos; el script de backup se ejecuta desde el host con acceso a la base o se añade como tarea operativa específica.

Restauración: detener todos los procesos que usen esa base, conservar una copia del directorio de datos completo, restaurar el respaldo como `DATABASE_PATH` en un directorio nuevo sin archivos WAL/SHM previos, reiniciar y verificar `/healthz`, fase y entregas. Mantener el directorio anterior hasta validar la recuperación. Ensayar este procedimiento antes del evento.

## Contingencia

- Sin Internet: el recorrido DEMO funciona en una red local con servidor accesible; no depende de IA ni CDNs.
- Pérdida de conexión: la UI bloquea acciones al fallar SSE y reintenta. Los borradores no guardados pueden perderse al cerrar la pestaña; guardar antes de cambiar de aplicación.
- Incidente en el taller: usar «Pausar todo». No avanza ninguna fase por reloj ni por finalización individual.
- Reinicio del servidor: SQLite mantiene fase, versiones y accesos vigentes; los clientes rehidratan el snapshot al reconectar.
- Navegador perdido o cookie expirada: reingresar con el mismo correo, horario y nombre del equipo recupera el trabajo y revoca el acceso anterior. Un cambio de equipo se rechaza. La recuperación DEMO aún requiere verificación de identidad antes de uso institucional con datos sensibles.
- Resultado de IA: no aplica en esta versión; no hay integración externa ni cola.

## Pendiente antes de producción

Ensayo de carga y taller completo, móviles y accesibilidad, código QR, recuperación de equipos, recuperación de membresías y consentimiento, branding oficial, protección por identidad y rate limits para NAT, migraciones, retención, alertas y backup automatizado. Validar TLS/proxy/SSE, imagen Docker y almacenamiento persistente. No hay despliegue remoto creado ni infraestructura cloud provisionada.
