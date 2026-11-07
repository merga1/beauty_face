import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './AdminApp.jsx';
import './styles.css';
import './components.css';
import './admin.css';

const Application = window.location.pathname.startsWith('/admin') ? AdminApp : App;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>,
);
