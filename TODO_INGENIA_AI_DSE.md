# TODO Codex — IngenIA: alineación completa con AI-DSE

**Objetivo:** adecuar la simulación educativa de la Universidad de Cundinamarca a seis fases reales del modelo pedagógico **INGGEN AI-DSE**, preservando el funcionamiento sincronizado de `/studio`, `/projector` y `/`.

**Importante:** AI-DSE es una propuesta de integración didáctica de Inggen sustentada en SDLC, Scrum/Agile, especificación verificable, TDD, DevSecOps y revisión humana. No presentarla como norma oficial. La IA de la experiencia continúa siendo simulada, con fixtures reproducibles. No prometer IA generativa real.

## Evidencia observada antes de modificar

- `/studio`: pantalla de ingreso al Control Center, contraseña requerida, texto «Un taller, cinco fases»; no fue posible auditar controles internos sin credenciales.
- `/projector`: fase 2/5 «Generar app», misión «Genera y examina un prototipo educativo simulado», progreso por equipos, cronómetro, participantes conectados y equipos listos.
- `/`: fase 2/5 «Generar app», prompt del participante sobre reserva de eventos y prototipo estático de **tareas** que no corresponde al prompt; código DEMO con credencial ficticia y acceso inseguro; límite de tres generaciones, sin IA externa.
- Fecha/sesiones observadas: 18/11/2026; 14:00–16:00 y 18:00–20:00, hora Colombia. Conservar horarios configurables.

## P0 · Datos, fases y sincronización

- [x] **P0-01. Inspeccionar arquitectura antes de cambiar:** localizar configuración de fases, componentes, APIs, websockets/SSE, fixtures, persistencia, políticas de acceso y pruebas. Proponer migración compatible. No reemplazar datos de sesiones existentes a ciegas.
- [x] **P0-02. Catálogo único de seis fases** (`id` estable, `order`, `slug`, `title`, `objective`, `theory`, `mission`, `deliverable`, `acceptanceCriteria`, `duration`, `incidentCategories`):
  1. Descubrimiento (`discovery`)
  2. Especificación (`specification`)
  3. Arquitectura (`architecture`)
  4. Construcción con IA (`construction`)
  5. Verificación (`verification`)
  6. Entrega y aprendizaje (`delivery`)
- [x] **P0-03. Reemplazar las cinco etiquetas anteriores** en UI, API, estadísticas, barra de progreso, exportaciones, fixtures, mensajes, puntajes y validación de avance. Migración explícita de entregables antiguos (`Ideación`, `Generar app`, `Auditar`, `Corregir`, `Publicar`), sin asignar automáticamente una equivalencia dudosa; registrar si hace falta reconciliación manual.
- [x] **P0-04. Modelar subestado didáctico** por fase: `theory`, `practice`, `reflection`, `closed`; Studio es la fuente de autoridad. En teoría se muestra contenido y la actividad permanece bloqueada; en práctica se habilita; en reflexión se comparten hallazgos; en cerrado solo lectura.
- [ ] **P0-05. Sincronización en tiempo real**: evento con `sessionId`, `phaseId`, `mode`, `version`, `startedAt`, `endsAt` y `actorId`; reconexión recupera snapshot; mensajes idempotentes y ordenados; evitar que dos pestañas del Studio dupliquen cambios.
- [x] **P0-06. Cronómetro** calculado desde tiempo del servidor, no desde relojes independientes de clientes. Mostrar pausa/reanudación coherente y estado de tiempo agotado.

## P0 · Misiones oficiales revisadas

Cada fase debe mostrar en participantes: nombre, objetivo, instrucciones de 2–4 pasos, evidencia esperada, criterio de finalización y tiempo restante. En proyector, una versión de máximo dos líneas. Los textos siguientes son la **fuente de verdad**.

