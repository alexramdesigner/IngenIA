# TODO.md — IngenIA Studio · Taller «Crea tu primera APP con IA»

> **Especificación de implementación para Codex / equipo de desarrollo.**  
> **Base de referencia prevista:** `IngenIA_Studio_Beta_0.2_Auditorio.zip` (`index.html`, `auditorio.html`, `LEEME.md`). El ZIP no está disponible en este proyecto: su auditoría/migración sigue pendiente. El mapa visual suministrado sí fue revisado.  
> **Evento:** 18 de noviembre de 2026 · Auditorio principal, extensión Chía · Grupos 2:00–4:00 p. m. y 6:00–8:00 p. m. (hora Colombia).  
> **Identidad visual:** Universidad de Cundinamarca, logotipo horizontal blanco suministrado, verde oscuro / verde institucional / blanco / acentos lima. No sustituir ni redibujar el logotipo.
> **Activo oficial recibido:** [IMAGOTIPO_HORIZONTAL_BLANCO.png](IMAGOTIPO_HORIZONTAL_BLANCO.png), original de 1839 × 570 px. Integrado sin alteraciones en los encabezados de participante, Control Center y proyector.
> **Referencia gráfica principal:** [Mapa de experiencia con IA universitaria.png](<Mapa de experiencia con IA universitaria.png>). Aplicar a participante, Control Center y auditorio; criterios y revisión en la sección 9.

## Seguimiento actualizado · 21 de octubre de 2026

**Regla de mantenimiento:** actualizar este TODO con cada cambio funcional o visual: alcance implementado, evidencia de verificación y pendientes. Marcar `[x]` solo cuando el requisito esté cubierto; desglosar los requisitos parciales. Una prueba automatizada no sustituye aprobación visual, ensayo de carga o validación en el auditorio.

| Área | Estado actual | Pendiente principal |
|---|---|---|
| Infraestructura local | API Node 24, SQLite persistente, Git, configuración y respaldos | Validar Docker/CI y preparar despliegue remoto/TLS |
| Control de fases | Cinco fases, permisos servidor, comandos transaccionales, auditoría y SSE | Workers de IA y ensayo completo con dispositivos |
| Accesos | Participante, Studio y proyector con cookies independientes y bloqueo por rol | Verificación de propiedad del correo |
| Equipos | Hasta 6 integrantes; sugerencias, nombre canónico y proyecto compartido | Verificación de identidad y gestión administrativa |
| Visual del participante | Ingreso adaptado a la referencia; comprobado en Chrome | Aprobación del usuario y siguientes pantallas |
| Studio y proyector | Vistas funcionales; proyección 16:9 autoajustable desde Studio | Ajuste gráfico posterior y validación con proyector real |
| Simulación | Recorrido mínimo de idea a GO/NO GO y reporte privado | Completar UX, escenarios, rúbrica y funciones de M1 |

### Evidencias disponibles

- **28 pruebas automatizadas aprobadas** en la última ejecución de `npm test`: HTTP/SSE, fases, roles, aislamiento, concurrencia, persistencia, escalado 16:9 y equipos compartidos. Este número es el total de pruebas de la suite, no significa que los quince casos de aceptación estén aprobados para producción.
- `npm run check`: sintaxis de los módulos verificada.
- Ingreso revisado en Chrome a 360×800, 393×852 y 1440×1000, sin desbordamiento horizontal.
- Autocompletado probado en Chrome: escribir prefijo → ver equipo y cupos → seleccionar nombre → ingresar al mismo equipo; dos integrantes, un equipo compartido. Se usó una base temporal sin alterar equipos reales.
- [Captura del ingreso](docs/capturas/participante-ingreso-393.png) y [captura de sugerencias de equipos](docs/capturas/participante-equipos-393.png).
- Respaldo creado antes de actualizar la base a v2. Un respaldo anterior fue verificado mediante `PRAGMA integrity_check`; falta ensayo de restauración.
- Detalles: [arquitectura](docs/ARQUITECTURA.md), [operación](docs/OPERACION.md), [referencia visual](docs/REFERENCIA_VISUAL.md) y [estado por alcance](docs/ESTADO.md).

### Decisiones vigentes

- [x] Corregir METHOD_NOT_ALLOWED al borrar equipos/integrantes: el proceso local seguía ejecutando una versión anterior sin team-admin. Reiniciar con `npm run dev` para recargar cambios del servidor automáticamente. 33 pruebas aprobadas, incluida eliminación, revocación de accesos y liberación de nombre; sin borrar datos actuales para verificar.

- [x] Proyector: sustituir las tarjetas grandes de fases por indicador horizontal compacto a la derecha (cinco círculos conectados y nombres). Resaltar fase actual y distinguir las anteriores, con actualización automática; conservar la modal de revisión superpuesta.

- [x] Mostrar la revisión de equipo en el proyector como modal centrada superpuesta: conservar la vista del taller detrás, tenue con oscurecimiento y desenfoque. Mantener paginación y cierre desde Studio.

- [x] Verificación de revisión de equipos: 31 pruebas aprobadas y navegador con Studio/proyector sincronizados, sin identidad privada, paginación, persistencia al recargar, regreso al taller y contenido dentro del lienzo 1920×1080. Respaldo previo al esquema v8 creado.
- [x] Revisión pública de equipos desde Studio: **Dar la palabra y proyectar** muestra nombre del equipo, cantidad de integrantes y entrega guardada de la fase actual. Fase 1 muestra la idea; fases 2–5 muestran prototipo, auditoría, correcciones y decisión final respectivamente. Sin nombres/correos de integrantes ni notas privadas.
- [x] Revisión independiente del cronómetro y del avance: **Volver al taller**, actualizar copia proyectada y anterior/siguiente para entregas largas. Cambiar o reabrir fase, iniciar o finalizar sesión retira la revisión automáticamente. Solo Studio del horario puede elegir un equipo con entrega; instantánea persistente y versionada, sin cambios inesperados mientras habla.

- [x] Verificación de explicación/práctica: 29 pruebas automatizadas aprobadas y prueba en navegador con notas persistentes, borradores entre fases/SSE, bloqueo durante teoría y habilitación sincronizada con cronómetro. Respaldo previo a esquema v7 creado.
- [x] Cada fase comienza por **Explicación** (presentación manual externa). Studio permite **Habilitar práctica** al terminar; solo entonces arrancan el cronómetro y los permisos de la actividad existente. Avanzar o reabrir una fase vuelve a explicación; pausa/reanudación conserva el momento.
- [x] Notas privadas del conferencista por fase y horario: selector de las cinco fases, texto de hasta 6000 caracteres y guardado explícito con control de versión. Borradores conservados durante SSE y cambios de fase; guardados persistentes entre accesos. No se envían al participante ni al proyector.
- [x] Conservar las sesiones activas anteriores como prácticas hasta su próximo cambio de fase; no borrar proyectos, integrantes ni avances. Esquema v7 agrega tabla independiente de notas de Studio.

