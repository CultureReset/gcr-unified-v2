import { useNavigate, useLocation } from 'react-router-dom'
import './PageHeader.css'

export default function PageHeader({ title, subtitle, showBack = true, rightAction = null }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Show back button only if not on home/landing
  const showBackBtn = showBack && location.pathname !== '/' && location.pathname !== '/home'

  return (
    <header className="page-header">
      <div className="page-header-content">
        {showBackBtn ? (
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
        ) : (
          <div className="logo-small" onClick={() => navigate('/')}>
            GCR
          </div>
        )}

        <div className="page-title-section">
          {title && <h1 className="page-title">{title}</h1>}
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>

        {rightAction ? (
          <div className="right-action">{rightAction}</div>
        ) : (
          <div style={{ width: '40px' }} />
        )}
      </div>
    </header>
  )
}
