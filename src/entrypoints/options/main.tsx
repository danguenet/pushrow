import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/options/App';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/controls.css';
import '@/options/styles/layout.css';
import '@/options/styles/destinations.css';
import '@/options/styles/rules.css';
import '@/options/styles/activity.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
