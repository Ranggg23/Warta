import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const savedTheme = localStorage.getItem('wartakini_theme');
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch {
  // Ignore storage access errors
}

createRoot(document.getElementById('root')!).render(<App />);
