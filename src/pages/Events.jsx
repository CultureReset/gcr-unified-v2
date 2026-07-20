import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'
import './Events.css'

const FALLBACK_EVENT_IMG = 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80'

function fmt12(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12}:00 ${ap}`
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const EVENT_TYPE_MAP = {
  live_music:    { label: 'Live Music',      emoji: '🎸' },
  open_mic:      { label: 'Open Mic',        emoji: '🎙️' },
  dj:            { label: 'DJ Night',        emoji: '🎧' },
  karaoke:       { label: 'Karaoke',         emoji: '🎤' },
  trivia:        { label: 'Trivia',          emoji: '🎯' },
  bingo:         { label: 'Bingo',           emoji: '🎴' },
  comedy:        { label: 'Comedy',          emoji: '😂' },
  drag_show:     { label: 'Drag Show',       emoji: '💃' },
  open_bar:      { label: 'Open Bar',        emoji: '🍸' },
  happy_hour:    { label: 'Happy Hour',      emoji: '🍺' },
  food_special:  { label: 'Food Special',    emoji: '🍽️' },
  wine_tasting:  { label: 'Wine Tasting',    emoji: '🍷' },
  beer_tasting:  { label: 'Beer Tasting',    emoji: '🍻' },
  brunch_event:  { label: 'Brunch',          emoji: '🥂' },
  kids_event:    { label: 'Kids Event',      emoji: '🧒' },
  holiday:       { label: 'Holiday',         emoji: '🎉' },
  festival:      { label: 'Festival',        emoji: '🎪' },
  fundraiser:    { label: 'Fundraiser',      emoji: '❤️' },
  tournament:    { label: 'Tournament',      emoji: '🏆' },
  art_show:      { label: 'Art Show',        emoji: '🎨' },
  market:        { label: 'Market',          emoji: '🛍️' },
  special_event: { label: 'Special Event',   emoji: '⭐' },
  other:         { label: 'Event',           emoji: '📅' },
}

function getEventType(event) {
  if (event.event_type && EVENT_TYPE_MAP[event.event_type]) return event.event_type
  const s = ((event.event_name || '') + ' ' + (event.description || '')).toLowerCase()
  if (s.includes('karaoke')) return 'karaoke'
  if (s.includes('trivia')) return 'trivia'
  if (s.includes('bingo')) return 'bingo'
  if (s.includes('open mic') || s.includes('open jam')) return 'open_mic'
  if (s.includes('drag')) return 'drag_show'
  if (s.includes('comedy')) return 'comedy'
  if (s.includes('dj ') || s.includes(' dj')) return 'dj'
  if (s.includes('happy hour')) return 'happy_hour'
  if (s.includes('brunch')) return 'brunch_event'
  if (s.includes('wine')) return 'wine_tasting'
  if (s.includes('beer') && s.includes('tast')) return 'beer_tasting'
  if (s.includes('kids') || s.includes('children')) return 'kids_event'
  if (s.includes('festival')) return 'festival'
  if (s.includes('tournament') || s.includes('competition')) return 'tournament'
  if (s.includes('music') || s.includes('band') || s.includes('concert') || s.includes('live')) return 'live_music'
  return 'other'
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDateFilters() {
  const today = new Date()
  const todayStr = localDateStr(today)

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowStr = localDateStr(tomorrow)

  // This weekend = next Fri/Sat/Sun
  const day = today.getDay()
  const daysToFri = (5 - day + 7) % 7 || 7
  const fri = new Date(today); fri.setDate(today.getDate() + daysToFri)
  const sat = new Date(fri); sat.setDate(fri.getDate() + 1)
  const sun = new Date(fri); sun.setDate(fri.getDate() + 2)
  const weekendDates = [fri, sat, sun].map(d => localDateStr(d))

  return { todayStr, tomorrowStr, weekendDates }
}


// Convert DB day_of_week string to JS getDay() integer (0=Sun..6=Sat)
function dowToInt(dow) {
  const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 }
  if (typeof dow === 'number') return dow
  return map[(dow || '').toLowerCase()] ?? -1
}

function EventCard({ event, navigate }) {
  const img = event.image_url || event.hero_image_url || FALLBACK_EVENT_IMG
  const typeKey = getEventType(event)
  const typeMeta = EVENT_TYPE_MAP[typeKey] || { label: 'Event', emoji: '📅' }
  const eventType = typeMeta.label
  const typeEmoji = typeMeta.emoji
  const dateLabel = fmtDate(event.event_date)
  const timeLabel = fmt12(event.start_time)
  const endLabel = event.end_time ? fmt12(event.end_time) : ''

  return (
    <div className="ev-card">
      {/* Artist / Event Image */}
      <div className="ev-card-img" style={{ backgroundImage: `url(${img})` }}>
        <div className="ev-type-badge">{typeEmoji} {eventType}</div>
        {(dateLabel || timeLabel) && (
          <div className="ev-datetime-badge">
            {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}{endLabel ? ` – ${endLabel}` : ''}
          </div>
        )}
      </div>

      {/* Event Info */}
      <div className="ev-card-body">
        <div className="ev-name">{event.event_name || 'Event'}</div>
        {event.artist_name && (
          <div className="ev-artist">🎤 {event.artist_name}</div>
        )}
        {event.artist?.genre && (
          <div className="ev-genre">🎵 {event.artist.genre}</div>
        )}
        {event.artist?.hometown && (
          <div className="ev-hometown">🏠 {event.artist.hometown}</div>
        )}
        {(event.description || event.artist?.bio) && (
          <div className="ev-desc">{event.description || event.artist.bio}</div>
        )}
        {event.cover_charge != null && (
          <div className="ev-cover">
            💵 {event.cover_charge === 0 || event.cover_charge === '0' ? 'Free admission' : `$${event.cover_charge} cover`}
          </div>
        )}
        {event.artist && (event.artist.social_instagram || event.artist.social_facebook || event.artist.social_tiktok || event.artist.spotify_url || event.artist.website_url) && (
          <div className="ev-socials">
            {event.artist.social_instagram && <a href={event.artist.social_instagram} target="_blank" rel="noopener noreferrer" className="ev-social-link">IG</a>}
            {event.artist.social_facebook && <a href={event.artist.social_facebook} target="_blank" rel="noopener noreferrer" className="ev-social-link">FB</a>}
            {event.artist.social_tiktok && <a href={event.artist.social_tiktok} target="_blank" rel="noopener noreferrer" className="ev-social-link">TT</a>}
            {event.artist.spotify_url && <a href={event.artist.spotify_url} target="_blank" rel="noopener noreferrer" className="ev-social-link">Spotify</a>}
            {event.artist.website_url && <a href={event.artist.website_url} target="_blank" rel="noopener noreferrer" className="ev-social-link">Website</a>}
          </div>
        )}
      </div>

      {/* Venue Section */}
      <div className="ev-venue">
        <div className="ev-venue-label">AT THE VENUE</div>
        <div className="ev-venue-name"
          onClick={() => event.entity_slug && navigate(`/business/${event.entity_slug}`)}
          style={{ cursor: event.entity_slug ? 'pointer' : 'default' }}
        >
          {event.icon || '🏠'} {event.entity_name || 'Venue'}
        </div>
        {(event.address_line_1 || event.city) && (
          <div className="ev-venue-addr">
            📍 {[event.address_line_1, event.city].filter(Boolean).join(', ')}
          </div>
        )}
        <div className="ev-venue-actions">
          {event.entity_slug && (
            <button className="ev-btn primary" onClick={() => navigate(`/business/${event.entity_slug}`)}>
              View Venue
            </button>
          )}
          {event.address_line_1 && (
            <a
              className="ev-btn"
              href={`https://maps.google.com/?q=${encodeURIComponent([event.address_line_1, event.city, 'AL'].filter(Boolean).join(', '))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              📍 Directions
            </a>
          )}
          {event.phone && (
            <a className="ev-btn" href={`tel:${event.phone.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()}>
              📞 Call
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFilter, setDateFilter] = useState('today')
  const [typeFilter, setTypeFilter] = useState('All')
  const [customDate, setCustomDate] = useState('')
  const [visibleCount, setVisibleCount] = useState(24)
  // Reset the visible window whenever the filters change so a new filter
  // doesn't inherit a large expanded count from the previous view.
  useEffect(() => { setVisibleCount(24) }, [dateFilter, typeFilter, customDate])

  const { todayStr, tomorrowStr, weekendDates } = useMemo(() => getDateFilters(), [])

  const availableTypeFilters = useMemo(() => {
    const seen = new Set()
    events.forEach(ev => seen.add(getEventType(ev)))
    return ['All', ...Object.keys(EVENT_TYPE_MAP).filter(k => seen.has(k))]
  }, [events])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE}/api/gcr/events`)
        if (!res.ok) throw new Error('Failed to load events')
        const data = await res.json()
        setEvents(data.events || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return events.filter(ev => {
      // Date filter
      const d = ev.event_date || ''
      const isRecurring = ev.recurring

      let dateMatch = false
      const todayDow   = new Date().getDay()
      const tomorrowDow = new Date(tomorrowStr + 'T12:00:00').getDay()
      const weekendDows = weekendDates.map(ds => new Date(ds + 'T12:00:00').getDay())

      if (dateFilter === 'today') {
        dateMatch = d === todayStr || (isRecurring && dowToInt(ev.day_of_week) === todayDow)
      } else if (dateFilter === 'tomorrow') {
        dateMatch = d === tomorrowStr || (isRecurring && dowToInt(ev.day_of_week) === tomorrowDow)
      } else if (dateFilter === 'weekend') {
        dateMatch = weekendDates.includes(d) || (isRecurring && weekendDows.includes(dowToInt(ev.day_of_week)))
      } else if (dateFilter === 'custom' && customDate) {
        const customDow = new Date(customDate + 'T12:00:00').getDay()
        dateMatch = d === customDate || (isRecurring && dowToInt(ev.day_of_week) === customDow)
      } else if (dateFilter === 'all') {
        dateMatch = true
      }

      // Type filter
      let typeMatch = typeFilter === 'All'
      if (!typeMatch) {
        typeMatch = getEventType(ev) === typeFilter
      }

      return dateMatch && typeMatch
    })
  }, [events, dateFilter, typeFilter, customDate, todayStr, tomorrowStr, weekendDates])

  // Playing now / starting soon today first, later dates pushed to the bottom —
  // within each group, earliest start time first. Previously this list had no
  // sort at all and just rendered in API order.
  const sorted = useMemo(() => {
    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const toMins = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }

    const rank = ev => {
      const isToday = ev.event_date === todayStr || (ev.recurring && dowToInt(ev.day_of_week) === now.getDay())
      if (!isToday) return { group: 2, sortMins: toMins(ev.start_time) ?? 9999, dateStr: ev.event_date || '' }
      const startMins = toMins(ev.start_time)
      const endMins = toMins(ev.end_time)
      const isLiveNow = startMins != null && nowMins >= startMins && (endMins != null ? nowMins < endMins : nowMins < startMins + 180)
      if (isLiveNow) return { group: 0, sortMins: startMins }
      if (startMins != null && startMins >= nowMins) return { group: 1, sortMins: startMins }
      // Today but already ended (no end_time known, assumed 3hr window) — treat like a later listing, not top-ranked
      return { group: 3, sortMins: startMins ?? 9999 }
    }

    return [...filtered]
      .map(ev => ({ ev, r: rank(ev) }))
      .sort((a, b) => a.r.group - b.r.group || a.r.sortMins - b.r.sortMins || (a.r.dateStr || '').localeCompare(b.r.dateStr || ''))
      .map(x => x.ev)
  }, [filtered, todayStr])

  const dateButtons = [
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'weekend', label: 'This Weekend' },
    { key: 'all', label: 'All Events' },
    { key: 'custom', label: '📅 Pick Date' },
  ]

  return (
    <div className="events-page">

      {/* Hero */}
      <div className="ev-hero">
        <div className="ev-hero-overlay" />
        <div className="ev-hero-content">
          <h1>Events &amp; Live Music</h1>
          <p>See what's happening tonight across Orange Beach, Gulf Shores, and nearby</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="ev-filters-bar">
        <div className="ev-filter-scroll">
          {dateButtons.map(btn => (
            <button
              key={btn.key}
              className={`ev-filter-pill ${dateFilter === btn.key ? 'active' : ''}`}
              onClick={() => setDateFilter(btn.key)}
            >
              {btn.label}
            </button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="ev-date-picker">
            <input
              type="date"
              value={customDate}
              min={todayStr}
              onChange={e => setCustomDate(e.target.value)}
            />
          </div>
        )}

        {/* Type Filter — dynamic from loaded events */}
        <div className="ev-filter-scroll" style={{ marginTop: 8 }}>
          {availableTypeFilters.map(t => {
            const meta = t === 'All' ? { label: 'All', emoji: '' } : (EVENT_TYPE_MAP[t] || { label: t, emoji: '📅' })
            return (
              <button
                key={t}
                className={`ev-filter-chip ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Results */}
      <div className="ev-content">
        <div className="ev-results-header">
          {dateFilter === 'today' && <span>Today</span>}
          {dateFilter === 'tomorrow' && <span>Tomorrow</span>}
          {dateFilter === 'weekend' && <span>This Weekend</span>}
          {dateFilter === 'all' && <span>All Upcoming Events</span>}
          {dateFilter === 'custom' && customDate && <span>{fmtDate(customDate)}</span>}
          {!loading && <span className="ev-count">{sorted.length} event{sorted.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className="ev-loading">
            {[...Array(3)].map((_, i) => <div key={i} className="ev-skeleton" />)}
          </div>
        ) : error ? (
          <div className="ev-empty">
            <div>⚠️</div>
            <div>Couldn't load events</div>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="ev-empty">
            <div style={{ fontSize: 40 }}>🎸</div>
            <div style={{ fontWeight: 700, marginTop: 12 }}>No events found</div>
            <div style={{ fontSize: 13, color: '#8fa3b1', marginTop: 6 }}>
              {dateFilter !== 'all' ? 'Try "All Events" or a different date' : 'Check back soon — events are added regularly'}
            </div>
            {dateFilter !== 'all' && (
              <button className="ev-btn primary" style={{ marginTop: 16 }} onClick={() => setDateFilter('all')}>
                Show All Events
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="ev-grid">
              {sorted.slice(0, visibleCount).map(ev => (
                <EventCard key={ev.id} event={ev} navigate={navigate} />
              ))}
            </div>
            {sorted.length > visibleCount && (
              <div className="ev-loadmore-wrap">
                <button className="ev-loadmore" onClick={() => setVisibleCount(c => c + 24)}>
                  Show more events ({sorted.length - visibleCount} more)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
