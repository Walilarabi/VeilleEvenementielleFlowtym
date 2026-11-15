import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </AuthProvider>
);
