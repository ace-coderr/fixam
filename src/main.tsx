import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/archivo';
import './styles/global.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Fixam needs a #root element to mount into.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
