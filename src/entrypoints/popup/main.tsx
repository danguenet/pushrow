import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/popup/App';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/controls.css';
import '@/popup/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
