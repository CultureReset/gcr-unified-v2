import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import GCRHeader from '../components/GCRHeader'
import { API_BASE, SMS_NUMBER } from '../config'
import './Landing.css'

// Same duplicate-entity-row problem CategoryPage.jsx guards against — a
// business scraped from more than one source can end up as multiple entity
// rows with slightly different name strings. Without this, the homepage
// rails could feature the same business twice among only ~10-12 slots.
function dedupeByName(entities) {
  const hasHashSlug = s => /[-_][A-Za-z0-9]{6,}$/.test(s || '') || /[-]\d+$/.test(s || '')
  const seen = new Map()
  for (const e of entities) {
    const key = (e.name || '').trim().toLowerCase()
    if (!seen.has(key)) { seen.set(key, e); continue }
    const prev = seen.get(key)
    const prevHash = hasHashSlug(prev.slug)
    const curHash = hasHashSlug(e.slug)
    if (prevHash && !curHash) seen.set(key, e)
    else if (!prevHash && curHash) { /* keep prev */ }
    else if (e.entity_subtype && !prev.entity_subtype) seen.set(key, e)
  }
  return Array.from(seen.values())
}

const HERO_IMG = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&q=80'
const SUPABASE_URL = 'https://mkepugvdlktfsossumox.supabase.co/storage/v1/object/public/entity-photos'

const WX_ICON  = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️', 77:'🌨️',
  80:'🌦️', 81:'🌦️', 82:'🌧️',
  85:'🌨️', 86:'❄️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
}
const WX_LABEL = {
  0:'Clear', 1:'Mostly Clear', 2:'Partly Cloudy', 3:'Overcast',
  45:'Foggy', 48:'Icy Fog',
  51:'Light Drizzle', 53:'Drizzle', 55:'Heavy Drizzle',
  61:'Light Rain', 63:'Rain', 65:'Heavy Rain',
  71:'Light Snow', 73:'Snow', 75:'Heavy Snow', 77:'Snow Grains',
  80:'Showers', 81:'Showers', 82:'Heavy Showers',
  85:'Snow Showers', 86:'Heavy Snow Showers',
  95:'Thunderstorm', 96:'Thunderstorm w/ Hail', 99:'Severe Thunderstorm',
}

const CATEGORIES = [
  { emoji:'🍽️', label:'Restaurants',   path:'/restaurants' },
  // AR Hunt moved up from last-of-9 — the category rail only shows ~2-3 cards
  // before needing a scroll on a phone-width viewport, so at the end it was
  // effectively invisible (no other nav entry links to /ar-hunts at all).
  { emoji:'🎯', label:'AR Hunt',       path:'/ar-hunts' },
  { emoji:'🍻', label:'Happy Hours',   path:'/happy-hours' },
  { emoji:'🎸', label:'Live Music',    path:'/events' },
  { emoji:'🎣', label:'Charters',      path:'/things-to-do' },
  { emoji:'🌊', label:'Water Fun',     path:'/swipe/things-to-do' },
  { emoji:'☕', label:'Coffee',        path:'/coffee' },
  { emoji:'🛍️', label:'Shopping',     path:'/shopping' },
  { emoji:'🏖️', label:'Stays',        path:'/stays' },
]