| Fase | Misión breve para proyector | Instrucción de participantes | Evidencia / finalización |
|---|---|---|---|
| 1 Descubrimiento | **Identifiquen el problema real, a quién afecta y qué solución mínima necesita.** | Describan al usuario principal, el problema que enfrenta y tres funciones prioritarias. Registren al menos una restricción o supuesto que deba validarse. | Ficha con usuario, problema, tres funciones y una restricción. |
| 2 Especificación | **Conviertan la idea en comportamientos concretos y verificables.** | Redacten dos historias de usuario y tres criterios de aceptación observables. Incluyan un caso alterno o de error. | Dos historias, tres criterios y un escenario negativo. |
| 3 Arquitectura | **Decidan cómo se organizará la app y cómo protegerá sus datos.** | Seleccionen una arquitectura entre alternativas simuladas. Definan datos principales, flujo de acceso y una regla de autorización. Justifiquen su decisión. | Decisión arquitectónica con justificación, datos y control de acceso. |
| 4 Construcción con IA | **Generen un prototipo simulado a partir de requisitos y límites claros.** | Elaboren el prompt con contexto, alcance, arquitectura acordada y criterios de aceptación. Generen una versión, examinen el resultado y documenten qué coincide o difiere. | Prompt, versión generada y revisión de correspondencia. |
| 5 Verificación | **Comprueben el prototipo y expliquen los riesgos encontrados.** | Ejecuten escenarios de prueba simulados. Identifiquen al menos un hallazgo, su impacto y una prueba que permita comprobar la corrección. | Hallazgo clasificado, evidencia y prueba de regresión. |
| 6 Entrega y aprendizaje | **Decidan si la app está lista y qué harían ante un problema en producción.** | Revisen los pendientes y riesgos. Decidan publicar, publicar con condiciones o detener. Definan un plan de reversión y una mejora para la siguiente iteración. | Decisión razonada, riesgo residual, rollback y retrospectiva. |

- [x] **P0-07. Unificar textos** de las misiones en catálogo de servidor o recurso i18n; no duplicar copy en tres frontends.
- [x] **P0-08. Fases 2 y 4**: las historias y criterios de aceptación deben alimentar el prompt simulado; no duplicar una idea libre como si fuera una especificación. Guardar revisiones.
- [x] **P0-09. Concordancia prototipo-prompts**: para la idea de reservas de eventos, el fixture debe representar reservas de eventos. Si se quiere un prototipo de tareas, convertir la discrepancia en un incidente `requirements_mismatch` explícitamente asignado y explicable; nunca mostrarse inadvertidamente como resultado normal.
- [x] **P0-10. Estado de entregables**: borrador, enviado, aceptado, requiere revisión. Bloqueo de fases futuras hasta autorización del Studio; permitir reabrir fase con auditoría y preservar versiones.

> **Avance (etapas 1 y 2):** catálogo único en `packages/shared/phases.mjs`; subestados THEORY/PRACTICE/REFLECTION/CLOSED; entregables con borrador/enviado/aceptado/requiere revisión y revisiones; prompt prellenado desde las fases 1–3; prototipo según proyecto y arquitectura; migración v9 sin equivalencias automáticas. **P0-05 parcial:** los eventos llevan sesión, fase, subestado, versión, `stageStartedAt` y `deadline`, con reconexión por snapshot e idempotencia; falta incluir `actorId` en el evento. **BUILD-03** (discrepancia intencional) queda para el motor de incidentes.

## P0 · Incidentes individuales y difusión desde Studio

