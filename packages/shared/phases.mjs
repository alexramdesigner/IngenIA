// Catálogo único de fases INGGEN AI-DSE: fuente de verdad para servidor, Studio, proyector y participantes.
// AI-DSE es una propuesta didáctica de Inggen basada en SDLC, Scrum/Agile, especificación verificable,
// TDD, DevSecOps y revisión humana; no es una norma oficial. La IA de la experiencia es simulada.
export const PHASES = [
  {
    id: 1, order: 1, slug: 'discovery', title: 'Descubrimiento', action: 'discovery', duration: 12,
    objective: 'Comprender el problema real antes de pedirle código a la IA.',
    theory: 'Una app útil empieza por entender a quién ayuda y qué necesita resolver. Pedir código sin validar el problema produce soluciones para el público equivocado.',
    mission: 'Identifiquen el problema real, a quién afecta y qué solución mínima necesita.',
    instructions: ['Elijan el proyecto del equipo.', 'Describan al usuario principal y el problema que enfrenta.', 'Prioricen tres funciones.', 'Registren al menos una restricción o supuesto que deba validarse.'],
    deliverable: 'Ficha con usuario, problema, tres funciones y una restricción.',
    acceptanceCriteria: 'La ficha nombra un usuario concreto, un problema observable, tres funciones y una restricción por validar.',
    incidentCategories: ['requirements']
  },
  {
    id: 2, order: 2, slug: 'specification', title: 'Especificación', action: 'specification', duration: 12,
    objective: 'Convertir la idea en comportamientos que se puedan comprobar.',
    theory: 'Las historias de usuario y los criterios de aceptación dicen qué debe pasar y cómo sabremos que funciona. Incluir el caso de error evita sorpresas después.',
    mission: 'Conviertan la idea en comportamientos concretos y verificables.',
    instructions: ['Redacten dos historias de usuario.', 'Escriban tres criterios de aceptación observables.', 'Incluyan un caso alterno o de error.'],
    deliverable: 'Dos historias, tres criterios y un escenario negativo.',
    acceptanceCriteria: 'Cada criterio describe un resultado observable y el escenario negativo indica qué debe ocurrir ante el error.',
    incidentCategories: ['requirements', 'validation']
  },
  {
    id: 3, order: 3, slug: 'architecture', title: 'Arquitectura', action: 'architecture', duration: 12,
    objective: 'Decidir cómo se organiza la app y cómo protege sus datos.',
    theory: 'La arquitectura define dónde viven los datos, quién puede acceder a ellos y qué tan fácil será cambiar la app. La autorización se comprueba en el servidor, no en el navegador.',
    mission: 'Decidan cómo se organizará la app y cómo protegerá sus datos.',
    instructions: ['Seleccionen una arquitectura entre las alternativas simuladas.', 'Definan los datos principales y el flujo de acceso.', 'Escriban una regla de autorización.', 'Justifiquen su decisión.'],
    deliverable: 'Decisión arquitectónica con justificación, datos y control de acceso.',
    acceptanceCriteria: 'La decisión explica por qué la alternativa soporta los datos y define quién puede hacer qué.',
    incidentCategories: ['architecture', 'authorization']
  },
  {
    id: 4, order: 4, slug: 'construction', title: 'Construcción con IA', action: 'construction', duration: 15,
    objective: 'Generar un prototipo simulado a partir de requisitos y límites claros.',
    theory: 'Un buen prompt reúne contexto, alcance, arquitectura y criterios de aceptación. El resultado de la IA se examina: lo que no coincide con lo pedido es un hallazgo, no un detalle.',
    mission: 'Generen un prototipo simulado a partir de requisitos y límites claros.',
    instructions: ['Elaboren el prompt con contexto, alcance, arquitectura y criterios de aceptación.', 'Generen una versión del prototipo.', 'Examinen el resultado y documenten qué coincide y qué difiere.'],
    deliverable: 'Prompt, versión generada y revisión de correspondencia.',
    acceptanceCriteria: 'La revisión compara el prototipo con los criterios de aceptación y señala al menos una diferencia o confirma la coincidencia.',
    incidentCategories: ['dependencies', 'secrets', 'traceability']
  },
  {
    id: 5, order: 5, slug: 'verification', title: 'Verificación', action: 'verification', duration: 12,
    objective: 'Comprobar el prototipo y explicar los riesgos encontrados.',
    theory: 'Una prueba útil compara el resultado con lo esperado, incluidos los casos negativos. Cada hallazgo necesita una prueba de regresión que demuestre que se corrigió.',
    mission: 'Comprueben el prototipo y expliquen los riesgos encontrados.',
    instructions: ['Revisen los escenarios de prueba simulados.', 'Identifiquen al menos un hallazgo y su impacto.', 'Propongan una prueba que compruebe la corrección.'],
    deliverable: 'Hallazgo clasificado, evidencia y prueba de regresión.',
    acceptanceCriteria: 'El hallazgo indica categoría, severidad, impacto y una prueba de regresión verificable.',
    incidentCategories: ['testing', 'authorization']
  },
  {
    id: 6, order: 6, slug: 'delivery', title: 'Entrega y aprendizaje', action: 'delivery', duration: 10,
    objective: 'Decidir si la app está lista y qué hacer ante un problema en producción.',
    theory: 'Publicar es una decisión informada: se revisan pendientes y riesgos, se prepara la reversión y se aprende para la siguiente iteración.',
    mission: 'Decidan si la app está lista y qué harían ante un problema en producción.',
    instructions: ['Revisen los pendientes y riesgos.', 'Decidan publicar, publicar con condiciones o detener.', 'Definan un plan de reversión y una mejora para la siguiente iteración.'],
    deliverable: 'Decisión razonada, riesgo residual, rollback y retrospectiva.',
    acceptanceCriteria: 'La decisión se justifica con el riesgo residual e incluye un plan de reversión concreto.',
    incidentCategories: ['operations', 'observability']
  }
];
export const PHASE_COUNT = PHASES.length;
// Subestados didácticos de cada fase; Studio es la autoridad que los cambia.
export const STAGES = ['THEORY', 'PRACTICE', 'REFLECTION', 'CLOSED'];
export const STAGE_LABELS = { THEORY: 'Teoría', PRACTICE: 'Práctica', REFLECTION: 'Reflexión', CLOSED: 'Cerrada' };
// Ciclo de mejora: desde Verificación se vuelve a Construcción hasta este número de iteraciones.
export const MAX_ITERATIONS = 3;
export const LOOP_FROM = 5;
export const LOOP_TO = 4;
// Acciones de participantes y la fase en la que se permiten.
export const ACTION_PHASE = { discovery: 1, specification: 2, architecture: 3, generate: 4, construction: 4, verification: 5, delivery: 6 };
