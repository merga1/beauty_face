import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './AdminApp.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';
import './components.css';
import './admin.css';

const isAdmin = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? (
      // Admin section uses its own custom Express session auth — no Supabase Auth needed
      <AdminApp />
    ) : (
      // Customer-facing storefront is wrapped with Supabase AuthProvider
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>,
);