- [x] Retirar completamente la integración de Canva por decisión del usuario: sin embed, configuración, guías, captura ni transmisión. La presentación se manejará manualmente fuera de IngenIA. Conservar todos los demás avances de la plataforma.


- [x] Barra inferior del participante: fondo y borde superior hasta ambos extremos del navegador; opciones centradas con ancho máximo de 520 px y adaptación a pantallas pequeñas. Se mantiene fija, sin bordes laterales ni esquinas redondeadas.

- [x] Acercar la marca al logo en Studio y proyección: columnas ajustadas al ancho del contenido y separación de 12 px, manteniendo el título del taller a la derecha.


- [x] Conservar simultáneamente logo institucional + marca (IngenIA Studio / IngenIA) y bloque «Crea tu primera APP con IA» con su icono, al extremo derecho. La marca no sustituye al título del taller; en Studio móvil el título puede ocupar una segunda fila para mantener legibilidad.


- [x] Ajustar marca junto al logo institucional: **IngenIA Studio** en Studio y **IngenIA** en proyección. El participante conserva «Crea tu primera APP con IA». Esta decisión sustituye la unificación anterior del título del taller en los tres encabezados.


- [x] Mover el estado dinámico de conexión a la derecha del footer en participante, Studio y proyector; retirarlo del header y del título de Actividades. En el acceso del participante permanece oculto hasta ingresar.


- [x] Mantener el menú inferior del participante fijo y siempre visible después del ingreso, en todas sus pantallas, sin esquinas redondeadas y con borde únicamente superior (sin bordes laterales ni inferior). Eliminar la condición de scroll y el temporizador de tres segundos; reservar espacio para que no tape el contenido. Seguir ocultándolo en el formulario de ingreso.


- [x] Unificar el mensaje de espera «Bienvenido en un momento daremos inicio al taller.» en participante, Studio y proyector mediante una constante compartida de interfaz; conservar los estados de pausa, fase activa y finalización.


- Prioridad visual actual: **participantes**. Studio y proyector se ajustarán después de recibir sus referencias; no extender automáticamente el rediseño a esas vistas.
- Cada integrante entra desde su navegador. Sin horario se muestran coincidencias de las sesiones abiertas; al seleccionar equipo se completa la sesión y, si ya hay horario elegido, este delimita la búsqueda; seleccionar una sugerencia autocompleta el nombre e id del equipo. Si el nombre exacto normalizado existe, el servidor une al mismo equipo aunque no se seleccione la sugerencia.
- Se normalizan Unicode, mayúsculas/minúsculas y espacios; no se agrupan nombres simplemente parecidos. El séptimo integrante se rechaza desde backend, también con ingresos simultáneos.
- La estadística diferencia **equipos únicos** y **membresías registradas**. Las entregas cuentan una vez por equipo. No equivale a asistencia personal verificada.
- Recargar con cookie vigente conserva acceso y membresía. Cerrar sesión no elimina la membresía ni libera cupo; reingresar con correo y horario recupera la misma membresía y revoca el acceso anterior. No hay todavía editor colaborativo que fusione cambios simultáneos.
- Se mantiene nombre de equipo y se añade registro nominal obligatorio (nombre completo y correo institucional) por solicitud del usuario; ya no se solicita código de sala. El servidor asigna un código estadístico por fecha del evento y sesión. Los términos institucionales, retención y verificación de correo siguen pendientes; el correo declarado todavía no se verifica por enlace.

### Bitácora · 21 de octubre de 2026

1. Base local: API, persistencia, dos salas, autenticación, máquina de fases, demo mínima, pruebas y documentación operativa.
2. Referencias: mapa de experiencia y logo oficial conservados; logo integrado sin alterar en las tres vistas.
3. Separación de pantallas: `/` participante, `/studio` conferencista (`/presenter` como alias), proyector abierto desde Studio en pestaña independiente y lienzo 1920×1080 con escala uniforme.
4. Primera pantalla del participante: encabezado compacto, tarjeta clara, iconos, selector de horario y CTA lima; estilos aislados en `participant.css`.
5. Equipos: autocompletado por sala, máximo seis integrantes, proyecto/entregas compartidos, estadísticas sin duplicar equipo y migración conservadora a SQLite v2.
6. Ingreso simplificado: retirar código manual y asignar identificador estadístico persistente por fecha del evento y sesión, con aislamiento de equipos conservado.
7. Consolidación del TODO: avance comprobado marcado y pendientes conservados, sin declarar completada la preparación del taller.

## 0. Principio rector — BLOQUEO ABSOLUTO POR FASE (P0)

**Las cinco fases de aprendizaje se habilitan únicamente por acción autenticada del CONFERENCISTA en el Control Center.** No basta con desactivar u ocultar botones del frontend: **toda operación protegida debe ser autorizada por el backend** con la fase activa, la sesión y el rol.

1. **Ideación:** definir equipo, elegir tipo de app, redactar y mejorar el prompt (sin generar aún).
2. **Generar app:** generar prototipo simulado o asistido por IA, visualizar app/código e iterar con límites configurables.
3. **Auditar:** ejecutar auditoría educativa controlada, explorar hallazgos y documentar riesgos.
4. **Corregir:** aplicar mejoras, comparar antes/después y verificar mitigaciones.
5. **Publicar:** revisar checklist final, decidir GO / NO GO, publicar **solo en sandbox/demo** o presentar el resultado, y generar reporte.

### Invariantes obligatorios

- [x] La sesión empieza en estado `WAITING`, sin ninguna fase ejecutable; la pantalla del participante muestra bienvenida e instrucciones de espera.
- [x] Solo el rol `PRESENTER` autorizado para esa sesión puede activar/cambiar la fase desde el backend.
- [x] El estado de la fase es **único por sesión** y se comparte en tiempo real entre todas las personas, equipos y proyector.
- [x] Por defecto, únicamente la **fase activa** admite nuevas acciones; las anteriores quedan en modo lectura, y las futuras están bloqueadas. Un modo de reapertura requiere decisión explícita del conferencista.
- [x] No se puede generar la app durante Ideación; ni auditar antes de Auditar; ni corregir antes de Corregir; ni publicar antes de Publicar, aunque alguien invoque APIs manualmente.
- [x] El avance individual o la finalización anticipada **no cambia** la fase global ni desbloquea pasos futuros.
- [ ] Al terminar pronto, mostrar «¡Actividad completada! Espera las indicaciones del conferencista», progreso personal y una actividad opcional **dentro de la fase actual**, nunca una acción futura.
- [x] Toda acción bloqueada responde con `403 PHASE_LOCKED` y metadatos seguros (`currentPhase`, `requiredPhase`, `sessionStatus`); el frontend muestra un aviso claro sin filtrar material de fases futuras.
- [x] Al cambiar fase, actualizar clientes conectados por WebSocket/SSE y validar el estado de nuevo en cada petición HTTP.
- [x] Si el conferencista pausa la sesión, bloquear operaciones que muten el trabajo; permitir lectura e indicar «Sesión en pausa». Reanudar solo desde Control Center.
- [ ] Al terminar/cerrar sesión, impedir nuevas mutaciones y conservar reporte/evidencias según la política de retención.
- [x] Cada cambio lleva registro auditable de usuario, sesión, fase anterior/nueva, fecha, razón opcional y número de versión.

