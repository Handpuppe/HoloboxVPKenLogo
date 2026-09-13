import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { validateScenario } from '../domain/scenarioValidation';
import type { Scenario } from '../domain/types';
import { withBaseUrl } from '../media/baseUrl';
import { mediaSlots, setMediaSlotsOverride } from '../media/scenarioMedia';
import type { MediaSlotConfig } from '../media/types';
import {
  nursingLearningObjectives,
  nursingPatient,
  nursingScenarioMeta,
  nursingSteps,
} from '../nursing/scenario';
import type { NursingStep } from '../nursing/types';

export const LOGOPEDIE_OVERLAY_URL = withBaseUrl('/resources/scenarios/logopedie.json');
export const NURSING_OVERLAY_URL = withBaseUrl('/resources/scenarios/verpleegkunde.json');

export type NursingPatientProfile = typeof nursingPatient;
export type NursingScenarioMeta = typeof nursingScenarioMeta;

export interface NursingContent {
  meta: NursingScenarioMeta;
  patient: NursingPatientProfile;
  learningObjectives: string[];
  steps: NursingStep[];
  mediaSlots: MediaSlotConfig[];
}

export interface LoadedScenarioContent {
  logopedie: Scenario;
  nursing: NursingContent;
}

export type OverlayReader = (url: string) => Promise<unknown | null>;

export function fallbackNursingContent(): NursingContent {
  return {
    meta: nursingScenarioMeta,
    patient: nursingPatient,
    learningObjectives: nursingLearningObjectives,
    steps: nursingSteps,
    mediaSlots,
  };
}

export function fallbackScenarioContent(): LoadedScenarioContent {
  return {
    logopedie: aphasiaIntakeScenario,
    nursing: fallbackNursingContent(),
  };
}

let runtimeContent = fallbackScenarioContent();

export function getLogopedieScenario(): Scenario {
  return runtimeContent.logopedie;
}

export function getNursingContent(): NursingContent {
  return runtimeContent.nursing;
}

export function applyScenarioContent(content: LoadedScenarioContent): void {
  runtimeContent = content;
  setMediaSlotsOverride(
    content.nursing.mediaSlots === mediaSlots ? null : content.nursing.mediaSlots,
  );
}

export function resetScenarioContent(): void {
  runtimeContent = fallbackScenarioContent();
  setMediaSlotsOverride(null);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readOverlayJson(url: string): Promise<unknown | null> {
  try {
    if (typeof fetch !== 'function') {
      return null;
    }
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

export function parseLogopedieOverlay(data: unknown): Scenario | null {
  if (!isObject(data) || data.schemaVersion !== 1 || data.module !== 'logopedie') {
    return null;
  }
  if (!isObject(data.scenario)) {
    return null;
  }
  try {
    const scenario = data.scenario as unknown as Scenario;
    if (validateScenario(scenario).length > 0) {
      return null;
    }
    return scenario;
  } catch {
    return null;
  }
}

function isNursingMeta(value: unknown): value is NursingScenarioMeta {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.version === 'string' &&
    typeof value.rubricVersion === 'string' &&
    typeof value.title === 'string' &&
    typeof value.estimatedDuration === 'string' &&
    typeof value.startStepId === 'string'
  );
}

function isNursingPatient(value: unknown): value is NursingPatientProfile {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    typeof value.age === 'number' &&
    value.fictional === true &&
    typeof value.heightCm === 'number' &&
    typeof value.setting === 'string' &&
    typeof value.background === 'string' &&
    typeof value.studentRole === 'string'
  );
}

export function validateNursingOverlay(content: NursingContent): string[] {
  const issues: string[] = [];
  if (content.steps.length !== 10) {
    issues.push('Verpleegkunde-overlay heeft geen tien stappen.');
  }
  const stepIds = new Set(content.steps.map((step) => step.id));
  const slotIds = new Set(content.mediaSlots.map((slot) => slot.slotId));
  if (!stepIds.has(content.meta.startStepId)) {
    issues.push('Startstap ontbreekt.');
  }
  for (const step of content.steps) {
    if (!Array.isArray(step.options) || step.options.length !== 3) {
      issues.push(`Stap ${step.id} heeft geen drie opties.`);
      continue;
    }
    const qualities = step.options.map((option) => option.quality).sort();
    if (qualities.join() !== 'high,inappropriate,partial') {
      issues.push(`Stap ${step.id} mist de drie kwaliteitsniveaus.`);
    }
    if (!slotIds.has(step.mediaSlotId)) {
      issues.push(`Stap ${step.id} verwijst naar onbekende media-slot ${step.mediaSlotId}.`);
    }
    for (const option of step.options) {
      if (option.nextStepId !== 'completed' && !stepIds.has(option.nextStepId)) {
        issues.push(`Optie ${option.id} verwijst naar onbekende stap ${option.nextStepId}.`);
      }
      if (option.mediaSlotId && !slotIds.has(option.mediaSlotId)) {
        issues.push(`Optie ${option.id} verwijst naar onbekende media-slot ${option.mediaSlotId}.`);
      }
    }
  }
  return issues;
}

export function parseNursingOverlay(data: unknown): NursingContent | null {
  if (!isObject(data) || data.schemaVersion !== 1 || data.module !== 'verpleegkunde') {
    return null;
  }
  try {
    if (
      !isNursingMeta(data.meta) ||
      !isNursingPatient(data.patient) ||
      !Array.isArray(data.learningObjectives) ||
      !data.learningObjectives.every((item) => typeof item === 'string') ||
      !Array.isArray(data.steps) ||
      !Array.isArray(data.mediaSlots)
    ) {
      return null;
    }
    const content: NursingContent = {
      meta: data.meta,
      patient: data.patient,
      learningObjectives: data.learningObjectives,
      steps: data.steps as unknown as NursingStep[],
      mediaSlots: data.mediaSlots as unknown as MediaSlotConfig[],
    };
    if (validateNursingOverlay(content).length > 0) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

export async function loadLogopedieScenario(
  readJson: OverlayReader = readOverlayJson,
): Promise<Scenario> {
  try {
    const data = await readJson(LOGOPEDIE_OVERLAY_URL);
    return parseLogopedieOverlay(data) ?? aphasiaIntakeScenario;
  } catch {
    return aphasiaIntakeScenario;
  }
}

export async function loadNursingContent(
  readJson: OverlayReader = readOverlayJson,
): Promise<NursingContent> {
  try {
    const data = await readJson(NURSING_OVERLAY_URL);
    return parseNursingOverlay(data) ?? fallbackNursingContent();
  } catch {
    return fallbackNursingContent();
  }
}

export async function loadScenarioContent(
  readJson: OverlayReader = readOverlayJson,
): Promise<LoadedScenarioContent> {
  try {
    const [logopedie, nursing] = await Promise.all([
      loadLogopedieScenario(readJson),
      loadNursingContent(readJson),
    ]);
    return { logopedie, nursing };
  } catch {
    return fallbackScenarioContent();
  }
}
