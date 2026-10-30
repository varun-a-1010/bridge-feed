import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/newsreader/index.css';
import '@fontsource-variable/instrument-sans/index.css';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