### Semántica de cambios de fase

- [x] Acciones del presentador: **Iniciar fase 1**, **Avanzar**, **Pausar/Reanudar**, **Extender tiempo**, **Retroceder/Reabrir fase** (con confirmación) y **Finalizar sesión**.
- [x] Avanzar solo de `N` a `N+1` por defecto; saltos y retrocesos requieren confirmación especial y se registran.
- [ ] Ofrecer antes de avanzar un resumen: equipos que completaron, equipos activos, rezagados y pendientes; permitir avanzar aunque existan rezagados con confirmación.
- [x] Si se retrocede, no borrar entregables; definir política clara de edición/revalidación y bloquear acciones de fases superiores mientras se revisa.
- [x] Evitar conflictos por doble clic o dos controles simultáneos mediante versión optimista/operación atómica, clave de idempotencia y confirmación de estado.
- [ ] Una operación ya iniciada cuando se cierra la fase no debe producir efectos posteriores no autorizados: cancelar trabajos pendientes cuando sea posible; para resultados tardíos, marcarlos como no aplicables y evitar que alteren entregables/puntuaciones sin autorización.

## 1. Auditoría técnica de Beta 0.2 y estructura del proyecto (P0)

- [ ] Conservar una copia inalterada del ZIP como referencia y registrar diferencias con la nueva implementación.
- [ ] Documentar lo que **sí existe**: inscripción simulada, estudio local, generador educativo, preview, código, pestañas de auditoría/historial, puntuación GO/NO GO, Control Center, proyector y temporizador.
- [ ] Documentar limitaciones de la **Beta 0.2** cuando se reciba. La implementación actual ya tiene backend, autenticación, equipos compartidos, autorización y sincronización; aún no tiene IA externa, pagos, auditoría real de seguridad ni hosting público de prototipos.
- [x] Retirar cualquier dependencia de `localStorage` como fuente de verdad para sala/fase/roles; usarlo solo para preferencias no sensibles.
- [x] Crear estructura modular: `apps/participant`, `apps/presenter`, `apps/projector`, `services/api`, `packages/ui`, `packages/shared`.
- [ ] Migrar y contrastar la Beta 0.2 cuando se suministre el ZIP.
- [x] Configurar Git local, README, `.env.example`, scripts de desarrollo, arranque, pruebas y backup; secretos excluidos del frontend/repositorio.
- [x] Preparar Dockerfile, Compose con persistencia y workflow de CI.
- [ ] Ejecutar y validar Docker/CI, y configurar el despliegue remoto con TLS.
- [x] Crear contratos API/eventos tipados y definir el esquema de datos antes de construir pantallas nuevas.

## 2. Sesiones, roles, acceso y equipos (P0)

### Identificación nominal y roles de equipo

- [x] Mostrar el rol propio bajo el saludo en Actividades y sustituir el avatar genérico por un distintivo hexagonal con icono Phosphor duotono específico: Product (azul/violeta), Tech Lead (violeta), AI Developer (verde), QA (azul), Security (magenta), DevOps (amarillo). Mantener el nombre del rol en texto, además de icono/color.


- [x] Añadir campos obligatorios de nombre completo y correo institucional, conservando nombre de equipo, horario y confirmación de simulación educativa.
- [x] Guardar perfil por participante/sesión en SQLite v5, con correo normalizado único por sesión; rechazar duplicados sin entregar acceso a partir del correo solamente.
- [x] Asignar automáticamente, sin repetir por equipo y en orden de ingreso: Product, Tech Lead, AI Developer, QA, Security, DevOps. Estos roles no cambian permisos PARTICIPANT ni habilitan fases.
- [x] Mostrar nombre, correo y rol propio en Perfil; permitir al conferencista revisar integrantes/roles en Studio, sin mostrarlos en proyección o sugerencias públicas.
- [x] Migrar miembros anteriores sin borrar proyectos ni notas; asignar roles y pedir completar nombre/correo al volver a ingresar con su cookie vigente.
- [x] Comprobar roles únicos, identidad, privacidad y duplicados con la suite de 18 pruebas.
- [ ] Verificar propiedad/dominio del correo institucional; por ahora se valida formato y unicidad del correo declarado.
- [ ] Acordar y publicar política de datos personales, finalidad, acceso, retención y tratamiento institucional antes de operar el evento real.

### Reingreso y cambios de equipo/sesión

- [x] Recuperar la identidad original por correo normalizado y horario; conservar nombre, equipo, rol, notas y proyecto. El formulario mantiene los mismos campos.
- [x] Revocar todos los tokens anteriores de la identidad y emitir el nuevo dentro de una transacción; cerrar sus conexiones SSE tras confirmar el cambio.
- [x] Rechazar cambios de nombre/id del equipo al recuperar acceso, sin revocar la sesión válida ni mover datos. Los cambios administrativos de equipo siguen fuera de alcance.
- [x] Cambiar de horario crea o recupera una inscripción independiente, sin trasladar trabajo, notas, roles ni integrantes entre salas. Revocar el token del participante anterior si se usa ese mismo navegador.
- [x] Permitir recuperar una membresía aunque el equipo ya tenga seis integrantes; rechazar al séptimo nuevo.
- [x] Recuperar acceso después de logout, pausa y finalización; conservar bloqueos de mutación y modo lectura al cerrar el taller.
- [x] Probar recuperación sin cookie, revocación HTTP y SSE, equipo lleno, dos recuperaciones simultáneas, equipo distinto, id manipulado, correo distinto, horario inexistente y regreso al horario original. Suite total: 26 pruebas.
- [ ] Validar el recorrido de revocación y reingreso con varios navegadores reales.

**Límite del modo DEMO:** la recuperación utiliza correo declarado, horario y equipo, sin comprobar todavía la propiedad del correo. No debe presentarse como identidad verificada. Antes de operación institucional, añadir verificación por correo, SSO o credencial personal; no exponer información sensible bajo este mecanismo de recuperación.

### Equipos de hasta seis integrantes

- [x] Corregir autocompletado antes de seleccionar horario: al escribir, mostrar hasta ocho coincidencias parciales con nombre, grupo y cupos. Seleccionar una sugerencia completa nombre, id y sesión. Si ya se eligió horario, limitar coincidencias a ese grupo. Excluir sesiones finalizadas y mantener validación de pertenencia/capacidad al ingresar.
- [x] Probar búsqueda sin horario, coincidencia en medio del nombre, filtrado por grupo y exclusión de sesiones cerradas (suite: 19 pruebas).


