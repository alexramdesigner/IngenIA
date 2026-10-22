// Incidentes didácticos AI-DSE. El catálogo vive solo en el servidor: las respuestas esperadas y los
// detalles privados nunca se publican como archivo estático; cada rol recibe una vista filtrada.
import { createHash } from 'node:crypto';
import { PHASES } from '../../packages/shared/phases.mjs';

const choices = (...items) => items.map((text, index) => ({ id: String.fromCharCode(97 + index), text }));
export const INCIDENTS = [
  { code: 'DISC-01', phaseId: 1, category: 'Requisitos', severity: 'Media', title: 'La solución apunta a otro público',
    symptom: 'La IA propone pantallas pensadas para administradores, no para el usuario que describieron.', context: 'Le pidieron ideas a la IA antes de acordar quién es el usuario principal.', impact: 'Simulado: el equipo invertiría la práctica en funciones que su usuario no necesita.',
    privateDescription: 'Su ficha de descubrimiento todavía no fija un usuario concreto; la propuesta de la IA llena ese vacío con un público distinto.',
    genericDescription: 'Un equipo recibió una propuesta de la IA pensada para un público diferente al que quería atender.',
    discussionQuestion: '¿Qué tendríamos que validar antes de pedirle una solución a la IA?',
    choices: choices('Aceptar la propuesta: la IA conoce mejor el problema', 'Volver a la ficha y validar usuario y problema antes de pedir código', 'Pedir a la IA más pantallas para cubrir todos los públicos'),
    expectedChoice: 'b', expectedReasoning: 'La IA amplifica la entrada que recibe: sin un usuario validado, optimiza para el público equivocado.',
    learningPoint: 'Validar usuario y problema antes de pedir código.', preventedIn: [1], relatedControls: ['Entrevista o validación con usuarios', 'Ficha de descubrimiento revisada'] },
  { code: 'SPEC-01', phaseId: 2, category: 'Requisitos', severity: 'Media', title: 'Faltan reglas de cancelación',
    symptom: 'Nadie sabe qué pasa si alguien cancela tarde o deja campos vacíos.', context: 'Las historias describen el caso feliz, pero no las reglas de validación ni de cancelación.', impact: 'Simulado: cada integrante implementaría una regla distinta.',
    privateDescription: 'Sus criterios no cubren qué ocurre ante una cancelación tardía ni ante datos incompletos.',
    genericDescription: 'Un equipo descubrió que su especificación no decía qué hacer ante cancelaciones o datos incompletos.',
    discussionQuestion: '¿Qué criterio de aceptación habría evitado esta ambigüedad?',
    choices: choices('Dejar que la IA decida la regla durante la construcción', 'Agregar criterios observables y un escenario alterno para cancelación y validación', 'Eliminar la función de cancelar'),
    expectedChoice: 'b', expectedReasoning: 'Los criterios de aceptación y los escenarios alternos convierten una ambigüedad en un comportamiento verificable.',
    learningPoint: 'Criterios de aceptación y escenarios alternos.', preventedIn: [2], relatedControls: ['Criterios Dado/Cuando/Entonces', 'Escenario negativo obligatorio'] },
  { code: 'ARCH-01', phaseId: 3, category: 'Arquitectura', severity: 'Alta', title: 'La arquitectura no soporta persistencia',
    symptom: 'La opción elegida no guarda datos compartidos ni expone una API.', context: 'Escogieron la alternativa más rápida de publicar sin revisar los requisitos de datos.', impact: 'Simulado: cada usuario vería solo lo que guardó en su propio navegador.',
    privateDescription: 'Su decisión no explica cómo se comparten los datos entre usuarios ni qué contrato expone la app.',
    genericDescription: 'Un equipo eligió una arquitectura que no podía guardar ni compartir los datos que su app necesitaba.',
    discussionQuestion: '¿Qué pregunta sobre los datos debió guiar la elección de arquitectura?',
    choices: choices('Mantener la arquitectura y explicarlo a los usuarios', 'Revisar los requisitos de datos y documentar una decisión que los soporte', 'Copiar los datos manualmente entre navegadores'),
    expectedChoice: 'b', expectedReasoning: 'La arquitectura se decide a partir de los datos y contratos que exige la especificación, y la decisión se documenta.',
    learningPoint: 'Contratos, compatibilidad y decisión documentada.', preventedIn: [2, 3], relatedControls: ['Registro de decisión arquitectónica', 'Contrato de API'] },
  { code: 'ARCH-02', phaseId: 3, category: 'Autorización', severity: 'Crítica', title: 'Los permisos dependen solo del cliente',
    symptom: 'Ocultar un botón en la pantalla es la única protección de las acciones.', context: 'La regla de autorización vive en el navegador y no se comprueba en el servidor.', impact: 'Simulado: cualquiera podría llamar a la API directamente y saltarse la regla.',
    privateDescription: 'Su flujo de acceso confía en la interfaz para impedir acciones; el servidor acepta cualquier petición.',
    genericDescription: 'Un equipo protegía sus acciones solo ocultando botones en la pantalla.',
    discussionQuestion: '¿Dónde debe comprobarse una regla de autorización y por qué?',
    choices: choices('Ocultar mejor los botones', 'Comprobar la autorización en el servidor en cada petición', 'Pedir a los usuarios que no usen la API'),
    expectedChoice: 'b', expectedReasoning: 'El cliente es manipulable; solo el servidor puede garantizar quién puede hacer qué.',
    learningPoint: 'Autorización comprobada en el servidor.', preventedIn: [3], relatedControls: ['Control de acceso en el backend', 'Pruebas de autorización'] },
  { code: 'BUILD-01', phaseId: 4, category: 'Dependencias', severity: 'Media', title: 'La dependencia propuesta no existe',
    symptom: 'El prototipo importa una librería que no aparece en ningún registro de paquetes.', context: 'La IA completó el código con un nombre de paquete plausible pero inventado.', impact: 'Simulado: la instalación fallaría o, peor, alguien podría publicar un paquete malicioso con ese nombre.',
    privateDescription: 'La versión generada importa «reserva-facil-pro», un paquete que no existe.',
    genericDescription: 'Un equipo recibió código que dependía de una librería inexistente.',
    discussionQuestion: '¿Cómo comprobamos que una dependencia sugerida por la IA es real y confiable?',
    choices: choices('Instalarla igual y ver qué pasa', 'Verificar el paquete, su autor y su versión antes de usarlo', 'Copiar el código de cualquier repositorio con ese nombre'),
    expectedChoice: 'b', expectedReasoning: 'Las dependencias alucinadas son un riesgo de cadena de suministro; se verifican antes de instalarse.',
    learningPoint: 'Validación de librerías y versiones.', preventedIn: [4], relatedControls: ['Lista de dependencias aprobadas', 'Revisión de cadena de suministro'], fixtureVariant: 'phantom_dependency' },
  { code: 'BUILD-02', phaseId: 4, category: 'Secretos', severity: 'Alta', title: 'El código contiene un secreto',
    symptom: 'Hay una credencial escrita directamente en el código del prototipo.', context: 'La IA incluyó una clave de ejemplo para que el código "funcione".', impact: 'Simulado: al publicar el repositorio la credencial quedaría expuesta.',
    privateDescription: 'Su versión incluye una constante con una credencial (ficticia) dentro del código.',
    genericDescription: 'Un equipo encontró una credencial escrita directamente en el código generado.',
    discussionQuestion: '¿Dónde deben vivir los secretos de una aplicación?',
    choices: choices('Dejarla: es solo un prototipo', 'Moverla a configuración segura del servidor y rotarla', 'Ocultarla con un comentario'),
    expectedChoice: 'b', expectedReasoning: 'Los secretos se gestionan fuera del código, en configuración segura del servidor, y se rotan si se expusieron.',
    learningPoint: 'Gestión segura de configuración y secretos.', preventedIn: [3, 4], relatedControls: ['Variables de entorno', 'Escáner de secretos'] },
  { code: 'BUILD-03', phaseId: 4, category: 'Trazabilidad', severity: 'Media', title: 'El prototipo no corresponde a lo pedido',
    symptom: 'El prototipo generado es de otro tipo de aplicación.', context: 'El prompt no fijó con claridad el proyecto y la IA respondió con un ejemplo genérico.', impact: 'Simulado: el equipo verificaría una app que nadie pidió.',
    privateDescription: 'Pidieron su proyecto, pero esta versión del prototipo corresponde a otro proyecto distinto.',
    genericDescription: 'Un equipo recibió un prototipo de otro tipo de aplicación del que había pedido.',
    discussionQuestion: '¿Cómo aseguramos la trazabilidad entre requisitos y resultado?',
    choices: choices('Adaptar la especificación al prototipo recibido', 'Comparar con los criterios de aceptación y regenerar con un prompt trazable', 'Publicarlo y corregir después'),
    expectedChoice: 'b', expectedReasoning: 'El resultado se contrasta con los requisitos; si no corresponde, se regenera con un prompt que los cite.',
    learningPoint: 'Trazabilidad requisitos ↔ resultado.', preventedIn: [2, 4], relatedControls: ['Matriz de trazabilidad', 'Revisión contra criterios'], fixtureVariant: 'requirements_mismatch' },
  { code: 'TEST-01', phaseId: 5, category: 'Pruebas', severity: 'Alta', title: 'Una prueba pasa sin comprobar nada',
    symptom: 'Un escenario aparece en verde aunque no verifica el resultado.', context: 'La prueba ejecuta la función pero no tiene aserciones.', impact: 'Simulado: un error real pasaría como éxito.',
    privateDescription: 'En sus escenarios hay una prueba marcada como exitosa que no contiene ninguna aserción.',
    genericDescription: 'Un equipo descubrió una prueba que siempre pasaba porque no comprobaba nada.',
    discussionQuestion: '¿Qué hace que una prueba sea significativa?',
    choices: choices('Confiar en que el verde significa correcto', 'Agregar aserciones del resultado esperado y una prueba negativa', 'Eliminar las pruebas que fallan'),
    expectedChoice: 'b', expectedReasoning: 'Una prueba compara el resultado con lo esperado, incluidos los casos negativos.',
    learningPoint: 'Aserciones significativas y pruebas negativas.', preventedIn: [2, 5], relatedControls: ['Revisión de pruebas', 'Pruebas negativas'], fixtureVariant: 'assertionless_test' },
  { code: 'TEST-02', phaseId: 5, category: 'Autorización', severity: 'Crítica', title: 'Acceso a la reserva de otro usuario',
    symptom: 'Cambiando el id en la petición se obtiene el registro de otra persona.', context: 'La consulta por id no comprueba el propietario.', impact: 'Simulado: exposición de datos personales de otros estudiantes.',
    privateDescription: 'Su prototipo devuelve registros ajenos al cambiar el identificador de la consulta.',
    genericDescription: 'Un equipo descubrió que se podía consultar el registro de otro usuario cambiando un identificador.',
    discussionQuestion: '¿Qué prueba habría detectado este acceso indebido?',
    choices: choices('Ocultar los identificadores en la URL', 'Comprobar el propietario en el servidor y agregar una prueba de autorización horizontal', 'Usar identificadores más largos'),
    expectedChoice: 'b', expectedReasoning: 'La autorización horizontal se verifica en el servidor y se protege con pruebas que intenten acceder a datos ajenos.',
    learningPoint: 'Pruebas de autorización horizontal.', preventedIn: [3, 5], relatedControls: ['Control de propietario', 'Pruebas de acceso entre usuarios'] },
  { code: 'RELEASE-01', phaseId: 6, category: 'Operación', severity: 'Alta', title: 'Falla en producción sin plan de reversión',
    symptom: 'Un cambio publicado falla y no hay forma rápida de volver atrás.', context: 'Se publicó sin definir cómo revertir ni quién decide hacerlo.', impact: 'Simulado: la app queda caída mientras se improvisa una solución.',
    privateDescription: 'Su decisión de entrega no incluye cómo volver a la versión anterior si algo falla.',
    genericDescription: 'Un equipo publicó un cambio que falló y no tenía cómo volver a la versión anterior.',
    discussionQuestion: '¿Qué debe existir antes de publicar para poder revertir?',
    choices: choices('Corregir directamente en producción', 'Revertir con un plan probado y luego analizar la causa', 'Esperar a que los usuarios reporten'),
    expectedChoice: 'b', expectedReasoning: 'Un plan de reversión probado limita el impacto; el análisis viene después de restablecer el servicio.',
    learningPoint: 'Plan de reversión y monitoreo.', preventedIn: [6], relatedControls: ['Rollback ensayado', 'Despliegue gradual'] },
  { code: 'RELEASE-02', phaseId: 6, category: 'Observabilidad', severity: 'Media', title: 'Sin métricas ni registro de errores',
    symptom: 'Los usuarios dicen que algo falla, pero no hay datos para saber qué.', context: 'La app se publicó sin métricas ni registro de errores.', impact: 'Simulado: el equipo no puede diagnosticar ni aprender del problema.',
    privateDescription: 'Su plan no define qué medir ni dónde quedan registrados los errores.',
    genericDescription: 'Un equipo no podía diagnosticar fallas porque su app no registraba errores ni métricas.',
    discussionQuestion: '¿Qué señales mínimas necesitamos observar después de publicar?',
    choices: choices('Preguntar a cada usuario qué pasó', 'Definir métricas y registro de errores sin datos personales', 'Reiniciar la app cuando falle'),
    expectedChoice: 'b', expectedReasoning: 'La observabilidad permite detectar, diagnosticar y aprender; los registros no deben exponer datos personales.',
    learningPoint: 'Observabilidad y aprendizaje posterior.', preventedIn: [6], relatedControls: ['Registro de errores', 'Métricas de uso'] }
];
export const incidentByCode = code => INCIDENTS.find(item => item.code === code);
// Distribución configurable por sesión; valores por defecto del TODO (0–2 por equipo, máximo 1 crítico).
export const INCIDENT_DEFAULTS = { enabled: true, ratio: 0.5, maxPerTeam: 2, maxCritical: 1 };
const seed = (...parts) => parseInt(createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 12), 16);

