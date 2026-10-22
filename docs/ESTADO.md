# Estado frente a TODO_IngenIA.md

## Implementado y verificado por pruebas automatizadas

- API modular con persistencia SQLite y contratos compartidos; dos sesiones en horario Colombia.
- Roles PRESENTADOR, PARTICIPANTE y PROYECTOR con autenticación por token opaco/cookie y autorización por sala.
- Máquina WAITING / ACTIVE(1..5) / PAUSED / FINISHED, bloqueo reusable y permisos efectivos del servidor.
- Comandos transaccionales, versión optimista, idempotencia y bitácora de cambios.
- Reloj controlado por conferencista; SSE con reconexión e hidratación del estado vigente.
- Demo mínima: idea, fixture de código estático, justificación de auditoría educativa, mitigaciones y GO/NO GO con reporte privado.
- Pruebas HTTP que cubren los casos 1–15 en el alcance de esta base. El caso 12 usa solicitudes atrasadas; no prueba workers que aún no existen.

## Preparado, sin validación de despliegue/navegador

- Vistas de participante, Control Center y proyector; responsive CSS, foco visible y escape de contenido.
- Dockerfile, Compose con volumen y límites, y workflow de CI. No se ejecutó Docker porque no está instalado; CI se ejecutará cuando se publique el repositorio.
- Script de respaldo consistente. No existe todavía programación automatizada de copias.

## Pendientes que impiden declarar M0/M1/M2 terminados

- ZIP Beta 0.2 ausente: no se pudo hacer auditoría comparativa, conservar ZIP ni migrar su diseño. El imagotipo oficial ya fue recibido e integrado en las tres vistas; su validación visual sigue pendiente.
- Ensayo simultáneo en navegadores y teléfonos, accesibilidad y carga con cantidad objetivo definida.
- QR, identidad nominal si se requiere y recuperación de acceso al perder cookie. Ya hay membresías por acceso de navegador, equipos compartidos de hasta seis y búsqueda de nombres por sala.
- Autosave, editor guiado completo, categorías, preview de app más completo, selección de escenarios y rúbrica/puntuación.
- Moderación, preguntas, selección consentida de demos, modo explicación y funciones complementarias.
- Observabilidad operativa, política de datos y retención, pruebas de recuperación y preparación de red/TLS.
- IA opcional, PostgreSQL/pubsub para múltiples instancias, colas y sandbox de procesos: no implementados ni necesarios para ejecutar esta demo local de una instancia.

El TODO original se conserva sin marcar hitos completos: su Definition of Done requiere el ensayo real y funciones adicionales.
