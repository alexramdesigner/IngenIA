# Arquitectura y contratos

## Decisiones de fundación

Node.js 24, módulos ESM y HTTP nativo; SQLite persistente con WAL, claves foráneas y transacciones `BEGIN IMMEDIATE`. El módulo [node:sqlite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) permite la ejecución sin paquetes externos. La persistencia actual es para una instancia y debe validarse bajo la carga prevista antes del evento. No se ha desplegado PostgreSQL ni Redis; se necesitará otra estrategia de persistencia y pub/sub si se escala a varias instancias.

Las tres vistas comparten origen y API. El estado autoritativo vive en `sessions`; el navegador solo conserva borradores temporales. SSE envía un snapshot adaptado al rol; cada conexión/reconexión recibe el estado completo, sin depender del historial de eventos perdidos.

## Datos

Esquema versionado mediante `PRAGMA user_version=6`, creado en `services/api/store.mjs`:

- `sessions`: grupo, código aleatorio y estado serializado (fase, reloj, versión, horarios).
- `identities`: rol y asignación explícita a una única sala/equipo; cada identidad PARTICIPANT constituye una membresía registrada.
- `team_names`: nombre normalizado único por sala, enlazado al equipo canónico.
- `tokens`: hashes SHA-256 de tokens aleatorios de 256 bits, caducidad y revocación por logout.
- `teams`: nombre único por sala y proyecto con versiones, hallazgos y entregas.
- `phase_actions`: actor, fase/estado antes y después, versión, motivo y timestamp.
- `idempotency`: clave por actor y sesión, petición y respuesta confirmadas en la misma transacción.
- `events`: tipo de evento, versión y fecha, sin prompts ni datos del equipo.

El almacenamiento de proyectos en JSON reduce complejidad de la base inicial. Antes de M2/M3 conviene normalizar versiones, hallazgos, entregas y miembros mediante migraciones numeradas, sin borrar las bases existentes.

## API

Las vistas usan `/api` (participante), `/api/studio` (conferencista) y `/api/projection` (proyector). Las cookies `ingenia`, `ingenia_presenter` e `ingenia_projector` son independientes; las APIs de Studio y proyección aceptan exclusivamente la cookie del rol correspondiente. Las rutas originales `/api` se mantienen por compatibilidad. POST exige JSON, cuerpo máximo 16 KiB y control de origen para navegadores. Acceso mediante cookie HttpOnly, SameSite=Strict y expiración configurable (8 horas por defecto). Cada operación autoriza rol y sesión. No hay credenciales en el frontend.

| Método | Ruta | Acceso / resultado |
|---|---|---|
| POST | `/auth/presenter` | `{password,sessionId}`; acceso del conferencista a esa sala |
| POST | `/auth/join` | `{sessionId,name,teamId?,code?}`; crea o une al equipo canónico, máximo 6 integrantes |
| POST | `/team-search` | `{sessionId,query,code?}`; hasta ocho nombres coincidentes, cupos y estado completo de esa sala |
| POST | `/auth/projector` | `{token}`; intercambia token de un uso por cookie de proyector |
| POST | `/auth/logout` | Revoca el token actual y cierra sus conexiones |
| GET | `/me` | Rol y sala del acceso actual |
| GET | `/sessions/:id/state` | Estado y permisos calculados por servidor |
| GET | `/sessions/:id/events` | SSE; snapshot inmediato y cambios posteriores |
| POST | `/sessions/:id/phase-command` | Solo PRESENTADOR de la sala |
| POST | `/sessions/:id/projector-access` | Solo PRESENTADOR; enlace privado de lectura |
| POST | `/sessions/:id/actions/discovery` | Fase 1; `projectType`, `user`, `problem`, `features[3]`, `constraint` |
| POST | `/sessions/:id/actions/specification` | Fase 2; `stories[2]`, `criteria[3]`, `negative` |
| POST | `/sessions/:id/actions/architecture` | Fase 3; `architecture`, `data`, `accessFlow`, `authRule`, `justification` |
| POST | `/sessions/:id/actions/generate` | Fase 4; requiere fases 1–3 enviadas; `prompt` (20–6000); máximo 3 por iteración |
| POST | `/sessions/:id/actions/construction` | Fase 4; versión de la iteración; `matches`, `differs` |
| POST | `/sessions/:id/actions/verification` | Fase 5; construcción enviada; `category`, `severity`, `description`, `impact`, `regressionTest` |
| POST | `/sessions/:id/actions/delivery` | Fase 6; verificación enviada; `decision`, `conditions` si aplica, `residualRisk`, `rollback`, `improvement`, `checklist:true` |
| POST | `/sessions/:id/deliverable-review` | Solo PRESENTADOR; `teamId`, `phase`, `decision` (ACCEPT o REQUEST_CHANGES), `comment` |
| GET | `/sessions/:id/report` | Participante; JSON de su propio equipo |