- [x] Crear o unirse al mismo equipo por nombre normalizado y sala, sin duplicar equipo por mayúsculas o espacios.
- [x] Autocompletar mediante sugerencias del equipo existente al escribir, según la sesión seleccionada; mostrar cupos ocupados y equipos completos.
- [x] Limitar a seis membresías por equipo desde backend, incluso con ingresos simultáneos.
- [x] Compartir proyecto y entregas entre integrantes; contar equipos una sola vez y participantes por separado.
- [x] Conservar datos anteriores con migración del directorio de nombres; reutilizar acceso vigente al mismo equipo sin sumar otro miembro.
- [x] Recuperar acceso por correo y sesión manteniendo membresía, equipo y rol; revocar tokens y conexiones SSE anteriores sin ocupar otro cupo.


- [x] Modelar **dos sesiones independientes**: 14:00–16:00 y 18:00–20:00; aislamiento de equipos, datos, fases y cronómetros verificado.
- [ ] Implementar ranking configurable; no hay ranking todavía.
- [x] Roles mínimos: `PRESENTER`, `PARTICIPANT`, `PROJECTOR`, `ADMIN` opcional. Proyector es solo lectura; participante no obtiene funciones de consola.
- [ ] Crear salas con `sessionId`, código/QR, estado, fase, versión, reloj, configuraciones y cupos.
- [ ] Implementar ingreso por QR/código corto a la **sesión correcta**, con protección ante suplantación; definir si hay registro nominal o seudónimo.
- [ ] Crear/asignar equipos y gestionar miembros, evitando duplicados; permitir modalidad individual si hay participantes sin equipo.
- [x] Añadir capacidad de reconexión conservando sesión, equipo, trabajo y fase actual.
- [x] Proteger Control Center con contraseña de entorno, autorización por sesión, cookie HttpOnly, expiración y revocación al cerrar acceso.
- [ ] Añadir cuentas individuales de conferencistas y revocación administrativa.
- [x] Restringir la pantalla de auditorio a datos públicos/anonimizados y un token limitado de solo lectura si accede remotamente.
- [x] Establecer límites de uso y validación de entradas para evitar abuso durante el evento.

## 3. Motor de fases centralizado (P0)

- [x] Crear máquina de estados: `WAITING → ACTIVE(1..5) → FINISHED`, con estado adicional `PAUSED`; persistir fase y estado de sesión.
- [x] Exponer endpoint autenticado para comandos del presentador `POST /sessions/:id/phase-command` con `action`, `expectedVersion`, `idempotencyKey`.
- [x] Exponer `GET /sessions/:id/state` para hidratación y reconexión; devolver permisos efectivos para el rol actual.
- [x] Eventos tiempo real: `session.started`, `phase.opened`, `phase.closed`, `session.paused`, `session.resumed`, `session.finished`, `timer.updated`, `team.progress`.
- [x] Implementar `requireActivePhase` reusable y aplicarlo a todas las rutas protegidas actuales.
- [ ] Aplicar el guard y la versión original de sesión a cada futuro worker antes de confirmar resultados.
- [ ] Impedir bypass vía URL directa, peticiones HTTP manipuladas, cliente antiguo, reenvío de formularios, replay y tareas asíncronas.
- [x] Gestionar fase mediante versionado monotónico y transacciones; emitir eventos solo después de confirmar la transacción.
- [x] Mostrar a todos `Fase N/5`, título, misión, estado y tiempo restante; si hay desfase de red, prevalece el servidor.
- [ ] Definir permisos precisos para actividades paralelas (preguntas, ayuda, encuesta): no deben activar contenido de etapas futuras.

### Matriz de autorización por defecto

| Acción del participante | Espera | 1 Ideación | 2 Generar | 3 Auditar | 4 Corregir | 5 Publicar |
|---|---|---|---|---|---|---|
| Ver misión/agenda/fase actual | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Editar idea/prompt | — | ✓ | Lectura | Lectura | Lectura | Lectura |
| Lanzar generación de app | — | — | ✓ | — | — | — |
| Ver prototipo ya generado | — | — | ✓ | ✓ | ✓ | ✓ |
| Iniciar auditoría | — | — | — | ✓ | — | — |
| Solicitar/aplicar correcciones | — | — | — | — | ✓ | — |
| Checklist final + GO/NO GO + publicar demo | — | — | — | — | — | ✓ |

> ✓ acción autorizada; — acción no autorizada. **Siempre** verificar requisitos del equipo (por ejemplo, prototipo existente para auditar) además de la fase. El acceso de lectura histórico puede afinarse por privacidad, sin permitir ejecutar nuevas acciones previas.

## 4. Pantallas del participante (P0–P1)

### Ajuste visual de ingreso del participante

- [x] Retirar del header del participante el badge «DEMO · Simulación educativa» y el estado de conexión; mover el estado dinámico al badge a la derecha de «Actividades», sustituyendo «DEMO». Mantener avisos de simulación en formulario y contenido educativo, y mostrar reconexión cuando corresponda.


- [x] Alinear el bloque de icono y título del taller al extremo derecho del header, con texto alineado a la derecha y logo institucional a la izquierda.


- [x] Conservar el campo de equipo y el recuadro superior por indicación final del usuario; retirar los textos «Selecciona el horario y escribe el comienzo del nombre de tu equipo» y «Tu rol se asignará automáticamente según los cupos…», incluida la variante inicial de ayuda del horario. Mantener autocompletado, errores y asignación de roles. No mover la selección de equipo a otra pantalla.


- [x] Cambiar el aviso de espera en Actividades del participante por «Bienvenido en un momento daremos inicio al taller.», manteniendo los estados de pausa, fase activa y finalización.


- [x] Retirar el campo «Código de sala» del formulario y su requisito para buscar equipos. Resolver ingreso y autocompletado con el horario seleccionado.
- [x] Generar y persistir un código estadístico a partir de la fecha/hora programadas del evento y la sesión: `ING-20261118-1400-TARDE` / `ING-20261118-1800-NOCHE`. Mostrarlo en Studio e incluirlo en el reporte del equipo. Es un identificador de estadísticas, no una contraseña.
- [x] Mantener los ids de sala, equipos, membresías y proyectos existentes; añadir `statistics_code` mediante migración a SQLite v3, conservando el código antiguo para compatibilidad.
- [ ] Actualizar capturas del formulario sin campo de código y verificar el recorrido visual completo.


- [x] Mover icono y «Crea tu primera APP con IA» al header, a la **derecha del logo de la Universidad**, en la misma fila; eliminar su duplicado del cuerpo. Usar columnas fluidas, tamaños adaptables y mantener las proporciones del logo.
- [x] Ampliar el contenido para tablet/desktop y distribuir las tarjetas de actividades en cuatro columnas desde 768 px; mantener dos en móvil.
- [ ] Verificar con capturas la última distribución de encabezado y contenido en celular, tablet y escritorio.


