import { getNursingContent } from '../content/scenarioOverlay';
import { APP_VERSION, STORAGE_SCHEMA_VERSION } from '../domain/types';
import { createSessionId } from '../domain/session';
import type { NursingSession } from './types';

export function createNursingSession(now = new Date()): NursingSession {
  const nursing = getNursingContent();
  const startedAt = now.toISOString();
  return {
    id: createSessionId(),
    schemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    scenarioId: nursing.meta.id,
    scenarioVersion: nursing.meta.version,
    rubricVersion: nursing.meta.rubricVersion,
    startedAt,
    updatedAt: startedAt,
    lastResumedAt: startedAt,
    pauseStartedAt: null,
    accumulatedActiveMs: 0,
    status: 'in_progress',
    currentStepId: nursing.meta.startStepId,
    history: [],
    sbar: { situation: '', background: '', assessment: '', recommendation: '' },
    mediaState: 'observeren',
    criticalErrors: [],
    audioUnlocked: false,
  };
}

export function currentNursingStep(session: NursingSession) {
  return getNursingContent().steps.find((step) => step.id === session.currentStepId);
}
