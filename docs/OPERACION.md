# Operación y contingencia

## Taller virtual

1. Ejecutar `npm run setup`, `npm run check` y `npm test` con Node 24.
2. Arrancar con `npm start`. Revisar `/healthz` y acceder a la sesión virtual desde Control Center. No iniciar la sesión real durante el ensayo: usar una base de ensayo mediante otra ruta `DATABASE_PATH`.
3. Para el acceso virtual, configurar host de red, firewall, dominio y TLS y verificar el sitio desde una conexión externa. Un teléfono no puede acceder al `127.0.0.1` de otro equipo. No publicar `.env`, respaldos ni la contraseña del conferencista.
4. Abrir Studio y pulsar «Abrir proyección 16:9»: el proyector usa una pestaña independiente con cookie propia en el mismo navegador. Para comprobar las restricciones del estudiante usar otro perfil sin credenciales del conferencista. Compartir en la videollamada solo la pestaña de proyección. Los participantes usan el enlace de registro, sin elegir horario ni ingresar un código de sala. Studio muestra el código estadístico automático para reportes.
5. Definir participantes objetivo, ensayo de picos de ingreso y concurrencia, política de privacidad, retención, acceso y eliminación antes de recolectar información real. El cupo inicial es 200 equipos por sala, con máximo seis integrantes por equipo; no representa capacidad certificada.

## Salud y protección

`GET /healthz` verifica proceso y acceso a base de datos. stdout emite JSON con requestId, método, estado y duración; los errores internos no registran cuerpos, contraseñas ni prompts. Todavía faltan paneles, métricas agregadas, trazas y alertas. Los logs actuales no cuentan conexiones activas SSE como peticiones terminadas.

Límites por minuto (configurables con `RATE_LIMIT_*_PER_MIN`): 9000 por IP para ráfagas de accesos detrás de una IP compartida; 600 por acceso (cookie); 20 intentos de contraseña de Studio o enlace de proyector por IP. Detrás de un proxy HTTPS definir `TRUST_PROXY=true` para usar la IP real; sin proxy, dejarlo en `false`. Otros límites: 5 streams por identidad, 16 KiB por petición, 3 generaciones por equipo, expiración máxima 24 horas. Ajustar después de probar la red del auditorio: muchos asistentes detrás de una IP compartida pueden activar estos límites. No confiar en X-Forwarded-For sin una política de proxy conocido; la implementación actual usa la IP del socket.

La contraseña de arranque da acceso a Studio para la sesión virtual. No hay cuentas personales de conferencista ni revocación administrativa todavía. Para invalidar accesos activos, detener el servicio y eliminar los registros de `tokens` desde una herramienta SQLite autorizada; cambiar la contraseña evita nuevos ingresos pero no revoca automáticamente cookies existentes.

## Prueba de carga

`npm run load` levanta un servidor propio con base temporal (no toca `data/`), registra 300 participantes en 50 equipos, abre 302 conexiones en vivo y recorre las fases con ráfagas de entregas, incidentes, pausa y cierre. Reporta latencias p50/p95/máx, tiempo de difusión a todas las pantallas, datos recibidos, memoria y consistencia final; termina con código 1 si alguna pantalla queda desactualizada o hay errores. `--teams` y `--members` ajustan la cantidad.

Ensayo local del 18 de noviembre de 2026: 1200 registros en 2,6 s, 1202 conexiones en vivo tras abrirlas en tandas de hasta 100, seis fases completas y estado final sincronizado sin errores. El registro tuvo un p95 de 71 ms, la difusión tardó hasta 272 ms y una ráfaga de 200 entregas tardó hasta 3,3 s. El servidor terminó con 296 MB RSS y Studio recibió 100,4 MB en todo el recorrido. El primer ensayo al cupo máximo agotó el límite de 6000 peticiones por IP compartida. Con 9000 completó el recorrido. Si el entorno ya define `RATE_LIMIT_IP_PER_MIN=6000`, actualizar ese valor explícito antes de repetir el ensayo.

Para sostener esa carga, cada difusión calcula una sola instantánea compartida, las entregas de un equipo solo se envían a sus integrantes y las actualizaciones de Studio y proyector por entregas o conexiones se agrupan cada 250 ms. Repetir la prueba en una instancia de ensayo con la configuración del servidor del evento y una base temporal propia.

## Reiniciar una sesión después de un ensayo

Studio → **Mantenimiento** deja la sesión en la que se ingresó como recién creada: borra equipos, participantes (cierra sus accesos), entregas, notas personales, incidentes, revisiones, eventos e historial, y vuelve el taller a «En espera». Conserva el código y horario, el acceso de Studio y del proyector, y, si se marca, las notas de explicación.

Protecciones: exige escribir `REINICIAR TARDE` o `REINICIAR NOCHE`; no funciona con la sesión en vivo (pausar o finalizar antes); guarda antes una copia `data/backups/antes-de-reiniciar-<sesión>-<fecha>.sqlite`; queda registrado como `SESSION_RESET`. Para el día del evento definir `ALLOW_SESSION_RESET=false` y reiniciar el servicio: el servidor rechazará cualquier reinicio.

Recuperar un reinicio accidental: detener el servicio, copiar la base actual aparte, restaurar el archivo `antes-de-reiniciar-…` como `DATABASE_PATH` y volver a arrancar.

## Respaldos y recuperación

`npm run backup` crea una copia SQLite consistente en `data/backups`. Validar el archivo con `PRAGMA integrity_check` y conservarlo en almacenamiento con permisos restringidos. Programación externa y cifrado no están configurados. En contenedor, el volumen conserva los datos; el script de backup se ejecuta desde el host con acceso a la base o se añade como tarea operativa específica.

Restauración: detener todos los procesos que usen esa base, conservar una copia del directorio de datos completo, restaurar el respaldo como `DATABASE_PATH` en un directorio nuevo sin archivos WAL/SHM previos, reiniciar y verificar `/healthz`, fase y entregas. Mantener el directorio anterior hasta validar la recuperación. Ensayar este procedimiento antes del evento.

## Contingencia

- Sin Internet: el recorrido DEMO funciona en una red local con servidor accesible; no depende de IA ni CDNs.
- Pérdida de conexión: la UI bloquea acciones al fallar SSE y reintenta. Los borradores no guardados pueden perderse al cerrar la pestaña; guardar antes de cambiar de aplicación.
- Incidente en el taller: usar «Pausar todo». No avanza ninguna fase por reloj ni por finalización individual.
- Reinicio del servidor: SQLite mantiene fase, versiones y accesos vigentes; los clientes rehidratan el snapshot al reconectar.
- Si se corta la conexión, la app vuelve a conectarse automáticamente. Si pierde la cookie de acceso, el mismo navegador puede recuperar su identidad durante tres horas desde el registro o desde su primera visita autenticada tras la actualización. La ventana no se renueva. Si se pierde el navegador, vence la recuperación o se cierra el acceso, el conferencista debe verificar la identidad antes de gestionar la reincorporación.
- Resultado de IA: no aplica en esta versión; no hay integración externa ni cola.

## Pendiente antes de producción

Ensayo de carga y taller completo, móviles y accesibilidad, código QR, recuperación de equipos, recuperación de membresías y consentimiento, branding oficial, protección por identidad y rate limits para NAT, migraciones, retención, alertas y backup automatizado. Validar TLS/proxy/SSE, imagen Docker y almacenamiento persistente. No hay despliegue remoto creado ni infraestructura cloud provisionada.
