import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CustomerApp } from './customer/CustomerApp'

const root = document.getElementById('customer-root')
if (!root) throw new Error('Missing #customer-root in customer.html')

createRoot(root).render(
  <StrictMode>
    <CustomerApp />
  </StrictMode>,
)