// Plan determinista: mismas entradas, mismas asignaciones. Respeta asignaciones existentes (incluidas las manuales).
export function planAssignments(sessionId, teamIds, phase, existing, config = INCIDENT_DEFAULTS) {
  if (!config.enabled) return [];
  const candidates = INCIDENTS.filter(item => item.phaseId === phase);
  if (!candidates.length || !teamIds.length) return [];
  const forTeam = teamId => existing.filter(a => a.teamId === teamId);
  const critical = teamId => forTeam(teamId).filter(a => incidentByCode(a.code)?.severity === 'Crítica').length;
  const target = Math.ceil(teamIds.length * config.ratio);
  let missing = target - teamIds.filter(teamId => forTeam(teamId).some(a => a.phase === phase)).length;
  const plan = [];
  const order = teamIds.filter(teamId => !forTeam(teamId).some(a => a.phase === phase) && forTeam(teamId).length < config.maxPerTeam)
    .sort((a, b) => forTeam(a).length - forTeam(b).length || seed(sessionId, a, phase) - seed(sessionId, b, phase) || a.localeCompare(b));
  for (const teamId of order) {
    if (missing <= 0) break;
    const allowed = candidates.filter(item => item.severity !== 'Crítica' || critical(teamId) < config.maxCritical);
    if (!allowed.length) continue;
    plan.push({ teamId, code: allowed[seed(sessionId, teamId, phase, 'incident') % allowed.length].code, phase });
    missing--;
  }
  return plan;
}

