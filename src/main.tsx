import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { startCloudSync } from './utils/cloudSync';
import { registerServiceWorker } from './utils/pwa';
import { applyTheme, getTheme } from './utils/theme';

applyTheme(getTheme());
registerServiceWorker(); // offline support, production builds only

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in index.html');

// Logged-in learners: keep progress in step with the copy saved online.
startCloudSync();

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
