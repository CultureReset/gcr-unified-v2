/**
 * GCR DEALS PAGE  —  /deals
 * 
 * Displays all active deals from gcr_deals table.
 * Sources: fishing charters, condos, photographers, restaurants,
 *          spas, boat rentals, tours, happy hours, locals too.
 * Also surfaces in: swipe deck, live feed, SMS blasts.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './Deals.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

// ── deal type config ──────────────────────────────────────────────────────────
const DEAL_TYPES = {
  last_minute:     { label: 'Last Minute',      emoji: '⚡', color: '#e85d3a' },
  rental_gap:      { label: 'Condo / Rental',   emoji: '🏠', color: '#0a8472' },
  session_opening: { label: 'Photo Session',    emoji: '📸', color: '#7c3aed' },
  charter_opening: { label: 'Charter Spot',     emoji: '🎣', color: '#0e5f8a' },
  happy_hour:      { label: 'Happy Hour',        emoji: '🍻', color: '#d97706' },
  daily_special:   { label: 'Daily Special',    emoji: '🌟', color: '#059669' },
  promo:           { label: 'Promo',             emoji: '🎁', color: '#db2777' },
  coupon:          { label: 'Coupon',            emoji: '✂️',  color: '#6b7280' },
}

const ENTITY_ICONS = {
  restaurant:       '🍽️',
  activity:         '🎯',
  fishing_charter:  '🎣',
  marina:           '⚓',
  condo:            '🏠',
  'vacation-rental':'🏖️',
  hotel:            '🏨',
  service:          '🛠️',
  photographer:     '📸',
  spa:              '💆',
  hair_salon:       '💇',
  nail_salon:       '💅',
  massage:          '💆',
  tour_agency:      '🚤',
  'Boat Rentals':   '🚤',
  'Dolphin Cruises & Tours': '🐬',
}

// Filter tabs
const FILTERS = [
  { id: 'all',       label: 'All Deals',     emoji: '🔥' },
  { id: 'today',     label: 'Today Only',    emoji: '⚡' },
  { id: 'charter',   label: 'Charters',      emoji: '🎣' },
  { id: 'condo',     label: 'Condos',        emoji: '🏠' },
  { id: 'photo',     label: 'Photo Sessions',emoji: '📸' },
  { id: 'food',      label: 'Food & Drinks', emoji: '🍽️' },
  { id: 'services',  label: 'Services',      emoji: '💆' },
  { id: 'activities',label: 'Activities',    emoji: '🎯' },
]

// Map filter id → entity_type / entity_subtype values
const FILTER_MAP = {
  today:      d => d.is_today_only,
  charter:    d => d.entity_subtype?.includes('fishing') || d.entity_subtype?.includes('charter') || d.deal_type === 'charter_opening',
  condo:      d => d.entity_type === 'condo' || d.entity_type === 'vacation-rental' || d.deal_type === 'rental_gap',
  photo:      d => d.entity_subtype === 'photographer' || d.deal_type === 'session_opening',
  food:       d => d.entity_type === 'restaurant' || d.deal_type === 'happy_hour' || d.deal_type === 'daily_special',
  services:   d => d.entity_type === 'service' && d.entity_subtype !== 'photographer',
  activities: d => d.entity_type === 'activity' && !d.entity_subtype?.includes('fishing'),
}

// ── helpers ───────────────────────────────────────────────────────────────────
function timeUntilExpiry(expiresAt) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt) - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h/24)}d left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function discountBadge(orig, deal) {
  if (!orig || !deal) return null
  const pct = Math.round((1 - deal / orig) * 100)
  return pct > 0 ? `${pct}% off` : null
}

function formatPrice(deal) {
  if (deal.price_label) return deal.price_label
  if (deal.deal_price) return `$${deal.deal_price}${deal.price_unit ? `/${deal.price_unit}` : ''}`
  return null
}

// ── DEAL CARD ─────────────────────────────────────────────────────────────────
function DealCard({ deal, navigate }) {
  const typeConfig = DEAL_TYPES[deal.deal_type] || DEAL_TYPES.promo
  const entityIcon = ENTITY_ICONS[deal.entity_subtype] || ENTITY_ICONS[deal.entity_type] || '📍'
  const timeLeft   = timeUntilExpiry(deal.expires_at)
  const discPct    = deal.discount_pct || discountBadge(deal.original_price, deal.deal_price)
  const priceStr   = formatPrice(deal)
  const isUrgent   = deal.is_today_only || (deal.spots_remaining !== null && deal.spots_remaining <= 3)

  function handleClaim(e) {
    e.stopPropagation()
    if (deal.claim_url) window.open(deal.claim_url, '_blank')
    else if (deal.claim_phone) window.location.href = `tel:${deal.claim_phone.replace(/\D/g,'')}`
    else if (deal.entity_slug) navigate(`/business/${deal.entity_slug}`)
  }

  function handleCardClick() {
    if (deal.entity_slug) navigate(`/business/${deal.entity_slug}`)
  }

  return (
    <article
      className={`deal-card ${isUrgent ? 'deal-card--urgent' : ''} ${deal.is_featured ? 'deal-card--featured' : ''}`}
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="deal-img">
        {deal.image_url
          ? <img src={deal.image_url} alt={deal.entity_name} />
          : <div className="deal-img-placeholder">{entityIcon}</div>
        }
        {/* Badges overlay */}
        <div className="deal-img-badges">
          {deal.is_featured && <span className="deal-badge deal-badge--featured">⭐ Featured</span>}
          {deal.is_today_only && <span className="deal-badge deal-badge--today">Today Only</span>}
          {discPct && <span className="deal-badge deal-badge--discount">{discPct}</span>}
        </div>
        {/* Deal type pill */}
        <div className="deal-type-pill" style={{ background: typeConfig.color }}>
          {typeConfig.emoji} {typeConfig.label}
        </div>
      </div>

      {/* Body */}
      <div className="deal-body">
        {/* Business */}
        <div className="deal-business">
          <span className="deal-biz-icon">{entityIcon}</span>
          <span className="deal-biz-name">{deal.entity_name}</span>
        </div>

        {/* Headline */}
        <h3 className="deal-headline">{deal.headline}</h3>

        {/* Description */}
        {deal.description && (
          <p className="deal-desc">{deal.description}</p>
        )}

        {/* Spots remaining */}
        {deal.spots_remaining !== null && (
          <div className={`deal-spots ${deal.spots_remaining <= 2 ? 'deal-spots--critical' : deal.spots_remaining <= 5 ? 'deal-spots--low' : ''}`}>
            {deal.spots_remaining <= 0
              ? '🔴 Fully booked'
              : deal.spots_remaining === 1
              ? '🔴 Last spot!'
              : deal.spots_remaining <= 3
              ? `🟡 Only ${deal.spots_remaining} left`
              : `🟢 ${deal.spots_remaining} spots available`
            }
            {deal.spots_total && (
              <div className="deal-spots-bar">
                <div
                  className="deal-spots-fill"
                  style={{ width: `${Math.min(100, ((deal.spots_total - deal.spots_remaining) / deal.spots_total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="deal-footer">
          <div className="deal-pricing">
            {priceStr && <span className="deal-price">{priceStr}</span>}
            {deal.original_price && deal.deal_price && (
              <span className="deal-was">${deal.original_price}/{deal.price_unit || 'night'}</span>
            )}
          </div>
          <div className="deal-meta-right">
            {timeLeft && <span className="deal-timer">{timeLeft}</span>}
          </div>
        </div>

        {/* CTA */}
        <button className="deal-cta" onClick={handleClaim}>
          {deal.claim_type === 'phone' ? '📞 Call to Claim' :
           deal.claim_type === 'link'  ? '🔗 View Deal' :
           deal.claim_type === 'sms'   ? '💬 Text to Claim' :
           '👉 Get This Deal'}
        </button>
      </div>
    </article>
  )
}

// ── POST A DEAL MODAL ─────────────────────────────────────────────────────────
function PostDealModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1) // 1=type, 2=details, 3=contact, 4=done
  const [form, setForm] = useState({
    deal_type: '',
    entity_name: '',
    entity_type: '',
    entity_subtype: '',
    headline: '',
    description: '',
    original_price: '',
    deal_price: '',
    price_unit: 'person',
    spots_remaining: '',
    valid_date: '',
    expires_hours: '24',
    claim_type: 'phone',
    claim_phone: '',
    claim_url: '',
    poster_name: '',
    poster_phone: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const DEAL_TYPE_OPTIONS = [
    { id: 'last_minute',     label: '⚡ Last Minute Opening', desc: 'Slot/spot just opened up today or tonight' },
    { id: 'rental_gap',      label: '🏠 Condo / Rental Gap',  desc: 'Dates just opened on your rental' },
    { id: 'session_opening', label: '📸 Photo Session Open',  desc: 'Cancellation or new slot for photos' },
    { id: 'charter_opening', label: '🎣 Charter Spot Open',   desc: 'Empty seats on a charter trip' },
    { id: 'happy_hour',      label: '🍻 Happy Hour Special',  desc: 'Drink/food deal for a time window' },
    { id: 'daily_special',   label: '🌟 Daily Special',       desc: 'Today only food or service deal' },
    { id: 'promo',           label: '🎁 General Promo',       desc: 'Any other deal or discount' },
  ]

  const ENTITY_TYPE_OPTIONS = [
    { id: 'activity',         subtype: 'fishing_charter', label: '🎣 Fishing Charter' },
    { id: 'activity',         subtype: 'tour_agency',     label: '🚤 Boat Rental / Tour' },
    { id: 'activity',         subtype: 'Dolphin Cruises & Tours', label: '🐬 Dolphin Cruise' },
    { id: 'condo',            subtype: 'condo',           label: '🏠 Condo / Vacation Rental' },
    { id: 'service',          subtype: 'photographer',    label: '📸 Photographer' },
    { id: 'service',          subtype: 'spa',             label: '💆 Spa / Massage' },
    { id: 'service',          subtype: 'hair_salon',      label: '💇 Hair / Nail Salon' },
    { id: 'restaurant',       subtype: 'restaurant',      label: '🍽️ Restaurant' },
    { id: 'restaurant',       subtype: 'bar',             label: '🍻 Bar / Nightlife' },
    { id: 'activity',         subtype: 'golf_course',     label: '⛳ Golf' },
    { id: 'service',          subtype: 'service',         label: '🛠️ Other Service' },
  ]

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit() {
    if (!form.poster_phone || form.poster_phone.length < 10) {
      setError('Please enter a valid phone number so we can verify you.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/deals/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          original_price: form.original_price ? parseFloat(form.original_price) : null,
          deal_price: form.deal_price ? parseFloat(form.deal_price) : null,
          spots_remaining: form.spots_remaining ? parseInt(form.spots_remaining) : null,
          expires_at: new Date(Date.now() + parseInt(form.expires_hours) * 3600000).toISOString(),
          posted_by: 'individual',
          source: 'self_serve',
        }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setStep(4)
      onSuccess?.()
    } catch (e) {
      setError('Something went wrong. Try again or call us.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {step === 1 && (
          <>
            <h2 className="modal-title">📣 Post a Deal</h2>
            <p className="modal-sub">Anyone can post — locals, businesses, property owners, photographers, charter captains. Free. Takes 2 minutes.</p>
            <div className="modal-deal-types">
              {DEAL_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`modal-type-btn ${form.deal_type === opt.id ? 'selected' : ''}`}
                  onClick={() => { set('deal_type', opt.id); setStep(2) }}
                >
                  <span className="modal-type-label">{opt.label}</span>
                  <span className="modal-type-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <button className="modal-back" onClick={() => setStep(1)}>← Back</button>
            <h2 className="modal-title">Deal Details</h2>

            <label className="modal-label">What type of business / service?</label>
            <div className="modal-type-grid">
              {ENTITY_TYPE_OPTIONS.map((opt, i) => (
                <button
                  key={i}
                  className={`modal-etype-btn ${form.entity_type === opt.id && form.entity_subtype === opt.subtype ? 'selected' : ''}`}
                  onClick={() => { set('entity_type', opt.id); set('entity_subtype', opt.subtype) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="modal-label">Business / Your name *</label>
            <input
              className="modal-input"
              placeholder="e.g. Zeke's Landing, Michelle Hatcher Photography, Unit 1204"
              value={form.entity_name}
              onChange={e => set('entity_name', e.target.value)}
            />

            <label className="modal-label">Deal headline * (keep it punchy)</label>
            <input
              className="modal-input"
              placeholder="e.g. 2 spots open on tonights sunset cruise — be punchy!"
              value={form.headline}
              onChange={e => set('headline', e.target.value)}
            />

            <label className="modal-label">More detail (optional)</label>
            <textarea
              className="modal-input"
              rows={3}
              placeholder="Trip length, what's included, location, any restrictions..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />

            <div className="modal-row">
              <div>
                <label className="modal-label">Original price</label>
                <input className="modal-input" type="number" placeholder="350" value={form.original_price} onChange={e => set('original_price', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Deal price</label>
                <input className="modal-input" type="number" placeholder="275" value={form.deal_price} onChange={e => set('deal_price', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Per</label>
                <select className="modal-input" value={form.price_unit} onChange={e => set('price_unit', e.target.value)}>
                  <option value="person">person</option>
                  <option value="night">night</option>
                  <option value="session">session</option>
                  <option value="trip">trip</option>
                  <option value="hour">hour</option>
                </select>
              </div>
            </div>

            <div className="modal-row">
              <div>
                <label className="modal-label">Spots available</label>
                <input className="modal-input" type="number" placeholder="2" value={form.spots_remaining} onChange={e => set('spots_remaining', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Deal expires in</label>
                <select className="modal-input" value={form.expires_hours} onChange={e => set('expires_hours', e.target.value)}>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours (tomorrow)</option>
                  <option value="48">48 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">1 week</option>
                </select>
              </div>
            </div>

            <button
              className="modal-next"
              disabled={!form.entity_name || !form.headline}
              onClick={() => setStep(3)}
            >
              Next: Contact Info →
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <button className="modal-back" onClick={() => setStep(2)}>← Back</button>
            <h2 className="modal-title">How do people claim this?</h2>

            <label className="modal-label">How should people reach you?</label>
            <div className="modal-claim-row">
              {[
                { id: 'phone', label: '📞 Call / Text' },
                { id: 'link',  label: '🔗 Booking Link' },
                { id: 'walk_in', label: '🚶 Walk In' },
              ].map(opt => (
                <button
                  key={opt.id}
                  className={`modal-claim-btn ${form.claim_type === opt.id ? 'selected' : ''}`}
                  onClick={() => set('claim_type', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {form.claim_type === 'phone' && (
              <>
                <label className="modal-label">Phone number to call/text</label>
                <input className="modal-input" type="tel" placeholder="251-555-0123" value={form.claim_phone} onChange={e => set('claim_phone', e.target.value)} />
              </>
            )}
            {form.claim_type === 'link' && (
              <>
                <label className="modal-label">Booking / website URL</label>
                <input className="modal-input" type="url" placeholder="https://..." value={form.claim_url} onChange={e => set('claim_url', e.target.value)} />
              </>
            )}

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1.2rem', paddingTop: '1.2rem' }}>
              <label className="modal-label">Your name (for our records)</label>
              <input className="modal-input" placeholder="Your name" value={form.poster_name} onChange={e => set('poster_name', e.target.value)} />

              <label className="modal-label">Your phone number * (for verification — won't be public)</label>
              <input className="modal-input" type="tel" placeholder="251-555-0000" value={form.poster_phone} onChange={e => set('poster_phone', e.target.value)} />
              <p className="modal-hint">We may text you to verify before posting. Deals go live within minutes of verification.</p>
            </div>

            {error && <p className="modal-error">{error}</p>}

            <button
              className="modal-submit"
              disabled={submitting || !form.poster_phone}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting...' : '📣 Post My Deal →'}
            </button>
          </>
        )}

        {step === 4 && (
          <div className="modal-success">
            <div className="modal-success-icon">🎉</div>
            <h2>Deal Submitted!</h2>
            <p>We'll verify and post it within minutes. If you listed a phone number, we may send a quick confirmation text.</p>
            <p>Your deal will also be promoted in our Live Feed and may be sent to our SMS subscriber list.</p>
            <button className="modal-next" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Deals() {
  const navigate = useNavigate()
  const [deals, setDeals]         = useState([])
  const [filtered, setFiltered]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeFilter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  // Load deals
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/deals?active=true`)
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.deals || []
        // Sort: featured first, then today-only, then by created_at desc
        list.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1
          if (!a.is_featured && b.is_featured) return 1
          if (a.is_today_only && !b.is_today_only) return -1
          if (!a.is_today_only && b.is_today_only) return 1
          return new Date(b.created_at) - new Date(a.created_at)
        })
        setDeals(list)
      } catch (e) {
        console.error('Failed to load deals:', e)
        setDeals([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [lastRefresh])

  // Apply filter
  useEffect(() => {
    if (activeFilter === 'all') {
      setFiltered(deals)
    } else {
      const fn = FILTER_MAP[activeFilter]
      setFiltered(fn ? deals.filter(fn) : deals)
    }
  }, [deals, activeFilter])

  // Count per filter for badges
  const counts = {}
  FILTERS.forEach(f => {
    if (f.id === 'all') counts.all = deals.length
    else counts[f.id] = deals.filter(FILTER_MAP[f.id] || (() => false)).length
  })

  const todayDeals    = deals.filter(d => d.is_today_only)
  const tomorrowDeals = deals.filter(d => {
    if (d.is_today_only) return false
    if (!d.valid_date) return false
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10)
    return d.valid_date === tomorrow
  })
  const featuredDeals  = deals.filter(d => d.is_featured)
  const walkOnDeals    = deals.filter(d =>
    (d.deal_type === 'charter_opening' || d.entity_subtype?.includes('fishing') || d.entity_subtype?.includes('charter')) &&
    (d.is_today_only || tomorrowDeals.includes(d))
  )

  return (
    <div className="deals-page">

      {/* HERO */}
      <div className="deals-hero">
        <div className="deals-hero-inner">
          <div className="deals-hero-left">
            <span className="deals-kicker">🔥 Updated in real-time</span>
            <h1 className="deals-title">Gulf Coast Deals</h1>
            <p className="deals-sub">
              Last-minute openings, cancelled bookings, photo session slots, 
              charter spots, condo gaps — from businesses and locals on the coast.
            </p>
            <div className="deals-hero-actions">
              <button className="deals-post-btn" onClick={() => setShowModal(true)}>
                📣 Post a Deal — It's Free
              </button>
              <span className="deals-count">{deals.length} active deals</span>
            </div>
          </div>
          <div className="deals-hero-stats">
            <div className="deals-stat">
              <span className="deals-stat-num">{deals.length}</span>
              <span className="deals-stat-lbl">Active Deals</span>
            </div>
            <div className="deals-stat">
              <span className="deals-stat-num">{todayDeals.length}</span>
              <span className="deals-stat-lbl">Today Only</span>
            </div>
            <div className="deals-stat">
              <span className="deals-stat-num">{deals.filter(d => d.entity_type === 'condo' || d.entity_type === 'vacation-rental').length}</span>
              <span className="deals-stat-lbl">Rentals</span>
            </div>
            <div className="deals-stat">
              <span className="deals-stat-num">{deals.filter(d => d.entity_subtype?.includes('fishing') || d.deal_type === 'charter_opening').length}</span>
              <span className="deals-stat-lbl">Charters</span>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS STRIP */}
      <div className="deals-how-strip">
        <div className="deals-how-item"><span>⚡</span><span>Auto-surfaced from booking platforms when slots open</span></div>
        <div className="deals-how-divider">·</div>
        <div className="deals-how-item"><span>📣</span><span>Any local or business can post a deal in 2 minutes</span></div>
        <div className="deals-how-divider">·</div>
        <div className="deals-how-item"><span>📱</span><span>Best deals blast to our SMS loyalty list automatically</span></div>
      </div>

      {/* FILTERS */}
      <div className="deals-filters-wrap">
        <div className="deals-filters">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`deals-filter ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.emoji} {f.label}
              {counts[f.id] > 0 && <span className="deals-filter-count">{counts[f.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="deals-content">

        {loading ? (
          <div className="deals-loading">
            <div className="deals-spinner" />
            <p>Loading deals...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="deals-empty">
            <div className="deals-empty-icon">🌊</div>
            <h3>No deals right now</h3>
            <p>Be the first to post one — it's free and takes 2 minutes.</p>
            <button className="deals-post-btn" onClick={() => setShowModal(true)}>
              📣 Post a Deal
            </button>
          </div>
        ) : (
          <>
            {/* Walk-On Charter Spots — most urgent, always first */}
            {activeFilter === 'all' && walkOnDeals.length > 0 && (
              <section className="deals-section deals-section--walkon">
                <div className="deals-walkon-head">
                  <h2 className="deals-section-title">🎣 Walk-On Charter Spots</h2>
                  <span className="deals-walkon-sub">Captains need a few more — fill the boat, split the cost</span>
                </div>
                <div className="deals-grid">
                  {walkOnDeals.map(deal => (
                    <DealCard key={deal.id} deal={deal} navigate={navigate} />
                  ))}
                </div>
              </section>
            )}

            {/* Featured section */}
            {activeFilter === 'all' && featuredDeals.length > 0 && (
              <section className="deals-section">
                <h2 className="deals-section-title">⭐ Featured Deals</h2>
                <div className="deals-grid deals-grid--featured">
                  {featuredDeals.map(deal => (
                    <DealCard key={deal.id} deal={deal} navigate={navigate} />
                  ))}
                </div>
              </section>
            )}

            {/* Today Only flash section */}
            {activeFilter === 'all' && todayDeals.length > 0 && (
              <section className="deals-section">
                <h2 className="deals-section-title">⚡ Today Only — Act Fast</h2>
                <div className="deals-grid">
                  {todayDeals.filter(d => !walkOnDeals.includes(d)).map(deal => (
                    <DealCard key={deal.id} deal={deal} navigate={navigate} />
                  ))}
                </div>
              </section>
            )}

            {/* Tomorrow — book tonight */}
            {activeFilter === 'all' && tomorrowDeals.length > 0 && (
              <section className="deals-section">
                <h2 className="deals-section-title">🌅 Tomorrow — Book Tonight</h2>
                <div className="deals-grid">
                  {tomorrowDeals.filter(d => !walkOnDeals.includes(d)).map(deal => (
                    <DealCard key={deal.id} deal={deal} navigate={navigate} />
                  ))}
                </div>
              </section>
            )}

            {/* All / filtered deals */}
            <section className="deals-section">
              {activeFilter === 'all' && (
                <h2 className="deals-section-title">🔥 All Active Deals</h2>
              )}
              <div className="deals-grid">
                {(activeFilter === 'all'
                  ? filtered.filter(d => !d.is_featured && !d.is_today_only && !tomorrowDeals.includes(d))
                  : filtered
                ).map(deal => (
                  <DealCard key={deal.id} deal={deal} navigate={navigate} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Post CTA bottom */}
        <div className="deals-post-cta">
          <div className="deals-post-cta-inner">
            <div>
              <h3>Got a last-minute opening?</h3>
              <p>Charter captain, condo owner, photographer, spa — anyone can post. Free. Goes live in minutes. We'll blast it to our SMS list.</p>
            </div>
            <button className="deals-post-btn deals-post-btn--large" onClick={() => setShowModal(true)}>
              📣 Post Your Deal Free
            </button>
          </div>
        </div>
      </div>

      {/* POST DEAL MODAL */}
      {showModal && (
        <PostDealModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setLastRefresh(Date.now())}
        />
      )}
    </div>
  )
}
