export type Role = 'PRESENTER' | 'PARTICIPANT' | 'PROJECTOR';
export type Phase = 1 | 2 | 3 | 4 | 5;
export type SessionStatus = 'WAITING' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
export type Action = 'idea' | 'generate' | 'audit' | 'fix' | 'publish';
export interface PhaseCommand {
  action: 'START' | 'PRACTICE' | 'ADVANCE' | 'PAUSE' | 'RESUME' | 'EXTEND' | 'REOPEN' | 'ITERATE' | 'FINISH';
  expectedVersion: number; idempotencyKey: string; seconds?: number;
  phase?: Phase; confirm?: boolean; reason?: string;
}
export interface SessionState {
  id: string; statisticsCode: string; title: string; startAt: string; endAt: string; status: SessionStatus;
  activePhase: Phase | null; version: number; deadline: number | null; remainingMs: number;
  teamReview?: {visible:boolean;version:number;teamId?:string;teamName?:string;memberCount?:number;phase?:Phase;title?:string;pages?:string[];page?:number};
  phaseStage?: 'THEORY' | 'PRACTICE';
  /** Ciclo Generar → Auditar → Corregir; empieza en 1. */
  iteration?: number;
  phaseNotes?: Record<Phase, {phase:Phase;content:string;version:number;updatedAt:number}>;
  mode: 'DEMO'; serverTime: number; role: Role;
  permissions: Record<Action, boolean>; summary: { total: number; participants: number; completed: number };
}
export interface PhaseLockedError { error: 'PHASE_LOCKED'; currentPhase: Phase | null; requiredPhase: Phase; sessionStatus: SessionStatus; requestId: string }
export type SessionEvent = 'team.review.updated' | 'phase.practice' | 'presenter.notes.updated' | 'phase.closed' | 'state' | 'session.started' | 'phase.opened' | 'session.paused' | 'session.resumed' | 'session.finished' | 'timer.updated' | 'team.progress';

export interface TeamSuggestion { id: string; name: string; sessionId: string; sessionTitle: string; memberCount: number; full: boolean }
export interface TeamSearchRequest { code?: string; sessionId?: 'tarde' | 'noche'; query: string }
export interface TeamSearchResponse { teams: TeamSuggestion[]; maxMembers: 6 }
export interface JoinRequest { code?: string; name: string; fullName: string; email: string; sessionId?: 'tarde' | 'noche'; teamId?: string }

export interface ParticipantNote { content: string; version: number; updatedAt: number | null }

export type TeamRole = 'Product' | 'Tech Lead' | 'AI Developer' | 'QA' | 'Security' | 'DevOps';
export interface ParticipantProfile { fullName: string; email: string | null; teamRole: TeamRole | null }