Comandos y acciones requieren `expectedVersion` e `idempotencyKey`. Los comandos admiten START, PRACTICE, REFLECT, CLOSE, ADVANCE, PAUSE, RESUME, EXTEND, REOPEN, ITERATE y FINISH. `seconds` configura tiempo (1–14400); la práctica usa por defecto la duración de la fase del catálogo y EXTEND 300 segundos. REOPEN usa `phase` y `confirm:true`; FINISH también requiere confirmación. ADVANCE con pendientes exige confirmación. Los saltos solo se realizan por REOPEN confirmado.

`403 PHASE_LOCKED` incluye `currentPhase`, `requiredPhase`, `sessionStatus`. `409 VERSION_CONFLICT` indica que debe releerse el estado. Reutilizar una clave con otro payload devuelve `409 IDEMPOTENCY_CONFLICT`. Los reintentos de acciones participantes siguen sujetos al guard actual: un replay no autoriza otra fase.

Los comandos del conferencista se ejecutan atómicamente con auditoría e idempotencia. Los eventos se emiten después del commit. Una caída entre commit y emisión se recupera rehidratando el estado al reconectar. No hay entrega de eventos exactamente una vez ni outbox distribuido todavía.

## Reloj y reapertura

La API almacena deadline absoluto en milisegundos. La UI calcula el tiempo con `serverTime`. Pausar guarda tiempo restante y bloquea mutaciones; reanudar reconstruye deadline. Llegar a cero **no cambia ni cierra la fase automáticamente**: el conferencista dirige el taller.

Reabrir conserva el historial. Reenviar con cambios la entrega de una fase marca como «requiere revisión» las entregas posteriores, sin borrarlas; cada entregable guarda hasta diez revisiones. Las versiones generadas permanecen legibles. Una tarea debe llevar la versión de sesión original: incluso si la misma fase se reabre, una entrega con versión antigua se rechaza.

## Límites de ejecución

El modo es exclusivamente DEMO. Generación, auditoría y corrección son funciones deterministas que corren dentro de la transacción, sin llamadas externas ni jobs pendientes. El código se muestra escapado como texto; no se ejecuta, ni se crea hosting público. No se evalúan prompts como HTML o JavaScript. GO solo registra una presentación privada de la demo y su reporte.

M3 necesita una cola durable con concurrencia, cuotas, cancelación, timeouts y verificación transaccional de fase/versión al confirmar resultados. La interfaz de esta base no debe conectarse a un worker real sin esos controles.


## Equipos compartidos y estadísticas

El nombre se normaliza con Unicode NFKC, espacios consecutivos y mayúsculas/minúsculas. El primer ingreso crea el equipo; los posteriores reutilizan el mismo id. La selección del autocompletado incluye `teamId`, que se contrasta con nombre y sala. La búsqueda requiere una sesión seleccionada válida; devuelve solo nombres de equipo y cupos, sin miembros ni proyectos.

