import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetScenarioContent } from '../content/scenarioOverlay';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Not Found', { status: 404 })),
  );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetScenarioContent();
  vi.unstubAllGlobals();
});