function imgUrl(url, slug) {
  if (!url) return null
  if (url.startsWith('https://') || url.startsWith('http://')) return url
  // broken /photos/slug/file.jpg path — reconstruct Supabase URL
  if (url.startsWith('/photos/')) {
    const parts = url.split('/')
    const pathSlug = parts[2]
    const file = parts[3] || 'photo_01.jpg'
    if (pathSlug) return `${SUPABASE_URL}/${pathSlug}/${file}`
    if (slug) return `${SUPABASE_URL}/${slug}/photo_01.jpg`
  }
  return null
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2,'0') : ''} ${h >= 12 ? 'PM' : 'AM'}`
}

// ─── Horizontal scroll rail ───────────────────────────────────────────
function Rail({ children, id }) {
  const ref = useRef()
  const scroll = () => ref.current?.scrollBy({ left: 260, behavior: 'smooth' })
  return (
    <div className="hn-rail-wrap">
      <div className="hn-rail" id={id} ref={ref}>{children}</div>
      <button className="hn-next" onClick={scroll} aria-label="Scroll">›</button>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────
function SectionHead({ eyebrow, title, sub, path, navigate }) {
  return (
    <div className="hn-sec-head">
      <div>
        <p className="hn-eyebrow">{eyebrow}</p>
        <h2 className="hn-h2">{title}</h2>
        {sub && <p className="hn-sec-sub">{sub}</p>}
      </div>
      {path && (
        <button className="hn-view-all" onClick={() => navigate(path)}>View All →</button>
      )}
    </div>
  )
}

// ─── Business card (tall, full-bleed photo) ───────────────────────────
function BizCard({ item, badge, badgeColor, sub, onClick, onSave, isSaved }) {
  const photo = imgUrl(item.hero_image_url, item.slug) || imgUrl(item.image_url, item.entity_slug)
  return (
    <article className="hn-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="hn-card-img" style={photo ? { backgroundImage:`url(${photo})` } : {}} />
      <div className="hn-card-overlay" />
      <div className="hn-card-body">
        <div className="hn-card-top">
          <span className="hn-emoji-icon">{item.icon || item.emoji || '📍'}</span>
          {badge && <span className={`hn-badge hn-badge-${badgeColor || 'teal'}`}>{badge}</span>}
        </div>
        <div className="hn-card-bottom">
          <h3 className="hn-card-name">{item.name || item.entity_name || item.event_name}</h3>
          {sub && <p className="hn-card-sub">{sub}</p>}
          <div className="hn-card-meta">
            {item.city && <span>📍 {item.city}</span>}
            {item.rating && <span>⭐ {item.rating}</span>}
          </div>
          <div className="hn-card-actions">
            <button className="hn-card-btn-primary">View Profile</button>
            <button className="hn-card-btn-save" aria-label="Save"
              onClick={e => { e.stopPropagation(); onSave?.(item) }}>
              {isSaved ? '❤️' : '♡'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Mini category pill card ──────────────────────────────────────────
function MiniCard({ emoji, label, onClick }) {
  return (
    <button className="hn-mini-card" onClick={onClick}>
      <span className="hn-mini-icon">{emoji}</span>
      <span className="hn-mini-label">{label}</span>
    </button>
  )
}

// ─── Happy Hour card (special layout) ────────────────────────────────
function HHCard({ item, onClick, onSave, isSaved, nowTime }) {
  const photo = imgUrl(item.hero_image_url, item.slug)
  const start = item.hh_start?.slice(0, 5)
  const end   = item.hh_end?.slice(0, 5)
  const isLiveNow = nowTime && start && end && nowTime >= start && nowTime <= end
  return (
    <article className="hn-card hn-hh-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="hn-card-img" style={photo ? { backgroundImage:`url(${photo})` } : {}} />
      <div className="hn-card-overlay" />
      <div className="hn-card-body">
        <div className="hn-card-top">
          <span className="hn-emoji-icon">🍻</span>
          <span className={`hn-badge ${isLiveNow ? 'hn-badge-green' : 'hn-badge-yellow'}`}>
            {isLiveNow ? '🟢 Live Now' : 'Happy Hour'}
          </span>
        </div>
        <div className="hn-card-bottom">
          <h3 className="hn-card-name">{item.name}</h3>
          <p className="hn-card-sub">{item.hh_description?.slice(0,80)}{item.hh_description?.length > 80 ? '…' : ''}</p>
          <div className="hn-card-meta">
            {item.city && <span>📍 {item.city}</span>}
            <span>🕐 {fmt12(item.hh_start)}–{fmt12(item.hh_end)}</span>
            {item.hh_days && <span>📅 {item.hh_days}</span>}
          </div>
          <div className="hn-card-actions">
            <button className="hn-card-btn-primary">View Details</button>
            <button className="hn-card-btn-save" aria-label="Save"
              onClick={e => { e.stopPropagation(); onSave?.(item) }}>
              {isSaved ? '❤️' : '♡'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Live music card ──────────────────────────────────────────────────
function MusicCard({ item, onClick, onSave, isSaved }) {
  const photo = imgUrl(item.image_url, null) || imgUrl(item.entity?.hero_image_url, item.entity_slug)
  return (
    <article className="hn-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="hn-card-img" style={photo ? { backgroundImage:`url(${photo})` } : {}} />
      <div className="hn-card-overlay" />
      <div className="hn-card-body">
        <div className="hn-card-top">
          <span className="hn-emoji-icon">🎸</span>
          <span className="hn-badge hn-badge-purple">Live Tonight</span>
        </div>
        <div className="hn-card-bottom">
          <h3 className="hn-card-name">{item.artist_name || item.event_name}</h3>
          <p className="hn-card-sub">@ {item.entity_name || item.entity?.name}</p>
          <div className="hn-card-meta">
            {item.entity?.city && <span>📍 {item.entity.city}</span>}
            {item.start_time && <span>🕐 {fmt12(item.start_time)}</span>}
            {item.cover_charge && <span>🎟️ ${item.cover_charge}</span>}
            {!item.cover_charge && <span>🎟️ Free</span>}
          </div>
          <div className="hn-card-actions">
            <button className="hn-card-btn-primary">See Show</button>
            <button className="hn-card-btn-save" aria-label="Save"
              onClick={e => { e.stopPropagation(); onSave?.(item.entity || item) }}>
              {isSaved ? '❤️' : '♡'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Activity card ────────────────────────────────────────────────────
function ActivityCard({ item, onClick, onSave, isSaved }) {
  const photo = imgUrl(item.hero_image_url, item.slug)
  const subtype = (item.entity_subtype || '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <article className="hn-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="hn-card-img" style={photo ? { backgroundImage:`url(${photo})` } : {}} />
      <div className="hn-card-overlay" />
      <div className="hn-card-body">
        <div className="hn-card-top">
          <span className="hn-emoji-icon">🌊</span>
          {subtype && <span className="hn-badge hn-badge-teal">{subtype.slice(0,18)}</span>}
        </div>
        <div className="hn-card-bottom">
          <h3 className="hn-card-name">{item.name}</h3>
          <div className="hn-card-meta">
            {item.city && <span>📍 {item.city}</span>}
            {item.price_from && <span>💰 From ${item.price_from}</span>}
            {item.duration_text && <span>⏱ {item.duration_text}</span>}
            {item.rating && <span>⭐ {item.rating}</span>}
          </div>
          <div className="hn-card-actions">
            <button className="hn-card-btn-primary">Book Now</button>
            <button className="hn-card-btn-save" aria-label="Save"
              onClick={e => { e.stopPropagation(); onSave?.(item) }}>
              {isSaved ? '❤️' : '♡'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Empty rail placeholder ───────────────────────────────────────────
function EmptyCard({ message }) {
  return (
    <div className="hn-empty-card">
      <span>{message}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MASTER CALENDAR MODAL
// ═══════════════════════════════════════════════════════════════════════

function CalSection({ emoji, title, count, children }) {
  if (!count) return null
  return (
    <div className="mc-section">
      <div className="mc-section-head">
        <span className="mc-section-emoji">{emoji}</span>
        <span className="mc-section-title">{title}</span>
        <span className="mc-section-count">{count}</span>
      </div>
      <div className="mc-section-body">{children}</div>
    </div>
  )
}

function CalRow({ photo, icon, title, sub, meta, badge, badgeColor, onClick }) {
  return (
    <div className="mc-row" onClick={onClick}>
      <div className="mc-row-img" style={photo ? { backgroundImage: `url(${photo})` } : {}}>
        {!photo && <span className="mc-row-icon">{icon || '📍'}</span>}
      </div>
      <div className="mc-row-body">
        <div className="mc-row-title">{title}</div>
        {sub && <div className="mc-row-sub">{sub}</div>}
        {meta && <div className="mc-row-meta">{meta}</div>}
      </div>
      {badge && (
        <div className="mc-row-badge" style={{ background: badgeColor || '#0b7a75' }}>{badge}</div>
      )}
    </div>
  )
}

function MasterCalendar({ feed, weather, navigate, onClose }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const happyHours    = feed?.happyHours    || []
  const happyHoursAll = feed?.happyHoursAll || []
  const liveMusic     = feed?.liveMusic     || []
  const events        = (feed?.events       || []).filter(e => !liveMusic.find(m => m.id === e.id))
  const specials      = feed?.specials      || []

  // All HH for today (not just active right now) for the calendar view
  const hhToday = happyHoursAll.length ? happyHoursAll : happyHours
  const totalItems = happyHours.length + liveMusic.length + events.length + specials.length

  return (
    <div className="mc-overlay" onClick={onClose}>
      <div className="mc-sheet" onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="mc-handle" />

        {/* Header */}
        <div className="mc-header">
          <div>
            <div className="mc-date">{dateStr}</div>
            <div className="mc-time-row">
              <span className="mc-time">{timeStr}</span>
              {weather && (
                <span className="mc-weather">
                  {weather.temp}°F · {weather.beachStatus?.label || '🏖️ Beach Open'}
                </span>
              )}
            </div>
          </div>
          <button className="mc-close" onClick={onClose}>✕</button>
        </div>

        {/* Summary bar */}
        <div className="mc-summary">
          {happyHours.length > 0 && (
            <div className="mc-sum-item mc-sum-hh">
              <span className="mc-sum-num">{happyHours.length}</span>
              <span>HH Now</span>
            </div>
          )}
          {liveMusic.length > 0 && (
            <div className="mc-sum-item mc-sum-music">
              <span className="mc-sum-num">{liveMusic.length}</span>
              <span>Live Music</span>
            </div>
          )}
          {events.length > 0 && (
            <div className="mc-sum-item mc-sum-events">
              <span className="mc-sum-num">{events.length}</span>
              <span>Events</span>
            </div>
          )}
          {specials.length > 0 && (
            <div className="mc-sum-item mc-sum-specials">
              <span className="mc-sum-num">{specials.length}</span>
              <span>Specials</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mc-body">

          {totalItems === 0 ? (
            <div className="mc-empty">
              <div style={{ fontSize: 48 }}>🌊</div>
              <div>Nothing posted for today yet</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
                Businesses update throughout the day
              </div>
            </div>
          ) : (
            <>
              {/* Happy Hours Active Now */}
              <CalSection emoji="🍻" title="Happy Hour — Active Now" count={happyHours.length}>
                {happyHours.map(b => (
                  <CalRow
                    key={b.slug}
                    photo={b.hero_image_url}
                    icon="🍻"
                    title={b.name}
                    sub={b.hh_description || null}
                    meta={b.hh_end ? `Until ${fmt12(b.hh_end)}` : null}
                    badge="LIVE"
                    badgeColor="#16a34a"
                    onClick={() => { onClose(); navigate(`/business/${b.slug}`) }}
                  />
                ))}
              </CalSection>

              {/* Live Music */}
              <CalSection emoji="🎸" title="Live Music Tonight" count={liveMusic.length}>
                {liveMusic.map(ev => (
                  <CalRow
                    key={ev.id}
                    photo={ev.image_url || ev.entity?.hero_image_url}
                    icon="🎸"
                    title={ev.artist_name || ev.event_name}
                    sub={ev.entity?.name || null}
                    meta={[
                      ev.start_time ? fmt12(ev.start_time) : null,
                      ev.cover_charge > 0 ? `$${ev.cover_charge} cover` : ev.cover_charge === 0 ? 'Free' : null,
                    ].filter(Boolean).join(' · ')}
                    badge={ev.start_time ? fmt12(ev.start_time) : 'Tonight'}
                    badgeColor="#7c3aed"
                    onClick={() => { onClose(); navigate(`/business/${ev.entity_slug}`) }}
                  />
                ))}
              </CalSection>

              {/* Events */}
              <CalSection emoji="🎉" title="Events Today" count={events.length}>
                {events.map(ev => (
                  <CalRow
                    key={ev.id}
                    photo={ev.image_url || ev.entity?.hero_image_url}
                    icon="🎉"
                    title={ev.event_name}
                    sub={ev.entity?.name || null}
                    meta={[
                      ev.start_time ? fmt12(ev.start_time) : null,
                      ev.cover_charge > 0 ? `$${ev.cover_charge}` : ev.cover_charge === 0 ? 'Free' : null,
                    ].filter(Boolean).join(' · ')}
                    badge={ev.start_time ? fmt12(ev.start_time) : null}
                    badgeColor="#0b7a75"
                    onClick={() => { onClose(); navigate(`/business/${ev.entity_slug}`) }}
                  />
                ))}
              </CalSection>

              {/* Daily Specials */}
              <CalSection emoji="⭐" title="Deals & Daily Specials" count={specials.length}>
                {specials.map(sp => (
                  <CalRow
                    key={sp.id}
                    photo={sp.image_url || sp.entity?.hero_image_url}
                    icon="⭐"
                    title={sp.title || sp.special_name}
                    sub={sp.entity?.name || null}
                    meta={sp.discount_text || sp.description?.slice(0, 60) || null}
                    badge="Special"
                    badgeColor="#d97706"
                    onClick={() => { onClose(); navigate(`/business/${sp.entity_slug}`) }}
                  />
                ))}
              </CalSection>
            </>
          )}

          {/* Footer CTA */}
          <div className="mc-footer">
            <button className="mc-full-btn" onClick={() => { onClose(); navigate('/events') }}>
              📅 Full Events Calendar →
            </button>
            <button className="mc-deals-btn" onClick={() => { onClose(); navigate('/deals') }}>
              🔥 All Deals →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
export default function Landing() {
  const navigate = useNavigate()
  const { savedPlaces, addSavedPlace, removeSavedPlace, userId } = useApp()
  const [searchVal, setSearchVal]     = useState('')
  const [weather, setWeather]         = useState(null)
  const [showLoyalty, setShowLoyalty] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [feed, setFeed]               = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [activities, setActivities]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [stays, setStays]             = useState([])
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled]     = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) { setIsInstalled(true); return }
    const handler = e => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (isIOS) { setShowInstallModal(true); return }
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setIsInstalled(true)
      setInstallPrompt(null)
    } else {
      setShowInstallModal(true)
    }
  }

  const savedSlugs = new Set((savedPlaces || []).map(p => p.slug))

  const handleSave = (item) => {
    if (!userId) { navigate('/auth'); return }
    const slug = item.slug || item.entity_slug
    if (!slug) return
    if (savedSlugs.has(slug)) {
      const existing = savedPlaces.find(p => p.slug === slug)
      if (existing) removeSavedPlace(existing.id)
    } else {
      addSavedPlace(item)
    }
  }

  const doSearch = useCallback(() => {
    if (searchVal.trim()) navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`)
  }, [searchVal, navigate])

  // Weather
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=30.246&longitude=-87.701&current_weather=true&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1&timezone=America%2FChicago')
      .then(r => r.json())
      .then(d => {
        const cw = d?.current_weather
        if (!cw) return
        const code = cw.weathercode ?? 0
        const wind = Math.round(cw.windspeed || 0)
        const beachStatus =
          (code >= 95) ? { label: '🚩 Beach Advisory', color: '#ff4444' } :
          (code >= 61 || wind > 25) ? { label: '🟡 Swim Caution', color: '#ffbb00' } :
          { label: '🏖️ Beach Open', color: '#6ef0b8' }
        setWeather({
          temp:  Math.round(cw.temperature),
          wind,
          code,
          beachStatus,
          hi: Math.round(d.daily?.temperature_2m_max?.[0] || 0),
          lo: Math.round(d.daily?.temperature_2m_min?.[0] || 0),
        })
      }).catch(() => {})
  }, [])

  // Home feed (happy hours, live music, events)
  useEffect(() => {
    fetch(`${API_BASE}/api/gcr/home-feed`)
      .then(r => r.json())
      .then(d => setFeed(d))
      .catch(() => setFeed({}))
  }, [])

  // Restaurants rail
  useEffect(() => {
    fetch(`${API_BASE}/api/gcr/entities?type=restaurants&limit=50`)
      .then(r => r.json())
      .then(d => {
        const all = dedupeByName(d.entities || [])
        // sort by rating desc, prefer those with photos
        const sorted = all
          .filter(e => e.hero_image_url)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        setRestaurants(sorted.slice(0, 12))
      })
      .catch(() => {})
  }, [])

  // Activities / things to do rail
  useEffect(() => {
    fetch(`${API_BASE}/api/gcr/entities?type=things-to-do&limit=50`)
      .then(r => r.json())
      .then(d => {
        const all = dedupeByName(d.entities || [])
        const sorted = all
          .filter(e => e.hero_image_url && e.city && ['Gulf Shores','Orange Beach'].includes(e.city))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        setActivities(sorted.length > 0 ? sorted.slice(0, 12) : all.filter(e => e.hero_image_url).slice(0, 12))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Stays / condos rail
  useEffect(() => {
    fetch(`${API_BASE}/api/gcr/entities?type=staying&limit=50`)
      .then(r => r.json())
      .then(d => {
        const all = dedupeByName(d.entities || [])
        const sorted = all
          .filter(e => e.hero_image_url && e.hero_image_url.startsWith('https://'))
          .filter(e => e.city && ['Gulf Shores','Orange Beach'].includes(e.city))
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        // fallback to any with photos if no GS/OB results
        setStays(
          sorted.length >= 3
            ? sorted.slice(0, 10)
            : all.filter(e => e.hero_image_url?.startsWith('https://')).slice(0, 10)
        )
      })
      .catch(() => {})
  }, [])

  const wxIcon = weather ? (WX_ICON[weather.code] || '🌤️') : '🌤️'
  const wxLabel = weather ? (WX_LABEL[weather.code] || 'Partly Cloudy') : '...'

  const happyHours    = feed?.happyHours    || []
  const happyHoursAll = feed?.happyHoursAll || []
  // Always show the full list of spots with happy hour deals — not just ones active this exact minute
  const hhToShow  = happyHoursAll.length > 0 ? happyHoursAll : happyHours
  const hhIsNow   = false
  const liveMusic  = feed?.liveMusic  || []
  const events     = feed?.events     || []
  // Combine live music + events, dedupe by id
  const allMusic = [...liveMusic, ...events.filter(e => !liveMusic.find(m => m.id === e.id))].slice(0, 10)

  return (
    <div className="hn-page">
      <GCRHeader />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="hn-hero" style={{ backgroundImage: `url(${HERO_IMG})` }}>
        <div className="hn-hero-overlay" />
        <div className="hn-hero-content">

          {/* Weather inline */}
          <div className="hn-wx-bar">
            {/* Only show temp/condition once weather actually loads — otherwise
                the bar printed a literal "... ..." placeholder. The beach
                status has a sensible default and always shows. */}
            {weather && <span>{wxIcon} {weather.temp}°F</span>}
            {weather && <span className="hn-wx-cond">{wxLabel}</span>}
            {weather?.hi > 0 && <span className="hn-wx-hi-lo">↑{weather.hi}° ↓{weather.lo}°</span>}
            {weather?.wind > 0 && <span className="hn-wx-wind">💨 {weather.wind}mph</span>}
            <span className="hn-wx-beach" style={weather?.beachStatus?.color ? {color: weather.beachStatus.color} : {}}>
              {weather?.beachStatus?.label || '🏖️ Beach Open'}
            </span>
          </div>

          <h1 className="hn-hero-h1">Everything<br/>on the<br/><span className="hn-teal">Gulf Coast</span></h1>

          {/* Search */}
          <div className="hn-search">
            <span className="hn-search-icon">🔍</span>
            <input
              className="hn-search-input"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder='Try "crab legs", "boat rental", "live music"...'
            />
            <button className="hn-search-btn" onClick={doSearch}>Search</button>
          </div>

          {/* Two action pills */}
          <div className="hn-hero-pills">
            <button className="hn-pill-gold" onClick={() => setShowLoyalty(true)}>📲 Get Deals & Alerts</button>
            <button className="hn-pill-ghost" onClick={() => setShowCalendar(true)}>📅 Master Calendar</button>
          </div>

          {/* Install app pill */}
          {!isInstalled && (
            <div className="hn-install-row">
              <button className="hn-install-pill" onClick={handleInstall}>
                ⬇️ Add to Home Screen — Free
              </button>
            </div>
          )}
        </div>

        {/* Wave */}
        <div className="hn-wave">
          <svg viewBox="0 0 1440 52" preserveAspectRatio="none">
            <path d="M0,32 C360,0 720,52 1080,28 C1260,16 1380,44 1440,32 L1440,52 L0,52Z" fill="#071827"/>
          </svg>
        </div>
      </section>

      {/* ── BODY ──────────────────────────────────────────────── */}
      <main className="hn-main">

        {/* Category mini-pills */}
        <section className="hn-cats">
          <Rail id="cat-rail">
            {CATEGORIES.map(c => (
              <MiniCard key={c.label} emoji={c.emoji} label={c.label} onClick={() => navigate(c.path)} />
            ))}
          </Rail>
        </section>

        {/* ── HAPPY HOURS ─────────────────────────────────────── */}
        <section className="hn-sec">
          <SectionHead
            eyebrow="Today's Deals"
            title="🍻 Happy Hours"
            sub={`${hhToShow.length} spots with happy hour deals — green badge means live right now`}
            path="/happy-hours"
            navigate={navigate}
          />
          <Rail id="hh-rail">
            {hhToShow.length > 0
              ? hhToShow.map(item => (
                  <HHCard key={item.slug} item={item}
                    onClick={() => navigate(`/business/${item.slug}`)}
                    onSave={handleSave}
                    isSaved={savedSlugs.has(item.slug)}
                    nowTime={feed?.meta?.serverTime}
                  />
                ))
              : <EmptyCard message="🍺 Happy hour data loading..." />
            }
          </Rail>
        </section>

        {/* ── LIVE MUSIC ──────────────────────────────────────── */}
        <section className="hn-sec">
          <SectionHead
            eyebrow="Tonight"
            title="🎸 Live Music"
            sub="Artists performing on the Gulf Coast"
            path="/events"
            navigate={navigate}
          />
          <Rail id="music-rail">
            {allMusic.length > 0
              ? allMusic.map(item => (
                  <MusicCard key={item.id} item={item}
                    onClick={() => navigate(`/business/${item.entity_slug}`)}
                    onSave={handleSave}
                    isSaved={savedSlugs.has(item.entity_slug || item.slug)}
                  />
                ))
              : <EmptyCard message="🎵 Live music events load daily" />
            }
          </Rail>
        </section>

        {/* ── THINGS TO DO ────────────────────────────────────── */}
        <section className="hn-sec">
          <SectionHead
            eyebrow="Get Outside"
            title="🌊 Things To Do"
            sub="Charters, boat rentals, parasailing & more"
            path="/things-to-do"
            navigate={navigate}
          />
          <Rail id="activity-rail">
            {activities.length > 0
              ? activities.filter(a => imgUrl(a.hero_image_url, a.slug)).slice(0, 10).map(item => (
                  <ActivityCard key={item.slug} item={item}
                    onClick={() => navigate(`/business/${item.slug}`)}
                    onSave={handleSave}
                    isSaved={savedSlugs.has(item.slug)}
                  />
                ))
              : [1,2,3].map(i => <div key={i} className="hn-card hn-skeleton" />)
            }
          </Rail>
        </section>

        {/* ── RESTAURANTS ─────────────────────────────────────── */}
        <section className="hn-sec">
          <SectionHead
            eyebrow="Eat & Drink"
            title="🍽️ Restaurants"
            sub="Seafood, Southern cooking & waterfront dining"
            path="/restaurants"
            navigate={navigate}
          />
          <Rail id="restaurant-rail">
            {restaurants.length > 0
              ? restaurants.filter(r => imgUrl(r.hero_image_url, r.slug)).slice(0, 10).map(item => (
                  <BizCard
                    key={item.slug}
                    item={item}
                    badge={item.price_range || 'Dining'}
                    badgeColor="orange"
                    sub={item.entity_subtype?.replace(/_/g,' ') || item.city}
                    onClick={() => navigate(`/business/${item.slug}`)}
                    onSave={handleSave}
                    isSaved={savedSlugs.has(item.slug)}
                  />
                ))
              : [1,2,3].map(i => <div key={i} className="hn-card hn-skeleton" />)
            }
          </Rail>
        </section>

        {/* ── STAYS ───────────────────────────────────────────── */}
        <section className="hn-sec hn-sec-light">
          <SectionHead
            eyebrow="Where To Stay"
            title="🏖️ Condos & Rentals"
            sub="Beachfront condos, vacation homes & resorts"
            path="/stays"
            navigate={navigate}
          />
          <Rail id="stay-rail">
            {stays.length > 0
              ? stays.map(item => (
                  <BizCard
                    key={item.slug}
                    item={item}
                    badge={item.entity_subtype?.replace(/_/g,' ').replace(/\w/g,c=>c.toUpperCase()) || 'Stay'}
                    badgeColor="blue"
                    sub={item.city}
                    onClick={() => navigate(`/business/${item.slug}`)}
                    onSave={handleSave}
                    isSaved={savedSlugs.has(item.slug)}
                  />
                ))
              : [1,2,3].map(i => <div key={i} className="hn-card hn-skeleton" />)
            }
          </Rail>
        </section>

        {/* ── SWIPE CTA ───────────────────────────────────────── */}
        <section className="hn-swipe-cta">
          <div className="hn-swipe-inner">
            <div>
              <h2>Not sure where to go?</h2>
              <p>Swipe through restaurants, activities & more — Tinder-style. Build your trip in seconds.</p>
            </div>
            <button className="hn-pill-gold" onClick={() => navigate('/swipe/restaurants')}>
              👆 Start Swiping
            </button>
          </div>
        </section>

      </main>

      {/* ── MASTER CALENDAR MODAL ─────────────────────────── */}
      {showCalendar && (
        <MasterCalendar
          feed={feed}
          weather={weather}
          navigate={navigate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* ── SMS MODAL ─────────────────────────────────────────── */}
      {showLoyalty && (
        <div className="ld-loyalty-overlay" onClick={() => setShowLoyalty(false)}>
          <div className="ld-loyalty-modal" onClick={e => e.stopPropagation()}>
            <button className="ld-loyalty-close" onClick={() => setShowLoyalty(false)}>✕</button>
            <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📲</div>
            <h2 style={{ fontSize:'1.4rem', fontWeight:900, marginBottom:'.5rem', color:'#1a1a1a' }}>Get Gulf Coast Deals</h2>
            <p style={{ fontSize:'.92rem', color:'#555', marginBottom:'1.25rem', lineHeight:1.5 }}>
              Text <strong>BEACH</strong> to get exclusive promos, happy hour alerts &amp; last-minute deals sent to your phone.
            </p>
            <a className="ld-loyalty-sms" href={`sms:${SMS_NUMBER}?body=BEACH`}>
              📱 Text BEACH to Sign Up
            </a>
            <p style={{ fontSize:'.78rem', color:'#aaa', marginTop:'.85rem' }}>
              Opens your Messages app pre-filled. Just hit send.
            </p>
          </div>
        </div>
      )}

      {/* ── INSTALL MODAL ─────────────────────────────────────────── */}
      {showInstallModal && (
        <div className="ld-loyalty-overlay" onClick={() => setShowInstallModal(false)}>
          <div className="ld-loyalty-modal" onClick={e => e.stopPropagation()}>
            <button className="ld-loyalty-close" onClick={() => setShowInstallModal(false)}>✕</button>
            <img src="/gcr-logo.png" alt="Gulf Coast Radar"
              style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', marginBottom: 12 }}
              onError={e => { e.target.style.display = 'none' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: 6, color: '#1a1a1a' }}>Add to Home Screen</h2>
            <p style={{ fontSize: '.88rem', color: '#555', marginBottom: 20, lineHeight: 1.5 }}>
              Free app — no App Store needed. Works on iPhone &amp; Android.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 20 }}>
              {(isIOS ? [
                { n: '1', text: <span>Tap the <strong>Share</strong> icon at the bottom of Safari</span> },
                { n: '2', text: <span>Tap <strong>"Add to Home Screen"</strong></span> },
                { n: '3', text: <span>Tap <strong>"Add"</strong> — done!</span> },
              ] : [
                { n: '1', text: <span>Tap the <strong>⋮ menu</strong> in Chrome (top right)</span> },
                { n: '2', text: <span>Tap <strong>"Add to Home screen"</strong></span> },
                { n: '3', text: <span>Tap <strong>"Add"</strong> — done!</span> },
              ]).map(step => (
                <div key={step.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7a75,#14B8A6)', color: 'white', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{step.n}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 4, color: '#1a2b3c' }}>{step.text}</div>
                </div>
              ))}
            </div>
            <button
              style={{ width: '100%', background: 'linear-gradient(135deg,#0b7a75,#14B8A6)', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              onClick={() => setShowInstallModal(false)}
            >Got it</button>
          </div>
        </div>
      )}
    </div>
  )
}