- [x] Mostrar en el recuadro superior del ingreso: «Máximo 6 integrantes por equipo, cada uno desde su navegador. Selecciona el mismo equipo y conserva tu acceso.». Retirar el texto duplicado de debajo del formulario y el aviso de cambio de rol del ingreso del participante; mantener los errores de validación.


- [x] Adaptar la pantalla «Únete al taller» a la referencia móvil recibida: logo compacto, fondo verde profundo, tarjeta clara, iconos y CTA lima de ancho completo.
- [x] Mantener seudónimo del equipo y selector de horario; resolver la sesión desde backend sin solicitar código al participante. Actualizado por petición del usuario: añadir nombre completo y correo institucional; la verificación de correo y política de datos siguen pendientes.
- [x] Aplicar los estilos en `packages/ui/participant.css`, sin modificar la presentación de Studio ni del proyector.
- [ ] Validar con el usuario esta primera pantalla antes de extender el diseño a las siguientes referencias.

### Comunes (P0)
- [ ] Bienvenida/espera: QR válido, nombre de sesión, instrucciones y estado «Esperando al conferencista».
- [x] Inicio: fase actual, misión, cronómetro, equipo, avances, aviso de pausa y botón contextual de la fase.
- [ ] Mapa de cinco fases: activa destacada; futuras con candado + «Se habilita durante la explicación»; anteriores en lectura.
- [ ] Centro de ayuda: instrucciones cortas, preguntas al conferencista y problemas de conexión.
- [ ] Estados de carga, errores, espera, reconexión y cierre sin pérdida de trabajo.

### 1. Ideación (P0)
- [ ] Pantalla «Tu equipo y tu idea»: nombre del equipo, categoría (eventos/reservas, tareas, vitrina, etc.) y público objetivo.
- [ ] Editor de prompt con plantilla guiada: problema, usuario, funcionalidades, datos y requisitos básicos de seguridad.
- [x] Botón «Mejorar prompt» (plantillas deterministas en modo demo; IA opcional si está disponible), sin generar código.
- [ ] Guardado automático con validación y marca «Idea lista»; esperar autorización para Generar app.

### 2. Generar app (P0)
- [ ] Botón «Generar prototipo» habilitado solo en fase 2, con límites de iteración configurables.
- [ ] Simulador con resultados seguros y reproducibles para categorías soportadas; diferenciar claramente generación simulada de IA real.
- [ ] Pantallas «Vista previa» y «Código» en pestañas; explicaciones claras de qué hace cada componente.
- [ ] Entorno aislado para previews activos, sin acceso a secretos ni a red sensible; ofrecer preview estático cuando no haya ejecución.
- [x] Historial/versiones para comparar iteraciones y preservar el código que se auditará.
- [ ] Entrega «Prototipo listo» con resumen; mensaje de espera hasta fase 3.

### 3. Auditar (P0)
- [ ] Pantalla «Auditoría / Red Team» con escenario educativo elegido por el conferencista.
- [ ] Hallazgos controlados: credencial incrustada, falta de autorización, exposición de datos en registros; explicar gravedad, evidencia y consecuencia.
- [ ] Ejercicio «Detecta el riesgo»: elegir hallazgos y justificar, sin herramientas para atacar servicios reales.
- [ ] Guardar respuestas y resultados para puntaje; sin habilitar correcciones hasta fase 4.
- [x] Diferenciar «simulación de vulnerabilidad» de análisis de seguridad verificable; no afirmar que un prototipo es seguro por una lista simulada.

### 4. Corregir (P0)
- [ ] Pantalla «Corrección / Blue Team»: sugerencias por hallazgo, código antes/después y explicación.
- [x] Botón «Aplicar corrección» exclusivamente en fase 4; registrar cambios y versiones.
- [ ] Revalidación educativa contra reglas/fixtures; marcar mitigaciones verificadas y pendientes.
- [ ] Resumen de mejoras y nueva puntuación; detenerse antes de publicación.

### 5. Publicar (P0)
- [ ] Pantalla «Checklist final»: funcionamiento, errores relevantes, autorización, privacidad, registros, justificación de riesgos.
- [x] Pantalla «Decisión GO / NO GO» con justificación y veredicto del equipo.
- [x] «Publicar» significa **presentación/publicación de prototipo en entorno de demostración aislado**, nunca despliegue público por defecto.
- [ ] Vista de entrega final con enlace temporal seguro de demo (si existe), reporte descargable y pantalla de felicitación.
- [ ] Resumen de aprendizaje: idea → app → hallazgos → correcciones → decisión final.

### Complementarias (P1)

- [x] Reemplazar el acceso duplicado «Retos» por **Notas del evento**, conservando Taller como único acceso desde las tarjetas al proyecto del equipo. Usar icono Phosphor de bloc de notas.
- [x] Añadir pantalla de apuntes personales con guardado explícito de hasta 3000 caracteres y persistencia por identidad/sesión en SQLite v4. No compartir notas con otros miembros, Studio o proyector.
- [x] Conservar borrador de notas al navegar entre pantallas o recibir SSE; bloquear guardado en pausa/cierre y detectar versiones obsoletas entre pestañas. El borrador sin guardar se pierde al recargar.
- [x] Verificar por pruebas API privacidad, guardado, límite, conflictos de versión y lectura tras cierre.
- [ ] Validar la nueva pantalla de notas visualmente en celular, tablet y escritorio.

- [ ] Recursos, preguntas en vivo, encuesta de experiencia, perfil y avance.
- [ ] Certificado de participación condicionado a reglas institucionales y asistencia **realmente verificada**; no emitir automáticamente por completar una simulación.
- [x] Formato de reportes exportables sin exponer datos personales de otros equipos.

## 5. Control Center del conferencista (P0)

### Presentación manual

- [x] Integración de Canva descartada y retirada (embed y piloto de transmisión incluidos). Sin pruebas ni tareas pendientes de Canva. El conferencista maneja la presentación manualmente fuera de la plataforma.

- [x] Login y selección de grupo/sesión; aviso visible de entorno demo vs real.
- [ ] Dashboard: fase y estado actual, cronómetro, asistentes/equipos conectados, completados, en curso, rezagados, errores de conexión.
- [x] Control grande y claro **«Habilitar fase siguiente»**, con confirmación que indique qué quedará disponible y qué se bloqueará.
- [ ] Vista de fases 1–5, con objetivos, guion/explicación del conferencista, tiempo sugerido, demo de referencia y criterio de cierre.
- [x] Botones **Pausar**, **Reanudar**, **Extender**, **Retroceder/Reabrir** y **Finalizar** con permiso exclusivo.
- [ ] Gestión de escenarios educativos de auditoría para decidir cuándo se inyecta cada ejemplo (sin modificar proyectos de otros equipos inadvertidamente).
- [x] Selector del equipo cuya entrega de fase se proyecta, activado manualmente al darle la palabra; excluir datos de identidad y notas privadas.
- [ ] Monitor de participantes y preguntas moderadas, sin mostrar datos personales en el proyector.
- [ ] Mostrar estado de conexiones WebSocket, salud del backend/IA, latencia y fallback activo.
- [ ] Comando de emergencia «Pausar todo» y modo contingencia ante caída de Internet o servicio de IA.
- [x] Todas las decisiones del conferencista quedan registradas para evaluación y mejora del taller.

