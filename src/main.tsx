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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/hallowmoon">
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
);
