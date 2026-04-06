import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { seedOfflineData } from './utils/seedData'

// تهيئة البيانات التجريبية في وضع Offline
seedOfflineData();

createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <App />
  </HashRouter>
);