Creación/asignación y comprobación del máximo de seis se ejecutan dentro de `BEGIN IMMEDIATE`, incluyendo ingresos concurrentes. Un acceso vigente al mismo equipo se reutiliza sin sumar otro integrante; intentar cambiar de equipo con ese acceso se rechaza. Logout revoca acceso, pero no elimina la membresía ni libera el cupo. Los conteos representan accesos registrados por navegador, no personas con asistencia verificada. La recuperación por correo/horario y equipo ya está implementada en DEMO; queda pendiente verificar propiedad del correo.

Los miembros comparten proyecto y entregas. Las estadísticas cuentan equipos distintos y participantes registrados por separado; una entrega del equipo cuenta una sola vez. Las ediciones se sincronizan por SSE, con guard de fase en cada petición; todavía no es un editor colaborativo con fusión de ediciones simultáneas.

La migración a v2 conserva equipos, proyectos e identidades existentes y crea el directorio de nombres. Si ya hubiera equipos históricos con nombres equivalentes, no fusiona sus proyectos automáticamente: asigna el primer equipo registrado a los nuevos ingresos y conserva los demás para revisión manual.


## Código estadístico automático (v3)

El formulario solicita equipo y horario. El servidor resuelve la sesión y genera `statistics_code` usando su fecha/hora programadas y su id, sin depender del reloj del participante: `ING-20261118-1400-TARDE` y `ING-20261118-1800-NOCHE`. Se persiste en `sessions` con índice único, se devuelve como `statisticsCode` en estado e ingreso y se incluye en el reporte del equipo. Studio lo muestra para identificar estadísticas.

La migración agrega una columna sin cambiar ids ni relaciones de datos existentes. El código se asigna una sola vez; los reinicios conservan su valor. `join_code` se conserva para compatibilidad con clientes previos; si se envía un código legado, se valida su correspondencia. El cliente actual no lo solicita ni lo envía. El código estadístico es un identificador del evento y grupo, no un secreto ni un mecanismo de autenticación. El ingreso de participantes por sesión es público; Studio y proyector mantienen su autorización por rol.


## Notas del evento

SQLite v4 agrega `participant_notes(identity_id,session_id,content,version,updated_at)` sin modificar proyectos ni equipos. Cada participante recibe únicamente sus notas en `state.note`; Studio, proyector y otros miembros no reciben su contenido. `POST /api/notes` exige rol PARTICIPANT, texto de hasta 3000 caracteres y `expectedVersion` de la nota. El guardado es explícito, permite apuntes en WAITING y ACTIVE, y rechaza PAUSED/FINISHED. Un conflicto entre pestañas devuelve `409 NOTE_VERSION_CONFLICT`, sin sobrescribir el borrador anterior. No habilita ni completa fases del taller.

El borrador permanece en memoria al cambiar de pantalla y ante SSE; hay que guardarlo antes de recargar. Las notas se recuperan con el mismo acceso vigente; todavía aplica la limitación de recuperación al perder cookie.


## Identidad y responsabilidades del equipo (v5)

`participant_profiles` guarda nombre completo, correo normalizado, sesión, equipo y rol pedagógico. Nombre (3–120 caracteres) y correo (hasta 254, formato válido) son obligatorios al ingresar. El correo es único dentro de cada sesión; el reingreso al mismo equipo con correo/horario registrados recupera la misma identidad y rota los tokens. El acceso conserva su mecanismo de cookie existente. La propiedad del correo y el dominio institucional no están verificados todavía.

Roles automáticos en orden: Product, Tech Lead, AI Developer, QA, Security, DevOps; unicidad por equipo garantizada en DB y asignación transaccional junto a la membresía. Los roles son responsabilidades educativas, independientes de los permisos de aplicación PARTICIPANT/PRESENTER/PROJECTOR. Los accesos previos conservan su equipo y reciben un rol; al abrir de nuevo completan su perfil con la cookie vigente.

