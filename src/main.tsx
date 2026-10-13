import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { BusinessProvider } from './contexts/BusinessContext'
import { BranchProvider } from './contexts/BranchContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <BusinessProvider>
          <BranchProvider>
            <App />
          </BranchProvider>
        </BusinessProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
)