## 6. Pantalla de auditorio / proyector (P0)

- [x] Sustituir el botón de pantalla completa por control compacto de 38×38 px con icono de 20 px, borde blanco y fondo transparente, translúcido en reposo y opaco al pasar el cursor o recibir foco. Alternar iconos expandir/encoger, título y etiqueta accesible según `fullscreenchange`, incluido salir con Escape.


- [x] Separar accesos de participante, Studio y proyección mediante cookies por rol y autorización backend; retirar enlaces a consola/proyección del ingreso estudiantil.
- [x] Abrir proyección desde Studio en una pestaña nueva del mismo navegador, con acceso de solo lectura sin reemplazar la sesión del conferencista.
- [x] Implementar lienzo 1920×1080, escala uniforme automática al redimensionar y botón de pantalla completa; conservar 16:9 mediante bandas cuando corresponda.
- [ ] Validar visualmente en navegador y proyector real el lienzo 16:9, el cambio de monitor y la pantalla completa.

- [ ] Vista exclusiva 16:9, tipografía grande, contraste alto, logotipo institucional blanco.
- [x] Mostrar fase actual **entre las cinco**: Ideación, Generar app, Auditar, Corregir, Publicar.
- [x] Misión y explicación breve; «Fase bloqueada / Esperando conferencista» al inicio; «Pausa» si corresponde.
- [x] Cuenta regresiva controlada por el presentador, basada en reloj del servidor.
- [ ] Progreso de equipos, ranking opcional y feed moderado sin datos sensibles; señalizar explícitamente métricas sintéticas en modo demo.
- [x] Cambios sincronizados sin recargar página; si se pierde conexión, pantalla de estado y reintento automático.
- [ ] Modo de explicación: esconder ranking/distracciones mientras el conferencista expone teoría o guía un ejemplo.

## 7. Arquitectura sugerida (P0)

- [ ] Frontend web responsive/PWA para participantes; escritorio para Control Center; proyección 16:9 para auditorio.
- [ ] Backend API y WebSocket/SSE como **autoridad única** para fases, permisos, equipos, timer, scoring y acciones.
- [x] Base de datos persistente (por ejemplo, PostgreSQL) con transacciones; cache/pubsub opcional si se usan varias instancias.
- [ ] Jobs de generación/auditoría/corrección en cola, idempotentes, con límites de concurrencia, tiempo y presupuesto.
- [ ] Modo `DEMO` reproducible sin IA externa y modo `AI_ASSISTED` opcional con adaptadores, cuotas y políticas de privacidad.
- [ ] Prototipos ejecutables solo en sandboxes aislados, con aislamiento de procesos, límites de CPU/memoria/tiempo, sin credenciales y sin salida de red innecesaria.
- [ ] Agregar observabilidad: logs estructurados, métricas de errores, trazas y alertas, sin incluir prompts con información privada en registros innecesarios.
- [ ] Cumplir buenas prácticas de tratamiento de datos personales y reglas acordadas con la Universidad antes de recolectar información real.
- [ ] UI accesible: contraste, etiquetas, estados de enfoque, lectura en móvil y pantallas de ayuda.

### Esquema mínimo sugerido

- `users` / `roles` / `presenter_session_permissions`
- `sessions(id, startAt, endAt, status, activePhase, version, timerState, mode)`
- `teams(id, sessionId, name)` y `team_members(teamId, participantId)`
- `projects(id, teamId, idea, prompt, status, selectedScenario)`
- `project_versions(id, projectId, phase, artifactRef, sourceMode, createdAt)`
- `findings(id, projectVersionId, kind, severity, evidenceRef, status)`
- `fixes(id, findingId, resultVersionId, verifiedStatus)`
- `phase_actions(id, sessionId, actorId, action, fromPhase, toPhase, sessionVersion, timestamp)`
- `submissions(id, teamId, phase, payloadRef, completedAt)`
- `scores(id, teamId, rubricVersion, result)` y `event_feed(id, sessionId, type, payload)`

## 8. Reglas de producto y experiencia pedagógica (P0)

- [ ] Todas las pantallas responden a «¿Qué hago ahora?» y «¿Qué espero del conferencista?».
- [ ] Cada fase presenta tres momentos: **Explicación del conferencista → Ejercicio habilitado → Espera/revisión**; solo el conferencista avanza.
- [ ] Para no castigar a quien termina rápido, ofrecer mejoras opcionales seguras **de la misma fase** (p. ej., refinar la descripción, examinar código generado, explicar una vulnerabilidad), sujetas al tiempo y límites de uso.
- [ ] Para quien va lento, conservar el trabajo y permitir al conferencista habilitar una recuperación o aplicar un ejemplo de rescate **sin abrir fases futuras**.
- [ ] Proponer tiempos configurables para cada sesión de dos horas; no imponer una duración fija por fase.
- [ ] Asegurar que todas las tareas pueden realizarse desde el asiento en celular, con interacción opcional en equipos, sin desplazamientos por el auditorio.
- [ ] Ranking opt-in/configurable y criterios transparentes; no premiar solo rapidez, sino explicación, calidad, detección y corrección.
- [ ] La metodología de la experiencia puede documentar objetivos de aprendizaje, evidencia por fase y retroalimentación, sin presentar el prototipo como una certificación técnica o una auditoría real.

## 9. Diseño visual institucional (P1)

### Principio rector de diseño: entre más simple, mejor

**Toda la plataforma debe ser lo más limpia y simple posible. Muchos elementos confunden al usuario.** Priorizar la tarea principal, con jerarquía clara y únicamente la información que ayude a decidir qué hacer o a comprender el estado actual.

- [x] Retirar los badges persistentes «DEMO · Simulación educativa» de Studio y proyección, y las etiquetas técnicas `PRESENTER`, `PROJECTOR`, `PARTICIPANT` y versión de sesión (`v0`, etc.) del encabezado de contenido. Mantener el nombre de la sesión.
- [ ] Aplicar esta premisa en cada pantalla nueva y revisión: evitar badges decorativos, instrucciones repetidas, metadatos técnicos y acciones duplicadas; reducir antes de añadir.
- [ ] Mantener mensajes breves y contextuales de error, pausa o conexión cuando ayuden al usuario; conservar la identificación de capacidades simuladas junto al contenido educativo correspondiente, sin repetirla como adorno en toda la interfaz.



### Referencia gráfica principal y alcance

