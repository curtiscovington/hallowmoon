import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { GameProvider } from './state/GameContext';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true).catch((error: unknown) => {
      console.error('Failed to update service worker', error);
    });
  },
  onRegisterError(error: unknown) {
    console.error('SW registration failed', error);
  }
});

function resolveBasename(): string {
  const baseFromEnv = import.meta.env.BASE_URL ?? '/';
  if (baseFromEnv !== '/' && baseFromEnv !== './') {
    return baseFromEnv.endsWith('/') ? baseFromEnv.slice(0, -1) : baseFromEnv;
  }

  const path = window.location.pathname;
  const target = '/hallowmoon';
  const lowerPath = path.toLowerCase();
  const index = lowerPath.indexOf(target);

  if (index >= 0) {
    const match = path.slice(0, index + target.length);
    return match.endsWith('/') ? match.slice(0, -1) : match;
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    return `/${segments[0]}`;
  }

  return '';
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={resolveBasename()}>
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
);
