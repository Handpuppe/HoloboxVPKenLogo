import { render, waitFor, screen, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import type { ReactElement } from 'react';
import { expect } from 'vitest';
import { App } from '../App';
import { AppStateProvider } from '../state/AppState';

export async function renderApp(
  initialEntries: MemoryRouterProps['initialEntries'] = ['/'],
  options?: RenderOptions,
) {
  const view = render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </MemoryRouter>,
    options,
  );
  await waitFor(() => {
    expect(screen.getByTestId('app-ready')).toBeInTheDocument();
  });
  return view;
}

export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppStateProvider>{ui}</AppStateProvider>
    </MemoryRouter>,
  );
}
