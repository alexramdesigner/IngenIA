// Proyectos que un equipo puede elegir en Descubrimiento. El prototipo simulado siempre corresponde
// al proyecto elegido; una discrepancia solo puede aparecer como incidente intencional.
export const PROJECT_TYPES = [
  { id: 'reservas', title: 'Reserva de eventos universitarios', entity: 'reserva', entities: 'reservas' },
  { id: 'tareas', title: 'Gestor de tareas de estudio', entity: 'tarea', entities: 'tareas' },
  { id: 'prestamos', title: 'Préstamo de equipos de laboratorio', entity: 'préstamo', entities: 'préstamos' },
  { id: 'tutorias', title: 'Agenda de tutorías', entity: 'tutoría', entities: 'tutorías' }
];
export const ARCHITECTURES = [
  { id: 'static', title: 'Página estática sin servidor', summary: 'Rápida de publicar; no guarda datos compartidos ni puede comprobar permisos.' },
  { id: 'client-api', title: 'Cliente web + API + base de datos', summary: 'Datos persistentes y autorización comprobada en el servidor.' },
  { id: 'managed', title: 'Servicio gestionado con reglas de acceso', summary: 'Menos código propio; la seguridad depende de configurar bien las reglas.' }
];
export const FINDING_CATEGORIES = ['Funcional', 'Seguridad', 'Privacidad', 'Calidad de datos', 'Usabilidad'];
export const SEVERITIES = ['Baja', 'Media', 'Alta', 'Crítica'];
export const RELEASE_DECISIONS = [
  { id: 'PUBLISH', title: 'Publicar' },
  { id: 'PUBLISH_WITH_CONDITIONS', title: 'Publicar con condiciones' },
  { id: 'STOP', title: 'Detener' }
];
export const DELIVERABLE_STATUS = { draft: 'Borrador', submitted: 'Enviado', accepted: 'Aceptado', needs_review: 'Requiere revisión' };
// Entregado: cuenta para el avance; "requiere revisión" vuelve a quedar pendiente.
export const isDelivered = deliverable => ['submitted', 'accepted'].includes(deliverable?.status);
export const projectType = id => PROJECT_TYPES.find(type => type.id === id);
