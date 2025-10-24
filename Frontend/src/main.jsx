import React from 'react'
import ReactDOM from 'react-dom/client'
// This assumes App.jsx is in the same directory (src/) as main.jsx
import App from './App.jsx'
// This assumes index.css is in the same directory (src/) as main.jsx
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

