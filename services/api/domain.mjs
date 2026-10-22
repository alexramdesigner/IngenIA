import { ACTION_PHASE, MAX_ITERATIONS, PHASES, PHASE_COUNT, LOOP_FROM, LOOP_TO } from '../../packages/shared/phases.mjs';
export class ApiError extends Error {
  constructor(status, code, meta = {}) { super(code); Object.assign(this, { status, code, meta }); }
}
// Las entregas solo se aceptan en práctica de la fase indicada; teoría, reflexión y cierre son de lectura.
export function requireActivePhase(session, phase) {
  if (session.status !== 'ACTIVE' || session.activePhase !== phase || session.phaseStage !== 'PRACTICE') {
    throw new ApiError(403, 'PHASE_LOCKED', { currentPhase: session.activePhase, requiredPhase: phase, sessionStatus: session.status, phaseStage: session.phaseStage ?? null });
  }
}
export function permissions(session, role) {
  return Object.fromEntries(Object.entries(ACTION_PHASE).map(([a, p]) => [a, role === 'PARTICIPANT' && session.status === 'ACTIVE' && session.activePhase === p && session.phaseStage === 'PRACTICE']));
}
const practiceSeconds = phase => PHASES[phase - 1].duration * 60;
export function transition(s, command, now = Date.now()) {
  if (s.status === 'FINISHED') throw new ApiError(409, 'SESSION_FINISHED');
  if (command.seconds !== undefined && (!Number.isInteger(command.seconds) || command.seconds < 1 || command.seconds > 14400)) throw new ApiError(400, 'INVALID_DURATION');
  const next = { ...s };
  const live = ['ACTIVE', 'PAUSED'].includes(s.status);
  const stage = (phaseStage, extra = {}) => Object.assign(next, { phaseStage, stageStartedAt: now, deadline: null, remainingMs: 0 }, extra);
  switch (command.action) {
    case 'START':
      if (s.status !== 'WAITING') throw new ApiError(409, 'INVALID_TRANSITION');
      stage('THEORY', { status: 'ACTIVE', activePhase: 1, iteration: 1 }); break;
    case 'PRACTICE':
      if (s.status !== 'ACTIVE' || s.phaseStage !== 'THEORY') throw new ApiError(409, 'INVALID_TRANSITION');
      stage('PRACTICE', { deadline: now + (command.seconds ?? practiceSeconds(s.activePhase)) * 1000 }); break;
    case 'REFLECT':
      if (s.status !== 'ACTIVE' || s.phaseStage !== 'PRACTICE') throw new ApiError(409, 'INVALID_TRANSITION');
      stage('REFLECTION'); break;
    case 'CLOSE':
      if (s.status !== 'ACTIVE' || s.phaseStage !== 'REFLECTION') throw new ApiError(409, 'INVALID_TRANSITION');
      stage('CLOSED'); break;
    case 'ADVANCE':
      if (s.status !== 'ACTIVE' || s.activePhase >= PHASE_COUNT) throw new ApiError(409, 'INVALID_TRANSITION');
      stage('THEORY', { activePhase: s.activePhase + 1 }); break;
    case 'REOPEN':
      if (!command.confirm || !live || !Number.isInteger(command.phase) || command.phase < 1 || command.phase > PHASE_COUNT) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      stage('THEORY', { status: 'ACTIVE', activePhase: command.phase }); break;
    case 'ITERATE':
      // Verificación → Construcción: nueva iteración directa a práctica con el prompt ajustado.
      if (!command.confirm) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      if (!live || s.activePhase !== LOOP_FROM) throw new ApiError(409, 'INVALID_TRANSITION');
      if ((s.iteration ?? 1) >= MAX_ITERATIONS) throw new ApiError(409, 'ITERATION_LIMIT');
      stage('PRACTICE', { status: 'ACTIVE', activePhase: LOOP_TO, iteration: (s.iteration ?? 1) + 1, deadline: now + (command.seconds ?? practiceSeconds(LOOP_TO)) * 1000 }); break;
    case 'PAUSE':
      if (s.status !== 'ACTIVE') throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next, { status: 'PAUSED', remainingMs: s.deadline ? Math.max(0, s.deadline - now) : 0, deadline: null }); break;
    case 'RESUME':
      if (s.status !== 'PAUSED') throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next, { status: 'ACTIVE', deadline: s.phaseStage === 'PRACTICE' ? now + s.remainingMs : null, remainingMs: 0 }); break;
    case 'EXTEND': {
      if (!live || s.phaseStage !== 'PRACTICE') throw new ApiError(409, 'INVALID_TRANSITION');
      const extra = (command.seconds ?? 300) * 1000;
      if (s.status === 'ACTIVE') next.deadline = Math.max(s.deadline ?? now, now) + extra;
      else next.remainingMs += extra;
      break;
    }
    case 'FINISH':
      if (!command.confirm) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      Object.assign(next, { status: 'FINISHED', deadline: null, remainingMs: 0 }); break;
    default: throw new ApiError(400, 'INVALID_COMMAND');
  }
  next.version++;
  return next;
}
