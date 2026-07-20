import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import { API_BASE } from '../config'
import { useApp } from '../context/AppContext'
import './Search.css'

// ─── Type filters for date search ────────────────────────────────────────────
const AVAIL_TYPES = [
  { id: 'all',          label: 'All',           emoji: '🌊' },
  { id: 'charter',      label: 'Charters',      emoji: '🎣' },
  { id: 'photographer', label: 'Photography',   emoji: '📸' },
  { id: 'rental',       label: 'Rentals',       emoji: '🚤' },
  { id: 'activity',     label: 'Activities',    emoji: '🏄' },
  { id: 'stay',         label: 'Condos & Stays', emoji: '🏖' },
]

// Saved availability searches — device-local for now (a cross-device table
// is specced in the API's migration file). Shape: {id, label, type, date_from, date_to, query}
const SAVED_KEY = 'gcr_saved_searches'
function loadSavedSearches() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || [] } catch (e) { return [] }
}
function storeSavedSearches(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20))) } catch (e) {}
}

const SLOT_STATUS = {
  available: { label: 'Available',    color: '#22c55e', icon: '🟢' },
  limited:   { label: 'Limited',      color: '#f59e0b', icon: '🟡' },
  full:      { label: 'Full',         color: '#ef4444', icon: '🔴' },
  unknown:   { label: 'Tracking',     color: '#94a3b8', icon: '📊' },
}

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Availability result card ─────────────────────────────────────────────────
function AvailCard({ biz, navigate }) {
  const [expanded, setExpanded] = useState(false)
  const photo = biz.hero_image_url
  const slots = biz.slots || []
  const availDates = biz.available_dates || []
  const hasSlots = slots.length > 0

  return (
    <div className="avail-card" onClick={() => navigate(`/business/${biz.slug}`)}>
      <div className="avail-card-row">
        {photo
          ? <div className="avail-card-photo" style={{ backgroundImage: `url(${photo})` }} />
          : <div className="avail-card-photo avail-card-photo--empty">{biz.icon || '📍'}</div>
        }
        <div className="avail-card-info">
          <div className="avail-card-name">{biz.name}</div>
          <div className="avail-card-meta">
            {biz.rating && <span>⭐ {Number(biz.rating).toFixed(1)}</span>}
            {biz.city && <span>📍 {biz.city}</span>}
            {biz.price_from && <span>💰 From ${biz.price_from}{biz.price_unit ? `/${biz.price_unit}` : ''}</span>}
            {biz.distance_miles != null && (
              <span className="avail-dist">
                {biz.distance_miles < 0.1 ? 'Here' : biz.distance_miles < 10 ? `${biz.distance_miles.toFixed(1)} mi` : `${Math.round(biz.distance_miles)} mi`}
              </span>
            )}
          </div>

          {/* Availability summary */}
          {hasSlots ? (
            <div className="avail-card-status">
              <span className="avail-dot avail-dot--open" />
              <span className="avail-open-label">
                {availDates.length === 1
                  ? `Open ${fmtDate(availDates[0])}`
                  : `Open ${availDates.length} day${availDates.length !== 1 ? 's' : ''} in your range`}
              </span>
              {biz.lowest_remaining != null && biz.lowest_remaining <= 5 && (
                <span className="avail-spots-badge">
                  {biz.lowest_remaining === 1 ? '🔴 Last spot!' : `🟡 ${biz.lowest_remaining} spots`}
                </span>
              )}
            </div>
          ) : biz.booking_url ? (
            <div className="avail-card-status avail-card-status--check">
              <span>📅 Check availability</span>
            </div>
          ) : (
            <div className="avail-card-status avail-card-status--contact">
              <span>📞 Contact to book</span>
            </div>
          )}
        </div>
        <button
          className="avail-view-btn"
          onClick={e => { e.stopPropagation(); navigate(`/business/${biz.slug}`) }}
        >
          View →
        </button>
      </div>

      {/* Slot details — expandable */}
      {hasSlots && (
        <>
          <button
            className="avail-expand-btn"
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
          >
            {expanded ? '▲ Hide slots' : `▼ Show ${slots.length} available slot${slots.length !== 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div className="avail-slots-list" onClick={e => e.stopPropagation()}>
              {slots.map((slot, i) => {
                const st = SLOT_STATUS[slot.status] || SLOT_STATUS.available
                return (
                  <div key={i} className="avail-slot-row">
                    <div className="avail-slot-date">{fmtDate(slot.availability_date)}</div>
                    {slot.time_slot && (
                      <div className="avail-slot-time">{fmt12(slot.time_slot)}{slot.end_time ? ` – ${fmt12(slot.end_time)}` : ''}</div>
                    )}
                    <div className="avail-slot-tag" style={{ color: st.color }}>
                      {st.icon} {slot.remaining_spots != null ? `${slot.remaining_spots} open` : st.label}
                    </div>
                  </div>
                )
              })}
              {biz.booking_url && (
                <a
                  href={biz.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="avail-book-inline"
                  onClick={e => e.stopPropagation()}
                >
                  📅 Book Now
                </a>
              )}
              {!biz.booking_url && biz.phone && (
                <a
                  href={`tel:${biz.phone.replace(/\D/g, '')}`}
                  className="avail-book-inline avail-book-inline--call"
                  onClick={e => e.stopPropagation()}
                >
                  📞 Call to Book
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── MAIN SEARCH PAGE ─────────────────────────────────────────────────────────
export default function Search() {
  const navigate = useNavigate()
  const { userLocation, tourist, userId } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''

  // Mode: 'keyword' | 'dates'
  const [mode, setMode] = useState('keyword')

  // Keyword search state
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState(query)
  const [sortByDist, setSortByDist] = useState(false)
  const [radius, setRadius] = useState('')
  const [fuzzyMatch, setFuzzyMatch] = useState(false)
  const [toast, setToast] = useState(null)
  const debounceRef = useRef(null)

  // Date search state
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(tourist?.arrival?.slice(0, 10) || today)
  const [dateTo, setDateTo] = useState(tourist?.departure?.slice(0, 10) || today)
  const [availType, setAvailType] = useState('all')
  const [availQuery, setAvailQuery] = useState('')
  const [availResults, setAvailResults] = useState(null)
  const [availLoading, setAvailLoading] = useState(false)
  const [savedSearches, setSavedSearches] = useState(loadSavedSearches)
  const [availError, setAvailError] = useState(null)

  // Pre-fill dates from tourist profile
  useEffect(() => {
    if (tourist?.arrival) setDateFrom(tourist.arrival.slice(0, 10))
    if (tourist?.departure) setDateTo(tourist.departure.slice(0, 10))
  }, [tourist?.arrival, tourist?.departure])

  // ── Keyword search ────────────────────────────────────────────────────────
  useEffect(() => {
    setSearchInput(query)
    if (!query.trim()) { setResults([]); setLoading(false); return }
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const body = { query, limit: 100 }
        if (userLocation) { body.lat = userLocation.lat; body.lng = userLocation.lng }
        if (radius) body.radius = radius
        const res = await fetch(`${API_BASE}/api/gcr/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setResults(data.results || [])
        setFuzzyMatch(!!data.fuzzy_match)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [query, userLocation, radius])

  const handleInputChange = (e) => {
    const val = e.target.value
    setSearchInput(val)
    clearTimeout(debounceRef.current)
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => setSearchParams({ q: val.trim() }, { replace: true }), 400)
    } else if (!val.trim()) setResults([])
  }

  const handleSearch = (e) => {
    e.preventDefault()
    clearTimeout(debounceRef.current)
    if (searchInput.trim()) setSearchParams({ q: searchInput.trim() }, { replace: true })
  }

  const handleShare = () => {
    const url = `${window.location.origin}/search?q=${encodeURIComponent(query)}`
    if (navigator.share) {
      navigator.share({ title: `Search: "${query}"`, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      setToast({ message: 'Link copied!', type: 'success' })
    }
  }

  // ── Date search ───────────────────────────────────────────────────────────
  async function runAvailSearch() {
    if (!dateFrom) return
    try {
      setAvailLoading(true)
      setAvailError(null)
      const body = { date_from: dateFrom, date_to: dateTo || dateFrom, type: availType }
      if (availQuery.trim()) body.query = availQuery.trim()
      if (userLocation) { body.lat = userLocation.lat; body.lng = userLocation.lng }
      const res = await fetch(`${API_BASE}/api/gcr/availability-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setAvailResults(data)
    } catch (err) {
      setAvailError(err.message)
    } finally {
      setAvailLoading(false)
    }
  }

  function saveCurrentSearch() {
    if (!dateFrom) return
    const t = AVAIL_TYPES.find(x => x.id === availType)
    const label = `${t ? t.emoji + ' ' + t.label : availType} · ${dateFrom}${dateTo && dateTo !== dateFrom ? ' → ' + dateTo : ''}${availQuery.trim() ? ' · "' + availQuery.trim() + '"' : ''}`
    const entry = { id: Date.now(), label, type: availType, date_from: dateFrom, date_to: dateTo || dateFrom, query: availQuery.trim() }
    const next = [entry, ...savedSearches.filter(s => s.label !== label)]
    setSavedSearches(next); storeSavedSearches(next)
  }

  function runSavedSearch(s) {
    setAvailType(s.type); setDateFrom(s.date_from); setDateTo(s.date_to); setAvailQuery(s.query || '')
    setTimeout(() => { runAvailSearchWith(s) }, 0)
  }

  async function runAvailSearchWith(s) {
    try {
      setAvailLoading(true); setAvailError(null)
      const body = { date_from: s.date_from, date_to: s.date_to, type: s.type }
      if (s.query) body.query = s.query
      if (userLocation) { body.lat = userLocation.lat; body.lng = userLocation.lng }
      const res = await fetch(`${API_BASE}/api/gcr/availability-search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Search failed')
      setAvailResults(await res.json())
    } catch (err) { setAvailError(err.message) } finally { setAvailLoading(false) }
  }

  function removeSavedSearch(id) {
    const next = savedSearches.filter(s => s.id !== id)
    setSavedSearches(next); storeSavedSearches(next)
  }

  const totalItems = results.reduce((n, r) => n + (r.matched_menu_items?.length || 0) + (r.matched_specials?.length || 0), 0)

  return (
    <div className="search-page">

      {/* ── HEADER ── */}
      <div className="search-hero">
        <div className="search-hero-inner">

          {/* Mode toggle — dates mode only for logged-in users */}
          {userId && (
            <div className="search-mode-toggle">
              <button
                className={`search-mode-btn ${mode === 'keyword' ? 'active' : ''}`}
                onClick={() => setMode('keyword')}
              >
                🔍 Search
              </button>
              <button
                className={`search-mode-btn ${mode === 'dates' ? 'active' : ''}`}
                onClick={() => setMode('dates')}
              >
                📅 My Dates
              </button>
            </div>
          )}

          {/* Keyword search bar */}
          {mode === 'keyword' && (
            <form className="search-form" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search restaurants, charters, activities..."
                value={searchInput}
                onChange={handleInputChange}
                autoComplete="off"
                autoFocus
              />
              <button type="submit" className="search-submit">🔍</button>
            </form>
          )}

          {/* Date search controls */}
          {mode === 'dates' && (
            <div className="date-search-controls">
              <div className="date-search-label">Find what's available during your trip</div>
              {savedSearches.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 10px' }}>
                  {savedSearches.map(s => (
                    <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '5px 10px', borderRadius: 999, background: 'rgba(13,125,116,.1)', cursor: 'pointer' }}>
                      <span onClick={() => runSavedSearch(s)}>{s.label}</span>
                      <span onClick={() => removeSavedSearch(s.id)} style={{ opacity: .55, fontWeight: 700 }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="date-search-row">
                <div className="date-field">
                  <label>From</label>
                  <input type="date" value={dateFrom} min={today}
                    onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="date-field">
                  <label>To</label>
                  <input type="date" value={dateTo} min={dateFrom || today}
                    onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="date-type-pills">
                {AVAIL_TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`date-type-pill ${availType === t.id ? 'active' : ''}`}
                    onClick={() => setAvailType(t.id)}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <div className="date-search-bottom">
                <input
                  className="date-keyword-input"
                  placeholder="Optional keyword (e.g. dolphin, snapper)"
                  value={availQuery}
                  onChange={e => setAvailQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runAvailSearch()}
                />
                <button className="date-search-btn" onClick={runAvailSearch} disabled={availLoading}>
                  {availLoading ? '...' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {query.trim() && mode === 'keyword' && (
            <button className="search-share-btn" onClick={handleShare}>📤 Share</button>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="search-content">

        {/* ── KEYWORD RESULTS ── */}
        {mode === 'keyword' && (
          loading ? (
            <div className="search-loading">
              {[...Array(3)].map((_, i) => <div key={i} className="search-skeleton-card" />)}
            </div>
          ) : error ? (
            <div className="search-empty">
              <div>⚠️</div><div>Search failed — try again</div>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : !query.trim() ? (
            <div className="search-empty">
              <div style={{ fontSize: 40 }}>🔍</div>
              <div>Search for restaurants, charters, menu items &amp; more</div>
              {userId && (
                <button className="search-dates-cta" onClick={() => setMode('dates')}>
                  📅 Search by my trip dates instead
                </button>
              )}
            </div>
          ) : results.length === 0 ? (
            <div className="search-empty">
              <div style={{ fontSize: 40 }}>😕</div>
              <div>No results for &ldquo;<strong>{query}</strong>&rdquo;</div>
              <div style={{ fontSize: 13, color: '#8fa3b1', marginTop: 6 }}>Try a different keyword</div>
            </div>
          ) : (
            <>
              <div className="search-results-header">
                <span>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                  {totalItems > 0 && ` · ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
                  {' '}for &ldquo;{query}&rdquo;
                </span>
                {userLocation && (
                  <div className="search-header-controls">
                    <button
                      className={`search-sort-btn ${sortByDist ? 'active' : ''}`}
                      onClick={() => setSortByDist(s => !s)}
                    >
                      📍 {sortByDist ? 'Nearest first' : 'Sort: Nearest'}
                    </button>
                    <select
                      className="search-radius-select"
                      value={radius}
                      onChange={e => setRadius(e.target.value)}
                      aria-label="Limit results to a distance"
                    >
                      <option value="">Any distance</option>
                      <option value="5">Within 5 mi</option>
                      <option value="10">Within 10 mi</option>
                      <option value="25">Within 25 mi</option>
                      <option value="50">Within 50 mi</option>
                    </select>
                  </div>
                )}
              </div>
              {fuzzyMatch && (
                <div className="search-fuzzy-note">
                  No exact match for &ldquo;{query}&rdquo; — showing the closest names instead
                </div>
              )}
              {[...results]
                .sort((a, b) => sortByDist ? (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999) : 0)
                .map(biz => <SearchResultCard key={biz.slug} biz={biz} navigate={navigate} />)
              }
            </>
          )
        )}

        {/* ── DATE SEARCH RESULTS ── */}
        {mode === 'dates' && (
          availLoading ? (
            <div className="search-loading">
              {[...Array(4)].map((_, i) => <div key={i} className="search-skeleton-card" />)}
            </div>
          ) : availError ? (
            <div className="search-empty">
              <div>⚠️</div><div>Search failed — try again</div>
            </div>
          ) : !availResults ? (
            <div className="search-empty">
              <div style={{ fontSize: 48 }}>📅</div>
              <div style={{ fontWeight: 700, color: '#1a2433' }}>Find what's open during your trip</div>
              <div style={{ fontSize: 13, color: '#8fa3b1' }}>
                Pick your dates above and search — we'll show you who has spots available
              </div>
              <div className="avail-type-explain">
                <div className="avail-explain-item"><span>🎣</span><span>Fishing charters with open seats</span></div>
                <div className="avail-explain-item"><span>📸</span><span>Photographers with open sessions</span></div>
                <div className="avail-explain-item"><span>🚤</span><span>Boat &amp; equipment rentals</span></div>
                <div className="avail-explain-item"><span>🏄</span><span>Tours and activities</span></div>
              </div>
            </div>
          ) : availResults.results?.length === 0 ? (
            <div className="search-empty">
              <div style={{ fontSize: 40 }}>😕</div>
              <div>Nothing found for those dates</div>
              <div style={{ fontSize: 13, color: '#8fa3b1', marginTop: 6 }}>Try different dates or a different category</div>
            </div>
          ) : (
            <>
              <div className="search-results-header">
                <span>
                  {availResults.results.length} result{availResults.results.length !== 1 ? 's' : ''}
                  {availResults.with_availability > 0 && (
                    <span className="avail-live-count"> · 🟢 {availResults.with_availability} with live availability</span>
                  )}
                </span>
                <span className="avail-date-range">
                  {fmtDate(availResults.date_from)}{availResults.date_to !== availResults.date_from ? ` – ${fmtDate(availResults.date_to)}` : ''}
                </span>
                <button onClick={saveCurrentSearch}
                  style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, border: 'none', background: 'rgba(13,125,116,.14)', color: '#0d7d74', cursor: 'pointer' }}>
                  💾 Save search
                </button>
              </div>

              {/* Live availability section first */}
              {availResults.results.filter(r => r.has_availability).length > 0 && (
                <div className="avail-section">
                  <div className="avail-section-label">🟢 Live availability data</div>
                  {availResults.results
                    .filter(r => r.has_availability)
                    .map(biz => <AvailCard key={biz.slug} biz={biz} navigate={navigate} />)
                  }
                </div>
              )}

              {/* Others — bookable but no slot-level data yet */}
              {availResults.results.filter(r => !r.has_availability).length > 0 && (
                <div className="avail-section">
                  <div className="avail-section-label">📅 Also available — contact to book</div>
                  {availResults.results
                    .filter(r => !r.has_availability)
                    .map(biz => <AvailCard key={biz.slug} biz={biz} navigate={navigate} />)
                  }
                </div>
              )}
            </>
          )
        )}
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  )
}

// ─── Keyword search result card (unchanged) ────────────────────────────────────
const ITEMS_PREVIEW = 3

function SearchResultCard({ biz, navigate }) {
  const [showAll, setShowAll] = useState(false)
  const items = biz.matched_menu_items || []
  const specials = biz.matched_specials || []
  const events = biz.matched_events || []
  const allMatches = [
    ...items.map(i => ({ ...i, _type: 'menu' })),
    ...specials.map(s => ({ ...s, _type: 'special' })),
    ...events.map(e => ({ ...e, _type: 'event' })),
  ]
  const hasMatches = allMatches.length > 0
  const visible = showAll ? allMatches : allMatches.slice(0, ITEMS_PREVIEW)
  const photo = biz.photos?.[0]?.url || biz.hero_image_url

  return (
    <div className="sr-card">
      <div className="sr-biz-row" onClick={() => navigate(`/business/${biz.slug}`)}>
        {photo && <div className="sr-biz-photo" style={{ backgroundImage: `url(${photo})` }} />}
        <div className="sr-biz-info">
          <div className="sr-biz-name">{biz.name}</div>
          <div className="sr-biz-meta">
            {biz.rating && <span>⭐ {Number(biz.rating).toFixed(1)}</span>}
            {biz.city && <span>📍 {biz.city}</span>}
            {biz.price_range && <span>{biz.price_range}</span>}
            {biz.distance_miles != null && (
              <span className="sr-dist">
                {biz.distance_miles < 0.1 ? 'You are here' : biz.distance_miles < 10 ? `${biz.distance_miles.toFixed(1)} mi away` : `${Math.round(biz.distance_miles)} mi away`}
              </span>
            )}
          </div>
          {hasMatches && (
            <div className="sr-match-count">
              {items.length > 0 && `🍽️ ${items.length} match${items.length !== 1 ? 'es' : ''}`}
              {specials.length > 0 && ` · ✨ ${specials.length} special${specials.length !== 1 ? 's' : ''}`}
              {events.length > 0 && ` · 🎉 ${events.length} event${events.length !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>
        <button className="sr-view-btn">View →</button>
      </div>
      {hasMatches && (
        <div className="sr-matches">
          <div className="sr-items-list">
            {visible.map((item, i) => {
              if (item._type === 'menu') return (
                <div key={i} className="sr-item" onClick={() => navigate(`/business/${biz.slug}`)}>
                  <div className="sr-item-left">
                    <div className="sr-item-name">{item.item_name}</div>
                    {item.description && <div className="sr-item-desc">{item.description}</div>}
                  </div>
                  {item.price != null && <div className="sr-item-price">${Number(item.price).toFixed(2).replace(/\.00$/, '')}</div>}
                </div>
              )
              if (item._type === 'special') return (
                <div key={i} className="sr-item sr-item--special" onClick={() => navigate(`/business/${biz.slug}`)}>
                  <div className="sr-item-left">
                    <div className="sr-item-name">✨ {item.special_name || item.name}</div>
                    {(item.description || item.discount_text) && <div className="sr-item-desc">{item.description || item.discount_text}</div>}
                  </div>
                </div>
              )
              return (
                <div key={i} className="sr-item sr-item--event" onClick={() => navigate(`/business/${biz.slug}`)}>
                  <div className="sr-item-left">
                    <div className="sr-item-name">🎉 {item.event_name || item.name}</div>
                    {item.artist_name && <div className="sr-item-desc">🎤 {item.artist_name}</div>}
                  </div>
                  {item.event_date && <div className="sr-item-price" style={{ fontSize: 11 }}>{item.event_date}</div>}
                </div>
              )
            })}
          </div>
          {allMatches.length > ITEMS_PREVIEW && (
            <button className="sr-toggle" onClick={() => setShowAll(s => !s)}>
              {showAll ? '▲ Show less' : `▼ +${allMatches.length - ITEMS_PREVIEW} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