- [x] **P0-11. Modelo `IncidentDefinition`**: `code`, `phaseId`, `category`, `severity`, `title`, `privateDescription`, `genericDescription`, `symptom`, `context`, `choices[]`, `expectedReasoning`, `learningPoint`, `relatedControls`, `fixtureVariant`.
- [x] **P0-12. Modelo `IncidentAssignment`**: `sessionId`, `teamId`, `incidentCode`, `phaseId`, `status` (`assigned`, `revealed`, `acknowledged`, `resolved`, `discussed`), `assignedAt`, `revealedAt`, `response`, `resolution`, `sharedAt`. Evitar duplicados y filtrar por tenant/sesión/equipo.
- [x] **P0-13. Participante**: mostrar un panel **«Incidente de tu equipo»** solo cuando se revele durante la fase correspondiente. Incluir síntoma, contexto, impacto simulado, opciones para decidir, campo de justificación y botón de registrar respuesta. Mantenerlo visible en historial después de cerrar fase. No revelar las respuestas esperadas antes de la reflexión.
- [x] **P0-14. Studio**: lista de equipos por fase con indicadores de incidentes, severidad y estado; asignación manual o determinista; revelar/ocultar; ver respuesta; seleccionar equipo; botón **«Compartir con auditorio»**; botón para finalizar discusión. Acción confirmada y auditada. Solo conferencista autenticado puede asignar, revelar y compartir.
- [x] **P0-15. Proyector**: al compartir, presentar `genericDescription`, categoría, pregunta de discusión y nombre de equipo solo después de que el conferencista lo autorice. Nunca exponer credenciales, detalles privados, datos de otros equipos ni respuestas privadas. La vista normal retorna al cerrar intervención.
- [x] **P0-16. Retroalimentación**: tras compartir, Studio revela `learningPoint` y en qué fase(s) pudo haberse prevenido o detectado; participantes reciben síntesis educativa, sin señalar culpables.
- [x] **P0-17. Motor determinista**: semilla por sesión/equipo/fase; distribución equilibrada, configurable, con 0–2 incidentes por equipo y máximo 1 incidente crítico por equipo. El docente puede anular asignaciones. No alterar resultados de una generación previa al refrescar.

> **Avance (etapa 3):** catálogo de once incidentes solo en el servidor (`services/api/incidents.mjs`); asignaciones en `incident_assignments` y difusión en `incident_shares`; motor determinista por sesión/equipo/fase al habilitar la práctica (proporción 0,5, máximo 2 por equipo y 1 crítico, configurable con `incidentConfig` de la sesión); vistas filtradas por rol; variantes de fixture para BUILD-01, BUILD-03 y TEST-01. Pendiente: editar `incidentConfig` desde Studio.

### Catálogo inicial de incidentes

| Código | Fase | Severidad | Síntoma visible | Aprendizaje esperado |
|---|---|---|---|---|
| `DISC-01` | 1 | Media | La IA propone una solución para un público diferente | Validar usuario y problema antes de pedir código |
| `SPEC-01` | 2 | Media | Faltan reglas de cancelación o validación | Criterios de aceptación y escenarios alternos |
| `ARCH-01` | 3 | Alta | La arquitectura elegida no soporta persistencia o API | Contratos, compatibilidad y decisión documentada |
| `ARCH-02` | 3 | Crítica | Los permisos dependen solo del cliente | Autorización comprobada en el servidor |
| `BUILD-01` | 4 | Media | La dependencia propuesta no existe | Validación de librerías y versiones |
| `BUILD-02` | 4 | Alta | El código contiene un secreto ficticio | Gestión segura de configuración y secretos |
| `BUILD-03` | 4 | Media | El prototipo es de tareas, pero el equipo pidió reservas | Trazabilidad requisitos ↔ resultado |
| `TEST-01` | 5 | Alta | Una prueba marca éxito sin comprobar resultados | Aserciones significativas y pruebas negativas |
| `TEST-02` | 5 | Crítica | Se simula acceso a la reserva de otro usuario | Pruebas de autorización horizontal |
| `RELEASE-01` | 6 | Alta | Un cambio en producción falla y no hay rollback | Plan de reversión y monitoreo |
| `RELEASE-02` | 6 | Media | No hay métricas ni registro de errores | Observabilidad y aprendizaje posterior |

## P1 · Experiencia docente y evaluación