- [x] Registrar la imagen original **`Mapa de experiencia con IA universitaria.png`**, conservada en la raíz del proyecto, como referencia de la línea gráfica de toda la aplicación.
- [x] Revisar visualmente la referencia frente a la implementación inicial y documentar diferencias en [docs/REFERENCIA_VISUAL.md](docs/REFERENCIA_VISUAL.md).

[Ver imagen original](<Mapa de experiencia con IA universitaria.png>)

![Referencia gráfica de IngenIA: pantallas del participante, Control Center y auditorio](<Mapa de experiencia con IA universitaria.png>)

**Regla de interpretación:** la imagen define la dirección visual y la composición de las pantallas; las reglas de fases, permisos, privacidad y veracidad del presente TODO siguen vigentes. Las diez pantallas del participante no equivalen a diez fases. El esquema de seis etapas dibujado en la consola debe adaptarse a las **cinco fases oficiales**: Ideación, Generar app, Auditar, Corregir y Publicar. La referencia no habilita IA real, certificación de seguridad, despliegue a producción ni certificados automáticos.

### Activo institucional incorporado

- [x] Unificar el encabezado de participante, Studio y proyección con el bloque «Crea tu primera APP con IA» y su icono Phosphor, a la derecha del logo institucional. Mantener alineación derecha, tamaños responsive en Studio y escala adecuada dentro del lienzo 16:9 del proyector.


- [x] Reforzar el overlay del fondo institucional (opacidad 78 % a 68 %) y aplicar blur de 6 px en una capa independiente, manteniendo nítidos texto, formularios, navegación y controles en participante, Studio y proyector.


- [x] Conservar «Fondo Verde Tecnológico Arquitectónico.png» original y usar una copia idéntica en `packages/ui/assets/fondo-verde-tecnologico.png` como fondo de participantes, Studio y lienzo de proyección. Ajustar con `cover`, sin deformación ni repetición, y superponer una capa oscura para legibilidad. Mantener las bandas negras externas al lienzo 16:9.
- [ ] Revisar en dispositivos y proyector reales el encuadre y contraste con el nuevo fondo institucional.


- [x] Conservar `IMAGOTIPO_HORIZONTAL_BLANCO.png` original e incorporar una copia idéntica en `packages/ui/assets/` para servirla en las tres vistas, con proporciones originales, texto alternativo y espacio de separación.
- [ ] Validar en navegador la legibilidad del imagotipo en móvil, escritorio y proyección; comprobar su área de protección con el manual institucional.

### Iconografía unificada · Phosphor Icons

