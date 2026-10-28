import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { initImageCachePrewarm } from './utils/imageUtils';
import './index.css';

// Instant pre-warming of critical images (photo header & chat images) in background
if (typeof window !== 'undefined') {
  initImageCachePrewarm().catch(() => {});
}

// Capture early PWA beforeinstallprompt event before React mounts
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('tmf2_beforeinstallprompt', { detail: e }));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);

