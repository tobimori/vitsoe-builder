import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { bindShortcuts } from './editor/shortcuts'
import { syncPlan } from './editor/sync'
import './ui/reset.css'

const root = document.getElementById('root')
if (!root) throw new Error('The #root element is missing.')

syncPlan()
bindShortcuts()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
