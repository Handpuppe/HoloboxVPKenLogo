import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { aphasiaIntakeScenario } from '../data/aphasiaIntakeScenario';
import { mediaSlots } from '../media/scenarioMedia';
import {
  nursingLearningObjectives,
  nursingPatient,
  nursingScenarioMeta,
  nursingSteps,
} from '../nursing/scenario';
import { renderApp } from '../test/renderApp';
import {
  LOGOPEDIE_OVERLAY_URL,
  NURSING_OVERLAY_URL,
  fallbackNursingContent,
  loadLogopedieScenario,
  loadNursingContent,
  parseLogopedieOverlay,
  parseNursingOverlay,
} from './scenarioOverlay';

const validLogopedieEnvelope = {
  schemaVersion: 1 as const,
  module: 'logopedie' as const,
  scenario: {
    ...aphasiaIntakeScenario,
    title: 'Overlay-intake',
    client: { ...aphasiaIntakeScenario.client, name: 'Overlay Erik' },
  },
};

const validNursingEnvelope = {
  schemaVersion: 1 as const,
  module: 'verpleegkunde' as const,
  meta: { ...nursingScenarioMeta, title: 'Overlay-ABCDE' },
  patient: { ...nursingPatient, name: 'Overlay patiënt' },
  learningObjectives: [...nursingLearningObjectives],
  steps: nursingSteps.map((step, index) =>
    index === 0 ? { ...step, question: 'Overlay-vraag A?' } : step,
  ),
  mediaSlots: [...mediaSlots],
};

describe('scenario overlay loader', () => {
  it('falls back to TypeScript when JSON is missing', async () => {
    const logopedie = await loadLogopedieScenario(async () => null);
    const nursing = await loadNursingContent(async () => null);
    expect(logopedie).toBe(aphasiaIntakeScenario);
    expect(nursing.steps).toBe(nursingSteps);
    expect(nursing.patient).toBe(nursingPatient);
    expect(nursing.mediaSlots).toBe(mediaSlots);
  });

  it('falls back to TypeScript when the envelope is invalid', async () => {
    const wrongModule = await loadLogopedieScenario(async () => ({
      schemaVersion: 1,
      module: 'verpleegkunde',
      scenario: aphasiaIntakeScenario,
    }));
    const badVersion = await loadLogopedieScenario(async () => ({
      schemaVersion: 2,
      module: 'logopedie',
      scenario: aphasiaIntakeScenario,
    }));
    const invalidScenario = await loadLogopedieScenario(async () => ({
      schemaVersion: 1,
      module: 'logopedie',
      scenario: { ...aphasiaIntakeScenario, nodes: aphasiaIntakeScenario.nodes.slice(0, 2) },
    }));
    const unreadable = await loadLogopedieScenario(async () => {
      throw new Error('parse');
    });
    expect(wrongModule).toBe(aphasiaIntakeScenario);
    expect(badVersion).toBe(aphasiaIntakeScenario);
    expect(invalidScenario).toBe(aphasiaIntakeScenario);
    expect(unreadable).toBe(aphasiaIntakeScenario);
    expect(parseLogopedieOverlay('{broken')).toBeNull();
  });

  it('loads a valid logopedie envelope', async () => {
    const loaded = await loadLogopedieScenario(async () => validLogopedieEnvelope);
    expect(loaded).not.toBe(aphasiaIntakeScenario);
    expect(loaded.title).toBe('Overlay-intake');
    expect(loaded.client.name).toBe('Overlay Erik');
  });

  it('falls back when nursing overlay fails the light check', async () => {
    const tooFewSteps = parseNursingOverlay({
      ...validNursingEnvelope,
      steps: nursingSteps.slice(0, 9),
    });
    const unknownNext = parseNursingOverlay({
      ...validNursingEnvelope,
      steps: nursingSteps.map((step, index) =>
        index === 0
          ? {
              ...step,
              options: step.options.map((option) => ({ ...option, nextStepId: 'n-onbekend' })),
            }
          : step,
      ),
    });
    const unknownSlot = parseNursingOverlay({
      ...validNursingEnvelope,
      steps: nursingSteps.map((step, index) =>
        index === 0 ? { ...step, mediaSlotId: 'nursing-ontbreekt' } : step,
      ),
    });
    expect(tooFewSteps).toBeNull();
    expect(unknownNext).toBeNull();
    expect(unknownSlot).toBeNull();
    expect(
      await loadNursingContent(async () => ({
        ...validNursingEnvelope,
        steps: nursingSteps.slice(0, 9),
      })),
    ).toEqual(fallbackNursingContent());
  });

  it('loads a valid nursing envelope', async () => {
    const loaded = await loadNursingContent(async () => validNursingEnvelope);
    expect(loaded.meta.title).toBe('Overlay-ABCDE');
    expect(loaded.patient.name).toBe('Overlay patiënt');
    expect(loaded.steps[0]?.question).toBe('Overlay-vraag A?');
    expect(loaded.steps).toHaveLength(10);
  });

  it('requests the overlay URLs via fetch and falls back on 404', async () => {
    const fetchMock = vi.mocked(fetch);
    const logopedie = await loadLogopedieScenario();
    const nursing = await loadNursingContent();
    expect(logopedie).toBe(aphasiaIntakeScenario);
    expect(nursing.steps).toBe(nursingSteps);
    expect(fetchMock).toHaveBeenCalledWith(LOGOPEDIE_OVERLAY_URL, { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith(NURSING_OVERLAY_URL, { cache: 'no-store' });
  });
});

describe('scenario overlay runtime', () => {
  it('shows overlay copy when a valid logopedie envelope is served', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('logopedie.json')) {
        return new Response(JSON.stringify(validLogopedieEnvelope), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('btn-module-logopedie'));
    await user.click(screen.getByTestId('btn-start-simulation'));
    expect(screen.getByText(/Overlay Erik/)).toBeInTheDocument();
  });

  it('shows overlay copy when a valid nursing envelope is served', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('verpleegkunde.json')) {
        return new Response(JSON.stringify(validNursingEnvelope), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('btn-module-nursing'));
    await user.click(screen.getByTestId('btn-start-nursing'));
    expect(screen.getByText(/Overlay patiënt/)).toBeInTheDocument();
    expect(screen.queryByText('Overlay-vraag A?')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('btn-start-nursing-sim'));
    expect(screen.getByText('Overlay-vraag A?')).toBeInTheDocument();
  });
});