Cada participante recibe su perfil propio. El conferencista de la sesión puede consultar integrantes, nombres, correos y roles desde Studio. Proyección y búsqueda de equipos no reciben esos datos personales. Sigue pendiente la política institucional de tratamiento y retención.


### Autocompletado previo a seleccionar horario

`POST /api/team-search` admite `sessionId` opcional. Sin sesión devuelve hasta ocho coincidencias parciales de equipos de las salas no finalizadas; incluye `sessionId` y `sessionTitle` para distinguir homónimos. Con sesión, filtra por ese grupo. Solo expone nombre de equipo, grupo y cupos. Seleccionar la sugerencia completa nombre, id y horario. El ingreso sigue validando la pertenencia del equipo a la sesión elegida y el máximo de seis integrantes; buscar en varias salas no concede acceso al trabajo de ninguna de ellas.


## Recuperación de acceso y cambio de horario

Reingresar con correo normalizado, horario y equipo original recupera la misma identidad, también tras logout o pérdida de cookie. Antes de emitir el nuevo token, se revocan todos los tokens de esa identidad dentro de la transacción. Después del commit se cierran sus conexiones SSE. Dos reingresos concurrentes terminan con un solo token vigente. Una recuperación no cambia nombre, equipo, rol, entregas ni notas; un equipo lleno admite recuperar un integrante existente.

Cambiar de equipo o enviar otro `teamId` al recuperar acceso devuelve `TEAM_CHANGE_NOT_ALLOWED` y conserva los tokens válidos anteriores. Un horario distinto crea o recupera una identidad separada, sin copiar datos. En ese navegador se revoca el token participante previo; las credenciales de Studio/proyector no se alteran. Tras cierre se permite recuperar lectura, sin nuevas mutaciones ni inscripciones.

Esta recuperación DEMO no verifica la propiedad del correo. Correo + equipo no equivalen a una credencial secreta: completar SSO, enlace de verificación o credencial personal antes de tratar información sensible en operación institucional.


## Presentación manual

La presentación del evento se opera fuera de IngenIA. Se retiraron el embed, la captura, la señalización WebRTC y sus controles y endpoints. Studio y proyección conservan únicamente las funciones del taller.

## Explicación y práctica por fase

START, ADVANCE y REOPEN establecen `phaseStage: THEORY`, sin plazo activo. PRACTICE, exclusivo del conferencista y sujeto a versión/idempotencia, inicia la práctica y el cronómetro. El servidor rechaza entregas en teoría aunque se intente llamar directamente al endpoint. PAUSE/RESUME conserva el momento; EXTEND solo corresponde a la práctica. Las sesiones activas previas sin phaseStage conservan su comportamiento práctico hasta cambiar de fase.

Las notas de explicación se guardan en `presenter_phase_notes`, por sesión y fase (1–6), con versión independiente y máximo de 6000 caracteres. `POST /api/studio/sessions/:id/phase-notes` admite phase, content y expectedVersion; únicamente el conferencista de esa sesión puede escribirlas. Solo el estado de Studio contiene phaseNotes. El evento presenter.notes.updated se envía exclusivamente a conferencistas del horario. Guardar notas no altera la fase, el reloj ni la versión del taller. El cliente conserva borradores durante actualizaciones y detecta conflictos de otro Studio; recargar el navegador descarta borradores no guardados.

## Revisión de entregas en proyección

`POST /api/studio/sessions/:id/team-review` acepta SHOW (teamId), HIDE o PAGE (page), con expectedVersion independiente del taller. Solo el conferencista del horario puede operar. SHOW requiere práctica activa o pausada y entrega de la fase actual; valida equipo por sesión. Se construye una instantánea explícita con nombre del equipo, cantidad de miembros y contenido de la fase, sin perfiles ni notas privadas. El contenido largo se pagina para el lienzo 16:9. Actualizar la revisión vuelve a construir la instantánea; las entregas posteriores no cambian lo que ya se está mostrando.

