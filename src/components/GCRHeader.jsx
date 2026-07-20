import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './GCRHeader.css'

import { SMS_NUMBER } from '../config'
const LOYALTY_PHONE = SMS_NUMBER
const LOYALTY_KEYWORD = 'BEACH'

function LoyaltyModal({ onClose }) {
  return (
    <div className="loyalty-overlay" onClick={onClose}>
      <div className="loyalty-modal" onClick={e => e.stopPropagation()}>
        <button className="loyalty-close" onClick={onClose}>✕</button>
        <div className="loyalty-emoji">⭐</div>
        <h2 className="loyalty-title">Join Our Loyalty Program</h2>
        <p className="loyalty-desc">Text <strong>BEACH</strong> to sign up for deals, specials &amp; rewards while you're on the Gulf Coast!</p>

        <a
          className="loyalty-sms-btn"
          href={`sms:${LOYALTY_PHONE}?body=${LOYALTY_KEYWORD}`}
        >
          📱 Tap to Text BEACH → Sign Up
        </a>

        <div className="loyalty-divider">or text manually</div>

        <div className="loyalty-number">{LOYALTY_PHONE}</div>
        <p className="loyalty-hint">Send the word <strong>BEACH</strong> to that number</p>
      </div>
    </div>
  )
}

const CATEGORIES = [
  { id: 'restaurants', label: 'Restaurants', emoji: '🍽️' },
  { id: 'coffee', label: 'Coffee & Sweets', emoji: '☕' },
  { id: 'happy-hours', label: 'Happy Hours', emoji: '🍻' },
  { id: 'events', label: 'Events', emoji: '🎉' },
  { id: 'things-to-do', label: 'Things To Do', emoji: '🎯' },
  { id: 'marinas', label: 'Marinas', emoji: '⚓' },
  { id: 'services', label: 'Services', emoji: '🛠️' },
  { id: 'public-spots', label: 'Public Spots', emoji: '✨' },
  { id: 'deals', label: '🔥 Deals', emoji: '🔥' },
  { id: 'feed', label: 'Live Feed', emoji: '📡' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'staying', label: 'Staying', emoji: '🏨' },
  { id: 'nightlife', label: 'Bars & Nightlife', emoji: '🍸' },
  { id: 'wellness', label: 'Health & Wellness', emoji: '💆' },
]

export default function GCRHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { userId } = useApp()
  const headerRef = useRef(null)
  const [showLoyalty, setShowLoyalty] = useState(false)

  const currentPath = location.pathname.slice(1)
  const activeCat = CATEGORIES.find(c => c.id === currentPath)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => {
      const h = el.offsetHeight
      document.documentElement.style.setProperty('--gcr-header-h', h + 'px')
    }
    update()
    setTimeout(update, 100)
    setTimeout(update, 500)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header className="gcr-header" ref={headerRef}>
      {/* Row 1: Logo + actions */}
      <div className="gcr-header-top">
        <div className="gcr-logo" onClick={() => navigate('/')}>
          <img src="/gcr-logo.png" alt="Gulf Coast Radar" className="logo-img" onError={e => e.target.style.display='none'} />
          <span className="logo-text">GULF<span className="logo-coast">COAST</span>RADAR</span>
        </div>
        <div className="gcr-header-right">
          <button className="trip-swipe-btn" onClick={() => navigate('/swipe/restaurants')}>
            👆 Swipe
          </button>
          {userId ? (
            <button className="header-auth-btn" onClick={() => navigate('/profile')}>👤</button>
          ) : (
            <button className="header-auth-btn" onClick={() => navigate('/auth')}>Sign In</button>
          )}
        </div>
      </div>

      {/* Row 2: Category Tabs */}
      <div className="gcr-cat-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`cat-tab ${activeCat?.id === cat.id ? 'active' : ''}`}
            onClick={() => navigate(`/${cat.id}`)}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {showLoyalty && <LoyaltyModal onClose={() => setShowLoyalty(false)} />}
    </header>
  )
}