- [ ] **P1-00. Presentación como guion maestro:** hacer que el control de Studio siga los bloques de la presentación (teoría, acuerdo del equipo, práctica en app, compartir incidentes y reflexión), con duración programada, temporizador y evento `presentationBlockId`. La presentación contiene marcas de tiempo relativas, instrucciones de cambio de ambiente y espacios explícitos para acuerdos y socialización. No cambiar de fase automáticamente solo porque cambió una diapositiva: el facilitador confirma el avance desde Studio.
- [ ] **P1-01. Studio**: panel de 6 fases × 3 subestados; tiempos editables por sesión (preferencia inicial de 120 min); botón siguiente/anterior con confirmación si hay entregables pendientes; vista de progreso global.
- [ ] **P1-02. Cola de intervenciones**: filtros por fase, severidad y estado; «Pedir la palabra» desde equipo, prioridad manual docente, límite sugerido 45–60 segundos, controles de omitir/posponer/finalizar.
- [ ] **P1-03. Calificación formativa** por evidencia y razonamiento, no por velocidad; equipo puede finalizar sin incidente; un incidente no reduce automáticamente puntuación.
- [ ] **P1-04. Resumen final**: número de equipos, fases terminadas, categorías de incidentes compartidos, aprendizajes y decisiones de liberación. Exportación CSV anonimizada por defecto.
- [ ] **P1-05. Introducción histórica** en proyector o presentación: programación temprana → procesos secuenciales → SDLC → Agile/DevOps → IA asistida → integración educativa AI-DSE. Distinguir explícitamente SDLC como marco general y AI-DSE como adaptación de taller.

## P1 · Calidad, accesibilidad y seguridad

- [ ] QA de roles: participante de equipo A nunca ve incidentes o respuestas privados de B; proyector no requiere permisos de docente.
- [x] QA de estado en tiempo real con 50 equipos y hasta 300 asistentes; reconexiones y cambios de modo simultáneos. — *Hecho: `npm run load` (300 y 600 participantes sin errores; ver `docs/OPERACION.md`). Falta repetirla en producción y en la red del auditorio.*
- [ ] Pruebas de idempotencia de compartir incidente, reabrir fase, pausar temporizador y doble envío.
- [ ] Responsive móvil/tableta, controles táctiles, navegación con teclado, lectores de pantalla, contraste AA y estados vacío/cargando/error/sin conexión.
- [ ] No usar secretos reales, código ejecutable riesgoso ni datos personales en fixtures. Mostrar «SIMULACIÓN» en prototipos y alertas.
- [ ] Registro de auditoría de cambios de fase, publicaciones, anulaciones, asignaciones y resultados.
- [ ] Backup y plan de reversión del esquema de datos antes de migrar sesiones previas.

## Criterios de aceptación de extremo a extremo

1. La app muestra **exactamente seis fases y los nombres oficiales** en las tres vistas, en el orden correcto.
2. Cada fase alterna teoría, práctica y reflexión sincronizadamente sin recargar.
3. La misión que ve el participante corresponde a la misma fase y explica un entregable verificable.
4. Un incidente asignado al equipo A aparece únicamente en A cuando Studio lo revela.
5. Studio puede compartir el incidente de A en proyector durante su fase, con descripción genérica; B no ve datos privados.
6. Los incidentes son reproducibles y su estado persiste tras reconectar.
7. El resultado de la generación coincide con el tipo de app solicitado, salvo cuando la discrepancia es un incidente intencional.
8. Los entregables previos sobreviven una migración o quedan explícitamente marcados para reconciliación; nunca se pierden silenciosamente.
9. Con 50 equipos y 300 sesiones de cliente, el avance, temporizador y publicación de incidentes se mantienen consistentes.
10. Existe un recorrido completo de demostración con y sin incidentes, y pruebas automatizadas de permisos y transiciones.

## Fuera de alcance

- Integración con modelos de IA reales, ejecución de código generado o publicación de apps reales.
- Rediseño total de marca, autenticación o infraestructura sin hallazgo justificado.
- Suposiciones sobre controles internos de Studio que no pudieron inspeccionarse sin acceso autorizado.

## Orden de implementación recomendado

1. Auditoría técnica y migración de datos.
2. Catálogo seis fases + textos de misiones + estados didácticos.
3. Flujo de incidentes participante → Studio → proyector.
4. Fixtures congruentes, trazabilidad y entregables.
5. Pruebas automatizadas, carga, accesibilidad y ensayo general de 120 minutos.

### Instrucción final para Codex

Antes de editar, inspecciona el repositorio y presenta un plan por archivos y migraciones. Trabaja por commits o PRs pequeños. No borres datos existentes ni alteres sesiones activas sin un plan de reversión. Entrega capturas de las tres vistas, pruebas ejecutadas, resultados, riesgos y pendientes. No despliegues a producción sin aprobación.
