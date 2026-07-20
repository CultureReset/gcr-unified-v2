import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'
import SectionRenderer from '../components/SectionRenderer'
import './LinksPage.css'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  const ampm = hr >= 12 ? 'PM' : 'AM'
  const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr
  return `${h12}:${m} ${ampm}`
}

function isOpenNow(hours) {
  if (!hours?.length) return null
  const now = new Date()
  const today = hours.find(h => h.day_of_week === now.getDay())
  if (!today || today.is_closed) return false
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = (today.opens_at || '00:00').split(':').map(Number)
  const [ch, cm] = (today.closes_at || '23:59').split(':').map(Number)
  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm
}

// Every link opens the same modal shell — this is what makes it fast to build
// per business without hand-coding a new modal for each one, and it's what
// the real Circle Boats / Kraken Reels pages do too.
function Modal({ title, onClose, children }) {
  return (
    <div className="lp-modal active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lp-sheet">
        <button className="lp-x" onClick={onClose}>✕</button>
        <div className="lp-mhead">{title}</div>
        <div className="lp-mbody">{children}</div>
      </div>
    </div>
  )
}

export default function LinksPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openModal, setOpenModal] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/api/gcr/entity/${encodeURIComponent(slug)}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(data => { if (!cancelled) { setBusiness(data); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [slug])

  if (loading) return <div className="lp-loading">Loading…</div>
  if (error || !business) return <div className="lp-loading">Business not found</div>

  const cityState = [business.city, business.state].filter(Boolean).join(', ')
  const avatarUrl = business.hero_image_url || business.photos?.[0]?.image_url || business.photos?.[0]?.url
  const offerSections = (business.sections || []).filter(s => (s.items || []).length > 0)
  const pricing = business.pricing || []
  const hasOffers = offerSections.length > 0 || pricing.length > 0
  const photos = business.photos || []
  const reviews = business.reviews || []
  const openNow = isOpenNow(business.hours)
  const socials = [
    business.social_instagram && { label: 'Instagram', url: business.social_instagram },
    business.social_facebook && { label: 'Facebook', url: business.social_facebook },
    business.social_tiktok && { label: 'TikTok', url: business.social_tiktok },
  ].filter(Boolean)

  // Module gating: a business can turn a module OFF even if it has data for
  // it (e.g. hide Reviews while still collecting them). Default to shown
  // when there's no entity_modules row for that key at all — most of the
  // ~2,900 entities don't have every module configured yet, and "no record"
  // should never mean "hidden." Only an explicit enabled:false hides it.
  // NOTE: key names below (gallery/reviews/booking) match the App Store
  // module list but aren't yet confirmed 1:1 against live entity_modules
  // rows — cheap to correct once you can check real key strings.
  const moduleMap = new Map((business.modules || []).map(m => [m.module_key, m.enabled !== false]))
  const moduleOn = key => moduleMap.get(key) !== false

  const links = [
    { id: 'about', icon: 'ℹ️', title: 'About Us', desc: 'Our story & what we offer' },
    hasOffers && moduleOn('offerings') && { id: 'offers', icon: '💲', title: 'Pricing & Packages', desc: 'See what\u2019s available and what it costs' },
    (business.booking_url || business.reservation_url) && moduleOn('booking') && { id: 'book', icon: '📅', title: 'Book Now', desc: 'Check availability & reserve', external: business.booking_url || business.reservation_url },
    photos.length > 0 && moduleOn('gallery') && { id: 'photos', icon: '📸', title: 'Photo Gallery', desc: 'See it for yourself' },
    reviews.length > 0 && moduleOn('reviews') && { id: 'reviews', icon: '⭐', title: 'Reviews', desc: 'What customers say' },
    { id: 'hours', icon: '🕐', title: 'Hours & Location', desc: 'Address, hours & directions' },
    business.website_url && { id: 'website', icon: '🌐', title: 'Visit Website', desc: business.website_url.replace(/^https?:\/\//, ''), external: business.website_url },
  ].filter(Boolean)

  return (
    <div className="lp-page">
      <button className="lp-back" onClick={() => navigate(-1)}>← Back</button>
      <main className="lp-shell">
        <section className="lp-hero" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>
          {avatarUrl && <img className="lp-avatar" src={avatarUrl} alt={business.name} />}
          {!avatarUrl && <div className="lp-avatar lp-avatar-fallback">{(business.name || '?')[0]}</div>}
          <h1>{business.name}</h1>
          {business.subtitle && <p className="lp-sub">{business.subtitle}</p>}
          {business.address_line_1 && <p className="lp-addr">📍 {business.address_line_1}{cityState ? `, ${cityState}` : ''}</p>}
          <div className="lp-meta">
            {business.rating && <span className="lp-chip">⭐ {business.rating.toFixed(1)} Rating</span>}
            {openNow !== null && <span className="lp-chip">{openNow ? '🟢 Open Now' : '🔴 Closed'}</span>}
          </div>
          {business.phone && <a className="lp-call" href={`tel:${business.phone}`}>📞 Call Now</a>}
          {socials.length > 0 && (
            <div className="lp-socials">
              {socials.map(s => <a key={s.label} href={s.url} target="_blank" rel="noreferrer" title={s.label}>#</a>)}
            </div>
          )}
        </section>

        <section className="lp-links">
          {links.map(l => (
            <div
              key={l.id}
              className="lp-link"
              onClick={() => l.external ? window.open(l.external, '_blank') : setOpenModal(l.id)}
            >
              <div className="lp-link-icon">{l.icon}</div>
              <div className="lp-link-grow">
                <div className="lp-link-title">{l.title}</div>
                <div className="lp-link-desc">{l.desc}</div>
              </div>
              <div className="lp-link-arrow">›</div>
            </div>
          ))}
        </section>

        <div className="lp-footer">Powered by CyberCheck</div>
      </main>

      {openModal === 'about' && (
        <Modal title={`ℹ️ About ${business.name}`} onClose={() => setOpenModal(null)}>
          <p>{business.description || business.editorial_summary || business.ai_overview || 'No description available yet.'}</p>
          {business.highlights?.length > 0 && (
            <ul className="lp-clean-list">
              {business.highlights.map((h, i) => <li key={i}>✓ {h}</li>)}
            </ul>
          )}
        </Modal>
      )}

      {openModal === 'offers' && (
        <Modal title="💲 Pricing & Packages" onClose={() => setOpenModal(null)}>
          {offerSections.map(sec => <SectionRenderer key={sec.id} section={sec} />)}
          {pricing.map((item, i) => (
            <div key={item.id || i} className="lp-offer-row">
              <div className="lp-offer-name">{item.tier_name || item.item_name}</div>
              <div className="lp-offer-price">{(item.price_from ?? item.price) != null ? `$${item.price_from ?? item.price}` : 'Call'}</div>
            </div>
          ))}
        </Modal>
      )}

      {openModal === 'photos' && (
        <Modal title="📸 Photo Gallery" onClose={() => setOpenModal(null)}>
          <div className="lp-photo-grid">
            {photos.map((p, i) => <img key={i} src={p.image_url || p.url} alt={p.caption || ''} />)}
          </div>
        </Modal>
      )}

      {openModal === 'reviews' && (
        <Modal title="⭐ Customer Reviews" onClose={() => setOpenModal(null)}>
          {business.rating && (
            <div className="lp-review-summary">
              <div className="lp-review-score">{business.rating.toFixed(1)}</div>
              <div>{'★'.repeat(Math.round(business.rating))}<div className="lp-muted">Based on {business.review_count || reviews.length} reviews</div></div>
            </div>
          )}
          {reviews.map(r => (
            <div key={r.id} className="lp-review">
              <div className="lp-review-head"><strong>{r.reviewer_name || 'Guest'}</strong> {'★'.repeat(r.rating || 5)}</div>
              {r.title && <div className="lp-review-title">{r.title}</div>}
              <p>{r.body}</p>
            </div>
          ))}
        </Modal>
      )}

      {openModal === 'hours' && (
        <Modal title="🕐 Hours & Location" onClose={() => setOpenModal(null)}>
          {business.hours?.length > 0 && (
            <ul className="lp-hours-list">
              {business.hours.map((h, i) => (
                <li key={i}>
                  <span>{DAY_NAMES[h.day_of_week] || h.day_of_week}</span>
                  <span>{h.is_closed ? 'Closed' : `${formatTime(h.opens_at)} \u2013 ${formatTime(h.closes_at)}`}</span>
                </li>
              ))}
            </ul>
          )}
          {business.address_line_1 && (
            <p className="lp-modal-addr">📍 {business.address_line_1}{cityState ? `, ${cityState}` : ''}</p>
          )}
          {business.directions_url && <a className="lp-modal-btn" href={business.directions_url} target="_blank" rel="noreferrer">Get Directions</a>}
        </Modal>
      )}
    </div>
  )
}
