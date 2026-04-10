import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppContextProvider } from './context/AppContext'

// Force localhost to use network IP for WebRTC signaling to work across devices
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  const networkIP = '192.168.100.80'
  const port = window.location.port || '1420'
  const protocol = window.location.protocol
  const pathname = window.location.pathname
  const search = window.location.search
  const hash = window.location.hash
  window.location.href = `${protocol}//${networkIP}:${port}${pathname}${search}${hash}`
  // Stop rendering until redirect completes
  throw new Error('Redirecting to network IP...')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppContextProvider>
      <App />
    </AppContextProvider>
  </StrictMode>,
)