La tabla team_reviews (esquema v8) persiste esa vista con versión independiente. teamReview se incluye exclusivamente en estados de Studio/proyector. team.review.updated notifica estos roles y las operaciones quedan auditadas. START, ADVANCE, REOPEN y FINISH retiran la revisión en la misma transacción. PAUSE/RESUME la conservan, sin alterar permisos ni avances de los equipos. El proyector muestra el texto escapado; ningún código de las entregas se ejecuta.

## Modelo AI-DSE (esquema v9)

`packages/shared/phases.mjs` es el catálogo único de las seis fases (id, slug, título, objetivo, teoría, misión, instrucciones, evidencia, criterio de finalización, duración y categorías de incidentes) y lo importan servidor, Studio, proyector y participantes. `packages/shared/projects.mjs` define los proyectos elegibles, las arquitecturas simuladas, las categorías de hallazgo y las decisiones de entrega.

`phaseStage` recorre THEORY → PRACTICE → REFLECTION → CLOSED. Solo PRACTICE acepta entregas y corre el cronómetro; REFLECTION y CLOSED son de lectura. ADVANCE abre la teoría de la fase siguiente. ITERATE, solo desde Verificación, vuelve a la práctica de Construcción con IA con `iteration + 1` (máximo 3) y archiva las entregas 4 y 5 de cada equipo en `project.archive`.

Cada equipo guarda `project.deliverables[fase] = { status, data, updatedAt, submittedAt, review, revisions }` con estados `draft`, `submitted`, `accepted` y `needs_review`. Solo `submitted` y `accepted` cuentan como avance. El prototipo simulado (`services/api/deliverables.mjs`) se genera según el proyecto y la arquitectura elegidos, de modo que el resultado normal siempre corresponde a lo pedido.

La migración v9 no asigna equivalencias entre modelos: las sesiones del modelo de cinco fases vuelven a WAITING con `legacyReset`, el trabajo previo de cada equipo pasa a `legacyProject` con `needsReconciliation: true` y las notas del conferencista se trasladan a `presenter_phase_notes_legacy`. Antes de migrar una base con datos ejecuta `npm run backup`.

## Incidentes (P0-11 a P0-17)

El catálogo `services/api/incidents.mjs` no se sirve como archivo estático: contiene descripciones privadas y respuestas esperadas. `incident_assignments` guarda una fila por equipo e incidente (estado `assigned` → `revealed` → `acknowledged` → `resolved`/`discussed`, origen automático o manual y respuesta). `incident_shares` guarda la intervención visible en el auditorio con versión propia.

Al pasar a práctica (PRACTICE o ITERATE) el servidor ejecuta `planAssignments`: semilla SHA-256 de sesión, equipo y fase, equipos con menos incidentes primero, máximo 2 por equipo y 1 crítico (`INCIDENT_DEFAULTS`, ajustable con `incidentConfig` en los datos de la sesión). Es idempotente y respeta las asignaciones manuales.

`POST /api/studio/sessions/:id/incidents` admite ASSIGN, UNASSIGN, REVEAL, HIDE y RESOLVE (teamId, code), y SHARE, LEARNING y END_SHARE con `expectedVersion` de la difusión. Revelar y compartir solo se permite en la fase del incidente; compartir retira la revisión de entregas en pantalla. `POST /api/sessions/:id/incident-response` (participante) registra `choice` y `justification` durante la práctica de esa fase.

Vistas: el participante recibe solo los incidentes revelados de su equipo y la retroalimentación (respuesta esperada, aprendizaje y fases de prevención) después de la reflexión o de la discusión; el proyector recibe descripción genérica, categoría, pregunta y nombre del equipo solo mientras se comparte, y el aprendizaje tras LEARNING; Studio recibe todo. Las variantes `phantom_dependency` y `requirements_mismatch` alteran la generación del equipo asignado y quedan marcadas en la versión; `assertionless_test` agrega una prueba verde sin aserciones al asignarse. Eliminar un equipo elimina sus asignaciones y retira su intervención del auditorio.

