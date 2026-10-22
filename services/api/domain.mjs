import { ACTION_PHASE, MAX_ITERATIONS } from '../../packages/shared/phases.mjs';
export class ApiError extends Error {
  constructor(status, code, meta = {}) { super(code); Object.assign(this, { status, code, meta }); }
}
export function requireActivePhase(session, phase) {
  if (session.status !== 'ACTIVE' || session.activePhase !== phase || session.phaseStage === 'THEORY') {
    throw new ApiError(403, 'PHASE_LOCKED', { currentPhase: session.activePhase, requiredPhase: phase, sessionStatus: session.status });
  }
}
export function permissions(session, role) {
  return Object.fromEntries(Object.entries(ACTION_PHASE).map(([a, p]) => [a, role === 'PARTICIPANT' && session.status === 'ACTIVE' && session.activePhase === p && session.phaseStage !== 'THEORY']));
}
export function transition(s, command, now = Date.now()) {
  if (s.status === 'FINISHED') throw new ApiError(409, 'SESSION_FINISHED');
  const seconds = command.seconds ?? 1200;
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 14400) throw new ApiError(400, 'INVALID_DURATION');
  const next = { ...s };
  switch (command.action) {
    case 'START':
      if (s.status !== 'WAITING') throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next, { status: 'ACTIVE', activePhase: 1, phaseStage:'THEORY', deadline:null, remainingMs:0 }); break;
    case 'ADVANCE':
      if (s.status !== 'ACTIVE' || s.activePhase >= 5) throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next, { activePhase: s.activePhase + 1, phaseStage:'THEORY', deadline:null, remainingMs:0 }); break;
    case 'REOPEN':
      if (!command.confirm || !['ACTIVE', 'PAUSED'].includes(s.status) || !Number.isInteger(command.phase) || command.phase < 1 || command.phase > 5) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      Object.assign(next, { status: 'ACTIVE', activePhase: command.phase, phaseStage:'THEORY', deadline:null, remainingMs:0 }); break;
    case 'ITERATE':
      // Corregir → Generar: nueva iteración directa a práctica con el prompt ajustado.
      if (!command.confirm) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      if (!['ACTIVE', 'PAUSED'].includes(s.status) || s.activePhase !== 4) throw new ApiError(409, 'INVALID_TRANSITION');
      if ((s.iteration ?? 1) >= MAX_ITERATIONS) throw new ApiError(409, 'ITERATION_LIMIT');
      Object.assign(next, { status: 'ACTIVE', activePhase: 2, phaseStage: 'PRACTICE', deadline: now + seconds * 1000, remainingMs: 0, iteration: (s.iteration ?? 1) + 1 }); break;
    case 'PRACTICE':
      if (s.status !== 'ACTIVE' || s.phaseStage !== 'THEORY') throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next,{phaseStage:'PRACTICE',deadline:now+seconds*1000,remainingMs:0});break;
    case 'PAUSE':
      if (s.status !== 'ACTIVE') throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next, { status: 'PAUSED', remainingMs: s.deadline ? Math.max(0, s.deadline - now) : 0, deadline: null }); break;
    case 'RESUME':
      if (s.status !== 'PAUSED') throw new ApiError(409, 'INVALID_TRANSITION');
      Object.assign(next, { status: 'ACTIVE', deadline: s.phaseStage === 'THEORY' ? null : now + s.remainingMs, remainingMs: 0 }); break;
    case 'EXTEND':
      if (s.phaseStage === 'THEORY') throw new ApiError(409, 'INVALID_TRANSITION');
      if (!['ACTIVE', 'PAUSED'].includes(s.status)) throw new ApiError(409, 'INVALID_TRANSITION');
      if (s.status === 'ACTIVE') next.deadline += seconds * 1000;
      else next.remainingMs += seconds * 1000;
      break;
    case 'FINISH':
      if (!command.confirm) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      Object.assign(next, { status: 'FINISHED', deadline: null }); break;
    default: throw new ApiError(400, 'INVALID_COMMAND');
  }
  next.version++;
  return next;
}
