import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AuthPage from './AuthPage.jsx';
import { getToken } from './lib/api';
import './index.css';

function Root() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getToken()));
  useEffect(() => {
    const sync = () => setAuthenticated(Boolean(getToken()));
    window.addEventListener('auth-changed', sync);
    return () => window.removeEventListener('auth-changed', sync);
  }, []);
  return authenticated ? <App /> : <AuthPage />;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);