// La retroalimentación se muestra tras discutirlo o cuando la fase llegó a reflexión.
export const feedbackOpen = (assignment, session) => assignment.status === 'discussed' || (session.activePhase ?? 0) > assignment.phase || session.status === 'FINISHED' || (session.activePhase === assignment.phase && ['REFLECTION', 'CLOSED'].includes(session.phaseStage));
const feedback = definition => ({ expectedChoice: definition.expectedChoice, expectedReasoning: definition.expectedReasoning, learningPoint: definition.learningPoint, preventedIn: definition.preventedIn.map(id => PHASES[id - 1].title), relatedControls: definition.relatedControls });
const shared = ({ code, phaseId, category, severity, title, symptom, context, impact, privateDescription, choices }) => ({ code, phase: phaseId, category, severity, title, symptom, context, impact, privateDescription, choices });

// Vista del equipo: solo sus incidentes revelados; nunca la respuesta esperada antes de la reflexión.
export function participantIncidents(assignments, session) {
  return assignments.filter(a => a.status !== 'assigned').map(a => {
    const definition = incidentByCode(a.code);
    return { ...shared(definition), status: a.status, response: a.response, revealedAt: a.revealedAt, ...(feedbackOpen(a, session) ? { feedback: feedback(definition) } : {}) };
  });
}
// Vista de Studio: todo el detalle docente de cada asignación.
export function presenterIncident(assignment) {
  const definition = incidentByCode(assignment.code);
  return { ...assignment, ...shared(definition), genericDescription: definition.genericDescription, discussionQuestion: definition.discussionQuestion, feedback: feedback(definition) };
}
// Vista del auditorio: descripción genérica y pregunta de discusión, sin detalles privados ni respuestas.
export function projectorIncident(share, teamName) {
  if (!share?.visible) return { visible: false, version: share?.version ?? 0 };
  const definition = incidentByCode(share.code);
  return { visible: true, version: share.version, teamName, phase: definition.phaseId, category: definition.category, severity: definition.severity, title: definition.title, genericDescription: definition.genericDescription, discussionQuestion: definition.discussionQuestion, ...(share.learning ? { learningPoint: definition.learningPoint, preventedIn: definition.preventedIn.map(id => PHASES[id - 1].title) } : {}) };
}
export const catalogForPhase = phase => INCIDENTS.filter(item => item.phaseId === phase).map(({ code, title, severity, category }) => ({ code, title, severity, category }));