- [x] Seleccionar [Phosphor Icons](https://github.com/phosphor-icons/core), variante sólida (`fill`) para tarjetas y navegación, y regular para flechas y pantalla completa.
- [x] Sustituir símbolos sueltos/SVG manuales por 14 iconos de la misma familia: trofeo en Retos, chat en Preguntas, carpeta en Taller y barras en Encuesta; amarillo/lima y verde según referencia.
- [x] Unificar también iconos de formulario, avatar, encabezado, menú inferior, flechas y expandir/encoger proyección; conservar etiquetas accesibles en los controles.
- [x] Integrar SVG locales generados en `packages/ui/icons.mjs`, sin CDN, con versión exacta en package-lock y licencia MIT conservada. Regeneración: `npm ci` y `npm run icons`.
- [ ] Validar visualmente con el usuario el estilo final de los iconos frente a la referencia.

### Criterios para alinear toda la línea gráfica

- [ ] Encabezado institucional: imagotipo horizontal blanco oficial, área de protección, fondo verde profundo y jerarquía clara entre marca, título y etiqueta de simulación. Usar el archivo oficial independiente; no recortar ni redibujar el logo desde este mapa.
- [ ] Paleta: verde casi negro de fondo, verde institucional en superficies, blanco/gris muy claro en formularios y resultados, lima intenso en CTA y estado activo. Centralizar tokens; los valores aproximados se detallan en la guía y no sustituyen el manual institucional.
- [ ] Contraste de superficies: combinar estructura oscura con tarjetas claras de contenido, bordes verdes finos, radios consistentes y sombras discretas; evitar que toda la interfaz sea una sucesión de paneles oscuros iguales.
- [ ] Tipografía: sans serif, títulos de peso alto, textos breves y etiquetas legibles; definir escala responsive para móvil, escritorio y proyección. La familia exacta requiere el manual o archivo tipográfico oficial.
- [ ] Componentes: CTA lima de ancho completo en móvil, acciones secundarias verdes, campos claros, pestañas segmentadas, badges compactos, iconos de una misma familia y navegación consistente con la referencia.
- [ ] Participante: composición móvil con encabezado compacto, tarjetas apiladas y navegación inferior; adaptar a web responsive sin dibujar marcos de teléfono alrededor de la aplicación real.
- [ ] Control Center: estructura de escritorio con navegación lateral, tarjetas compactas para fase y reloj, recorrido de cinco fases y paneles de equipos/actividad. Mantener confirmaciones y acciones exclusivas del conferencista.
- [ ] Proyector: composición 16:9, encabezado institucional, fase y cronómetro dominantes; misión y progreso legibles desde el auditorio, sin nombres personales ni información privada.
- [ ] Auditoría/corrección: distinguir Red Team mediante escudo y señal de riesgo, y Blue Team mediante escudo/estado de mitigación; complementar siempre el color con texto e iconos. Conservar la etiqueta «simulación educativa».
- [ ] Resultado: usar la jerarquía de logro y resumen de la referencia, pero mostrar GO/NO GO para **demo privada**, sin afirmar «lista para producción» ni seguridad verificada por la simulación.
- [ ] Implementar y revisar estados activo, bloqueado, lectura, completado, pausa, reconexión y error en los mismos componentes; diferenciar fase habilitada de entrega completada.
- [ ] Revisar todas las vistas con capturas comparativas: participante a 360 y 390 px, Control Center a 1440 px y proyector a 1920×1080. Comprobar foco, contraste, zoom y ausencia de desbordamientos.
- [ ] Registrar evidencias de revisión visual antes de marcar la alineación gráfica como completada. La revisión inicial documentada **no equivale** a conformidad de las pantallas actuales.

### Checklist visual original

- [ ] Definir tokens: verde oscuro, verde institucional, blancos, lima para CTA/estado activo, ámbar para alerta y rojo solo para riesgos/bloqueos.
- [ ] Usar el **imagotipo horizontal blanco oficial proporcionado**, sin distorsionar proporciones y con margen de seguridad.
- [ ] Crear sistema consistente de cards, tabs, iconos, estados (activo/bloqueado/en espera/completado), barras de progreso y toasts.
- [ ] Probar diseño en móviles compactos y proyectores Full HD; evitar saturación de textos en cada pantalla.
- [x] Distinguir claramente **fase desbloqueada** de **actividad completada**, porque no son equivalentes.

## 10. Pruebas de aceptación y seguridad (P0)

### Bloqueos y sincronización (pruebas obligatorias)

Los checks de esta sección acreditan las comprobaciones HTTP/SSE del DEMO actual. El caso 9 valida rehidratación y permisos del servidor; falta un E2E de reconexión en navegador. El caso 15 valida snapshots/eventos y datos de proyector, sin sustituir el ensayo en auditorio. No hay workers de IA: el caso 12 permanece pendiente, aunque se prueban solicitudes tardías con fase/versión obsoletas.
- [x] **Caso 1:** sesión en espera → cualquier intento de `generate`, `audit`, `fix` o `publish` devuelve `403 PHASE_LOCKED`.
- [x] **Caso 2:** fase 1 activa → un participante termina su prompt y fuerza la URL/API de generar app → bloqueado.
- [x] **Caso 3:** fase 2 activa → puede generar; `audit`, `fix` y `publish` siguen bloqueadas.
- [x] **Caso 4:** fase 3 activa → puede auditar; no puede corregir todavía.
- [x] **Caso 5:** fase 4 activa → puede corregir; no puede publicar todavía.
- [x] **Caso 6:** fase 5 activa → puede decidir GO/NO GO y publicar solo sandbox/demo si se cumplen las precondiciones.
- [x] **Caso 7:** usuario PARTICIPANT intenta `phase-command` → `403 FORBIDDEN`.
- [x] **Caso 8:** usuarios en sesiones distintas → avanzar una sesión no modifica la otra.
- [x] **Caso 9:** reconexión después de avance → muestra versión actual del servidor; nunca conserva un botón de fase antigua habilitado.
- [x] **Caso 10:** doble clic, replay y dos controladores → un solo cambio efectivo; transición atómica e idempotente.
- [x] **Caso 11:** pausar a mitad de actividad → nuevas mutaciones rechazadas; reanudar restaura solo las permitidas.
- [ ] **Caso 12:** job de IA iniciado en fase 2 que termina cuando ya está activa 3 → no altera silenciosamente puntuación ni versión final; aplica política definida de cierre.
- [x] **Caso 13:** participantes que terminan temprano no pueden saltar de fase, aunque conozcan endpoints o manipulen el frontend.
- [x] **Caso 14:** modo demo sin Internet/IA → el recorrido educativo se puede completar con fixtures seguros, sin fingir IA en vivo.
- [x] **Caso 15:** proyector y Control Center reflejan mismo estado; datos simulados rotulados como tales.

### Comprobaciones de equipos y separación de vistas

- [x] Participante bloqueado en páginas de Studio/proyección y sus APIs; proyector sin permisos de mutación.
- [x] Studio y proyector mantienen cookies independientes en el mismo navegador.
- [x] El ingreso y las sugerencias se resuelven desde la sesión seleccionada; rechazar sesiones inválidas. Conservar validación de código/horario solo para clientes anteriores que todavía lo envíen.
- [x] Ingresos concurrentes al mismo nombre normalizado crean un único equipo.
- [x] Un equipo admite seis integrantes; los siguientes reciben `409 TEAM_FULL`.
- [x] Un acceso vigente que reingresa al mismo equipo no incrementa integrantes.
- [x] La edición de un integrante se refleja en el proyecto compartido; la entrega no se multiplica por miembros.
- [x] Sugerencias limitadas a la sala validada, con cupos y sin exponer proyectos o datos de integrantes.

### Pruebas adicionales
- [ ] Unitarias para máquina de estados y permisos; integración para APIs y colas; end-to-end con roles y múltiples navegadores.
- [ ] Simulación de carga con cantidad objetivo de dispositivos definida antes del evento, probando picos de QR, generaciones simultáneas y reintentos.
- [ ] Accesibilidad, tamaño de texto y funcionamiento en teléfonos de gama media, Android/iOS.
- [ ] Ensayo de taller completo de dos horas, dos sesiones aisladas y recuperación ante desconexiones.

## 11. Prioridades y plan de entregas

### M0 — Fundaciones y control pedagógico (P0, primero)

Base funcional implementada; el hito completo sigue pendiente por ausencia del ZIP, validación de navegador y alcance de pruebas restante. SSE cumple la sincronización prevista como alternativa a WebSocket.
- [ ] Migrar base beta a proyecto modular y preparar backend/base de datos.
- [x] Implementar sesiones, roles, motor de fases, locks servidor, WebSocket, temporizador y auditoría de acciones.
- [x] Crear Control Center mínimo, pantalla de espera del participante y proyector sincronizado.
- [ ] Aprobar los 15 casos de bloqueo y sincronización que correspondan al alcance de M0.

### M1 — Experiencia completa de simulación (P0)
- [ ] Ideación, generador determinista, vista previa/código, auditoría educativa, correcciones y GO/NO GO.
- [ ] Misiones por fase, estados de espera, trabajo por equipos, progreso y guardado persistente.
- [ ] Modo demo sin servicios externos, con métricas sintéticas claramente marcadas.
- [ ] Ensayo completo de las cinco fases dirigido exclusivamente por conferencista.

### M2 — Operación real en auditorio (P0/P1)
- [ ] Acceso por QR en múltiples dispositivos, identidad de equipo, recuperación de conexión y métricas reales.
- [ ] Concurrencia, contingencia, seguridad, moderación, observabilidad y carga.
- [ ] Prueba de ambas sesiones en horarios reales del 18 de noviembre.

### M3 — Extensiones (P1/P2, no bloquear M1)
- [ ] Integración opcional de IA real con presupuesto, colas y entornos aislados.
- [ ] Materiales, preguntas, encuesta, certificados validados, exportaciones y analítica.
- [ ] Pagos/inscripciones reales solo si se define como alcance separado y se cumple el tratamiento de datos.

## 12. Definition of Done

Se considera listo para el taller **solo** si:

1. Nadie puede adelantar una fase sin decisión autenticada del conferencista, incluso manipulando cliente/API.
2. Los cinco pasos funcionan de principio a fin en modo simulación, en móviles reales y con persistencia.
3. El presentador puede explicar, habilitar, pausar y avanzar al ritmo del auditorio sin pérdida de trabajo.
4. Proyector, participantes y Control Center muestran el mismo estado de sesión.
5. Las dos sesiones están aisladas y es posible recuperar conexiones.
6. El sistema nunca confunde datos, generación, auditoría, corrección o puntuación **simulados** con verificaciones reales.
7. Se completa un ensayo de carga y un simulacro con plan de contingencia documentado.

---

## Instrucción inicial sugerida para Codex

> Implementa **M0** de `TODO.md` antes de construir funcionalidades nuevas. Comienza por la máquina de estados, autorización en backend y pruebas que impidan avanzar fases desde el cliente. Usa la Beta 0.2 solo como referencia funcional y visual, no reutilices `localStorage` como autoridad. Conserva el branding institucional y no declares como reales las capacidades simuladas. Cuando M0 pase pruebas, continúa con M1 por orden de fases.
