import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import OwnerDashboard from './OwnerDashboard.jsx'

const isOwnerPage = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isOwnerPage ? <OwnerDashboard /> : <App />}
  </StrictMode>,
)
