import { useEffect, useMemo, useState } from 'react'
import './AvailabilityCalendar.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }
const parseISO = (s) => new Date(s + 'T12:00:00Z')

// Build the day cells for a given month (leading blanks + each day)
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const startDow = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, month, d)))
  return cells
}

/**
 * Availability calendar backed by the per-unit Layer-2 endpoints.
 *   mode="select" → range picker (check-in → check-out) with a live quote
 *   mode="view"   → read-only, just paints blocked nights (owner dashboard)
 */
export default function AvailabilityCalendar({ resourceId, minNights = 1, mode = 'select', onSelect }) {
  const [blocked, setBlocked] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [monthOffset, setMonthOffset] = useState(0)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)

  const today = useMemo(() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) }, [])

  useEffect(() => {
    if (!resourceId) return
    let cancelled = false
    setLoading(true); setError(null)
    const from = iso(today)
    const to = iso(addDays(today, 365))
    fetch(`${API_BASE}/api/availability/resource/${resourceId}?from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('load failed')))
      .then(data => { if (!cancelled) setBlocked(new Set(data.blocked_dates || [])) })
      .catch(() => { if (!cancelled) setError('Could not load availability') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [resourceId, today])

  // Any blocked night strictly between two dates makes the range invalid
  const rangeHasBlocked = (startISO, endISO) => {
    let cur = parseISO(startISO)
    const end = parseISO(endISO)
    while (cur < end) { if (blocked.has(iso(cur))) return true; cur = addDays(cur, 1) }
    return false
  }

  const fetchQuote = (ci, co) => {
    if (!resourceId) return
    setQuoting(true); setQuote(null)
    fetch(`${API_BASE}/api/availability/resource/${resourceId}/quote?checkin=${ci}&checkout=${co}`)
      .then(r => r.json())
      .then(q => { setQuote(q); onSelect && onSelect({ checkIn: ci, checkOut: co, quote: q }) })
      .catch(() => setQuote(null))
      .finally(() => setQuoting(false))
  }

  const pick = (day) => {
    if (mode !== 'select' || !day) return
    const dISO = iso(day)
    if (day < today || blocked.has(dISO)) return

    // starting fresh, or completing a range
    if (!checkIn || (checkIn && checkOut) || dISO <= checkIn) {
      setCheckIn(dISO); setCheckOut(''); setQuote(null)
      onSelect && onSelect({ checkIn: dISO, checkOut: '', quote: null })
      return
    }
    // second click after a check-in — validate the span is clear
    if (rangeHasBlocked(checkIn, dISO)) {
      setCheckIn(dISO); setCheckOut(''); setQuote(null)
      onSelect && onSelect({ checkIn: dISO, checkOut: '', quote: null })
      return
    }
    setCheckOut(dISO)
    fetchQuote(checkIn, dISO)
  }

  const inRange = (day) => {
    if (!day || !checkIn) return false
    const dISO = iso(day)
    if (dISO === checkIn) return 'start'
    if (checkOut && dISO === checkOut) return 'end'
    if (checkOut && dISO > checkIn && dISO < checkOut) return 'mid'
    return false
  }

  const clear = () => { setCheckIn(''); setCheckOut(''); setQuote(null); onSelect && onSelect({ checkIn: '', checkOut: '', quote: null }) }

  const baseYear = today.getUTCFullYear()
  const baseMonth = today.getUTCMonth()
  const visibleMonths = [0, 1].map(i => {
    const m = baseMonth + monthOffset + i
    return { year: baseYear + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
  })

  const nights = (checkIn && checkOut) ? Math.round((parseISO(checkOut) - parseISO(checkIn)) / 86400000) : 0

  if (loading) return <div className="avcal-loading">Loading availability…</div>
  if (error) return <div className="avcal-error">{error}</div>

  return (
    <div className="avcal">
      <div className="avcal-head">
        <button className="avcal-nav" onClick={() => setMonthOffset(o => Math.max(0, o - 1))} disabled={monthOffset === 0} aria-label="Previous months">‹</button>
        <div className="avcal-head-spacer" />
        <button className="avcal-nav" onClick={() => setMonthOffset(o => Math.min(11, o + 1))} disabled={monthOffset >= 11} aria-label="Next months">›</button>
      </div>

      <div className="avcal-months">
        {visibleMonths.map(({ year, month }) => (
          <div className="avcal-month" key={`${year}-${month}`}>
            <div className="avcal-month-title">{MONTHS[month]} {year}</div>
            <div className="avcal-weekdays">
              {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
            </div>
            <div className="avcal-grid">
              {monthGrid(year, month).map((day, i) => {
                if (!day) return <span key={i} className="avcal-cell empty" />
                const dISO = iso(day)
                const isPast = day < today
                const isBlocked = blocked.has(dISO)
                const range = inRange(day)
                const cls = [
                  'avcal-cell',
                  isPast ? 'past' : '',
                  isBlocked ? 'blocked' : '',
                  range ? `sel-${range}` : '',
                  (!isPast && !isBlocked && mode === 'select') ? 'open' : '',
                ].filter(Boolean).join(' ')
                return (
                  <button key={i} className={cls} disabled={isPast || isBlocked || mode !== 'select'} onClick={() => pick(day)}>
                    {day.getUTCDate()}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="avcal-legend">
        <span><i className="dot open" /> Open</span>
        <span><i className="dot blocked" /> Booked</span>
        {mode === 'select' && <span><i className="dot sel" /> Your stay</span>}
      </div>

      {mode === 'select' && (
        <div className="avcal-summary">
          {!checkIn && <p className="avcal-hint">Tap a check-in date, then a check-out date.</p>}
          {checkIn && !checkOut && <p className="avcal-hint">Check-in <b>{checkIn}</b> — now pick your check-out.</p>}
          {checkIn && checkOut && (
            <div className="avcal-quote">
              <div className="avcal-quote-dates">
                <span>{checkIn} → {checkOut}</span>
                <button className="avcal-clear" onClick={clear}>Clear</button>
              </div>
              {quoting && <p className="avcal-hint">Getting your price…</p>}
              {quote && quote.bookable && (
                <div className="avcal-quote-lines">
                  <div><span>${quote.breakdown.nightly} × {nights} night{nights !== 1 ? 's' : ''}</span><span>${quote.breakdown.lodging.toLocaleString()}</span></div>
                  {quote.breakdown.cleaning_fee > 0 && <div><span>Cleaning fee</span><span>${quote.breakdown.cleaning_fee.toLocaleString()}</span></div>}
                  {quote.breakdown.service_fee > 0 && <div><span>Service fee</span><span>${quote.breakdown.service_fee.toLocaleString()}</span></div>}
                  <div className="avcal-quote-total"><span>Total</span><span>${quote.breakdown.total.toLocaleString()}</span></div>
                </div>
              )}
              {quote && !quote.bookable && (
                <p className="avcal-unavail">
                  {quote.reasons?.includes(`min_nights_${minNights}`) || nights < minNights
                    ? `This home has a ${minNights}-night minimum.`
                    : 'Those dates aren’t available — try another range.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
