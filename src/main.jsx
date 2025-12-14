import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StandaloneChart from './components/StandaloneChart.jsx'

const path = window.location.pathname;

if (path.startsWith('/chart/')) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <StandaloneChart />
    </StrictMode>,
  )
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
