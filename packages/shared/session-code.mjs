// Fecha y hora programadas del evento (Colombia), no fecha del dispositivo.
export function sessionStatisticsCode(session) {
  const date = session.startAt.slice(0, 10).replaceAll('-', '');
  const time = session.startAt.slice(11, 16).replace(':', '');
  return `ING-${date}-${time}-${session.id.toUpperCase()}`;
}
