import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { IS_DEMO } from './api';
import App from './App';
import { AuthProvider } from './auth';
import './styles.css';

// A static web host cannot answer /admin/... addresses, so the demo uses #/admin/... addresses.
const Router = IS_DEMO ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Router><AuthProvider><App /></AuthProvider></Router></React.StrictMode>,
);
