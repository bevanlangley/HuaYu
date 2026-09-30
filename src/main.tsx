import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Guard: fail fast if required env vars are missing
const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
for (const key of requiredVars) {
  if (!import.meta.env[key]) {
    // Hardcoded hex here is intentional: this bypasses React/Tailwind entirely (raw innerHTML) so
    // the failure message still renders even if the app bundle itself is broken.
    document.body.innerHTML = `<div style="font-family:sans-serif;padding:2rem;color:#991b1b;">
      <h1>Configuration error</h1>
      <p>Missing required environment variable: <code>${key}</code></p>
      <p>Create a <code>.env.local</code> file with this variable and restart the dev server.</p>
    </div>`
    throw new Error(`Missing env var: ${key}`)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
