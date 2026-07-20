import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import './RentalDetail.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`
}

export default function RentalDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [rental, setRental] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [saved, setSaved] = useState(false)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [available, setAvailable] = useState(null)
  const [booking, setBooking] = useState({ name: '', email: '', phone: '', guests: 1, notes: '' })
  const [bookingStatus, setBookingStatus] = useState(null)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [galleryPage, setGalleryPage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [reviews, setReviews] = useState([])
  const [reviewStats, setReviewStats] = useState(null)
  const [reviewForm, setReviewForm] = useState({ name: '', email: '', rating: 5, title: '', body: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMsg, setReviewMsg] = useState(null)

  useEffect(() => {
    setLoading(true)
    setRental(null)
    setActiveTab('overview')
    setSaved(false)
    setCheckIn('')
    setCheckOut('')
    setAvailable(null)
    setBooking({ name: '', email: '', phone: '', guests: 1, notes: '' })
    setBookingStatus(null)
    setGalleryPage(0)
    setLightboxIdx(null)
    setLightboxOpen(false)
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/rentals/${slug}`)
        if (!res.ok) throw new Error('Not found')
        setRental(await res.json())
      } catch {
        setRental(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!rental) return
    async function loadReviews() {
      try {
        const [rv, st] = await Promise.all([
          fetch(`${API_BASE}/api/reviews/${slug}`).then(r => r.json()),
          fetch(`${API_BASE}/api/reviews/${slug}/stats`).then(r => r.json()),
        ])
        setReviews(rv.reviews || [])
        setReviewStats(st)
      } catch {
        setReviews([])
        setReviewStats(null)
      }
    }
    loadReviews()
  }, [rental, slug])

  const handleBook = async () => {
    if (!checkIn || !checkOut || !booking.name || !booking.email) return
    try {
      const res = await fetch(`${API_BASE}/api/rentals/${slug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: booking.name,
          guest_email: booking.email,
          guest_phone: booking.phone,
          num_guests: booking.guests,
          check_in_date: checkIn,
          check_out_date: checkOut,
          notes: booking.notes,
          nightly_rate: rental.nightly_price,
          cleaning_fee: rental.cleaning_fee,
          service_fee: rental.service_fee,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setBookingStatus({ ok: true, msg: `Booking confirmed! Total: $${data.total_price}` })
      } else {
        setBookingStatus({ ok: false, msg: data.error || 'Booking failed' })
      }
    } catch {
      setBookingStatus({ ok: false, msg: 'Booking failed. Please try again.' })
    }
  }

  const handleReviewSubmit = async () => {
    if (!reviewForm.name || !reviewForm.rating) return
    setReviewSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/reviews/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm),
      })
      if (res.ok) {
        setReviewMsg('Review submitted! It will appear after approval.')
        setReviewForm({ name: '', email: '', rating: 5, title: '', body: '' })
      } else {
        setReviewMsg('Failed to submit review.')
      }
    } catch {
      setReviewMsg('Failed to submit review.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  if (loading) return <div className="rental-loading">Loading...</div>
  if (!rental) return <div className="rental-error">Rental not found</div>

  const photos = rental.photo_urls || []
  const amenities = rental.amenities || []
  const faqs = rental.faqs || []
  const GALLERY_PER_PAGE = 9
  const galleryTotal = Math.ceil(photos.length / GALLERY_PER_PAGE)

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'book', label: '📅 Book' },
    ...(amenities.length ? [{ id: 'amenities', label: 'Amenities' }] : []),
    { id: 'reviews', label: `Reviews${reviewStats?.total ? ` (${reviewStats.total})` : ''}` },
    ...(rental.nightly_price ? [{ id: 'pricing', label: '💰 Pricing' }] : []),
    ...(faqs.length ? [{ id: 'faqs', label: '❓ FAQs' }] : []),
    ...(rental.house_rules ? [{ id: 'policies', label: 'Policies' }] : []),
    { id: 'location', label: '📍 Location' },
    ...(photos.length > 5 ? [{ id: 'gallery', label: `📸 Photos (${photos.length})` }] : []),
  ]

  const nights = (checkIn && checkOut)
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
    : 0

  return (
    <div className="rental-detail">

      {/* The global GCRHeader is hidden on this route (App.jsx hideHeader),
          and the only other back-navigation control on this page was a
          plain button at the very bottom, after the full gallery and every
          tab's content — effectively unreachable without scrolling through
          everything first. This sticky bar is the actual escape hatch. */}
      <div className="rental-sticky-nav">
        <button className="rental-sticky-back" onClick={() => navigate(-1)} aria-label="Back">
          ← Back
        </button>
      </div>

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <div className="rental-gallery">
          <div className="rental-gallery-grid">
            {photos.slice(0, 5).map((url, i) => (
              <div
                key={i}
                className={`rental-gallery-item ${i === 0 ? 'main' : ''}`}
                onClick={() => setLightboxIdx(i)}
              >
                <img src={url} alt={`${rental.name} ${i + 1}`} />
                {i === 4 && photos.length > 5 && (
                  <div className="gallery-more-overlay">+{photos.length - 5} more</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rental-detail-content">

        {/* Header */}
        <div className="rental-header">
          <div className="rental-header-left">
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <h1 style={{margin:0}}>{rental.name}</h1>
              <button className={`save-btn-detail ${saved ? 'saved' : ''}`} onClick={() => setSaved(s => !s)}>{saved ? '❤️' : '🤍'}</button>
            </div>
            <div className="rental-meta-row">
              {rental.bedrooms && <span>🛏️ {rental.bedrooms} bed</span>}
              {rental.bathrooms && <span>🚿 {rental.bathrooms} bath</span>}
              {rental.capacity && <span>👥 Up to {rental.capacity} guests</span>}
              {rental.min_nights && <span>📅 {rental.min_nights} night min</span>}
            </div>
            {reviewStats?.total > 0 && (
              <div className="rental-rating">
                ⭐ {reviewStats.average?.toFixed(1)} · {reviewStats.total} reviews
              </div>
            )}
          </div>
          <div className="rental-header-right">
            {rental.nightly_price && (
              <div className="rental-price">
                <span className="price-amount">${rental.nightly_price}</span>
                <span className="price-unit"> / night</span>
                {nights > 0 && (
                  <div className="price-total">${(rental.nightly_price * nights).toLocaleString()} total ({nights} nights)</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="rental-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`rental-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="rental-section">
            {rental.description && (
              <div className="rental-block">
                <h2>About This Property</h2>
                <p>{rental.description}</p>
              </div>
            )}

            {/* Check-in details */}
            {(rental.check_in_time || rental.check_out_time) && (
              <div className="rental-block">
                <h2>Check-in / Check-out</h2>
                <div className="checkin-grid">
                  {rental.check_in_time && (
                    <div className="checkin-item">
                      <span className="checkin-label">Check-in</span>
                      <span className="checkin-value">{formatTime(rental.check_in_time)}</span>
                    </div>
                  )}
                  {rental.check_out_time && (
                    <div className="checkin-item">
                      <span className="checkin-label">Check-out</span>
                      <span className="checkin-value">{formatTime(rental.check_out_time)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Access info — only shown privately (wifi/keycode visible after booking ideally) */}
            {(rental.wifi_ssid || rental.parking_info) && (
              <div className="rental-block">
                <h2>Property Info</h2>
                {rental.wifi_ssid && <p>📶 WiFi: <strong>{rental.wifi_ssid}</strong>{rental.wifi_password ? ` · Password: ${rental.wifi_password}` : ''}</p>}
                {rental.parking_info && <p>🚗 Parking: {rental.parking_info}</p>}
              </div>
            )}

            {rental.house_rules && (
              <div className="rental-block">
                <h2>House Rules</h2>
                <p>{rental.house_rules}</p>
              </div>
            )}
          </div>
        )}

        {/* Book */}
        {activeTab === 'book' && (
          <div className="rental-section">
            <h2>Book Your Stay</h2>
            <div className="booking-form">
              <AvailabilityCalendar
                resourceId={rental.id}
                minNights={rental.min_nights || 1}
                onSelect={({ checkIn: ci, checkOut: co, quote }) => {
                  setCheckIn(ci)
                  setCheckOut(co)
                  setAvailable(co ? (quote ? !!quote.bookable : null) : null)
                }}
              />

              {available && !bookingStatus && (
                <>
                  <div className="guest-row">
                    <label>Guests</label>
                    <input type="number" min={1} max={rental.capacity || 20} value={booking.guests}
                      onChange={e => setBooking(b => ({ ...b, guests: parseInt(e.target.value) }))} />
                  </div>
                  <input className="booking-input" placeholder="Your name *" value={booking.name}
                    onChange={e => setBooking(b => ({ ...b, name: e.target.value }))} />
                  <input className="booking-input" placeholder="Email *" type="email" value={booking.email}
                    onChange={e => setBooking(b => ({ ...b, email: e.target.value }))} />
                  <input className="booking-input" placeholder="Phone" type="tel" value={booking.phone}
                    onChange={e => setBooking(b => ({ ...b, phone: e.target.value }))} />
                  <textarea className="booking-input" placeholder="Special requests" value={booking.notes}
                    onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))} rows={3} />
                  <button className="book-btn" onClick={handleBook}
                    disabled={!booking.name || !booking.email}>
                    Book Now {nights > 0 && rental.nightly_price ? `· $${(rental.nightly_price * nights).toLocaleString()}` : ''}
                  </button>
                </>
              )}

              {bookingStatus && (
                <div className={`booking-status ${bookingStatus.ok ? 'success' : 'error'}`}>
                  {bookingStatus.msg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Amenities */}
        {activeTab === 'amenities' && amenities.length > 0 && (
          <div className="rental-section">
            <h2>Amenities</h2>
            <div className="amenities-grid">
              {amenities.map((a, i) => (
                <div key={i} className="amenity-item">✓ {a}</div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {activeTab === 'reviews' && (
          <div className="rental-section">
            {reviewStats?.total > 0 && (
              <div className="review-stats">
                <div className="review-avg">⭐ {reviewStats.average?.toFixed(1)}</div>
                <div className="review-count">{reviewStats.total} reviews</div>
                <div className="review-bars">
                  {[5,4,3,2,1].map(star => (
                    <div key={star} className="review-bar-row">
                      <span>{star}★</span>
                      <div className="review-bar">
                        <div className="review-bar-fill" style={{ width: `${reviewStats.total ? ((reviewStats.distribution?.[star] || 0) / reviewStats.total * 100) : 0}%` }} />
                      </div>
                      <span>{reviewStats.distribution?.[star] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="reviews-list">
              {reviews.map((r, i) => (
                <div key={r.id || i} className="review-card">
                  <div className="review-header">
                    <span className="reviewer-name">{r.reviewer_name}</span>
                    <span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    <span className="review-date">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.title && <div className="review-title">{r.title}</div>}
                  {r.body && <div className="review-body">{r.body}</div>}
                </div>
              ))}
              {reviews.length === 0 && <p className="no-reviews">No reviews yet. Be the first!</p>}
            </div>
            <div className="review-form">
              <h3>Leave a Review</h3>
              <div className="star-picker">
                {[1,2,3,4,5].map(s => (
                  <button key={s} className={`star-btn ${reviewForm.rating >= s ? 'active' : ''}`}
                    onClick={() => setReviewForm(f => ({ ...f, rating: s }))}>★</button>
                ))}
              </div>
              <input className="review-input" placeholder="Your name *" value={reviewForm.name}
                onChange={e => setReviewForm(f => ({ ...f, name: e.target.value }))} />
              <input className="review-input" placeholder="Email" type="email" value={reviewForm.email}
                onChange={e => setReviewForm(f => ({ ...f, email: e.target.value }))} />
              <input className="review-input" placeholder="Review title" value={reviewForm.title}
                onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="review-input" placeholder="Your review" value={reviewForm.body}
                onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))} rows={4} />
              {reviewMsg && <div className="review-msg">{reviewMsg}</div>}
              <button className="submit-review-btn" onClick={handleReviewSubmit}
                disabled={reviewSubmitting || !reviewForm.name}>
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        )}

        {/* Policies */}
        {activeTab === 'policies' && (
          <div className="rental-section">
            <h2>Policies</h2>
            {rental.house_rules && (
              <div className="policy-block">
                <h3>House Rules</h3>
                <p>{rental.house_rules}</p>
              </div>
            )}
            {rental.check_in_time && (
              <div className="policy-block">
                <h3>Check-in / Check-out</h3>
                <p>Check-in: {formatTime(rental.check_in_time)}</p>
                {rental.check_out_time && <p>Check-out: {formatTime(rental.check_out_time)}</p>}
              </div>
            )}
            {rental.min_nights && (
              <div className="policy-block">
                <h3>Minimum Stay</h3>
                <p>{rental.min_nights} night{rental.min_nights !== 1 ? 's' : ''} minimum</p>
              </div>
            )}
            <div className="policy-block">
              <p className="policy-note">For cancellation or refund policies, please contact the host directly.</p>
            </div>
          </div>
        )}

        {/* Pricing */}
        {activeTab === 'pricing' && (
          <div className="rental-section">
            <h2>💰 Pricing</h2>
            <div className="pricing-row">
              <div className="pricing-name">Nightly Rate</div>
              <div className="pricing-price">${rental.nightly_price} / night</div>
            </div>
            {rental.min_nights && (
              <div className="pricing-row">
                <div className="pricing-name">Minimum Stay</div>
                <div className="pricing-price">{rental.min_nights} night{rental.min_nights !== 1 ? 's' : ''}</div>
              </div>
            )}
            {rental.capacity && (
              <div className="pricing-row">
                <div className="pricing-name">Max Guests</div>
                <div className="pricing-price">{rental.capacity} people</div>
              </div>
            )}
            {nights > 0 && (
              <div className="pricing-row pricing-total">
                <div className="pricing-name">Total ({nights} nights)</div>
                <div className="pricing-price">${(rental.nightly_price * nights).toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        {/* FAQs */}
        {activeTab === 'faqs' && faqs.length > 0 && (
          <div className="rental-section">
            <h2>❓ Frequently Asked Questions</h2>
            <div className="faqs-list">
              {faqs.map((faq, i) => (
                <div key={faq.id || i} className="faq-row">
                  <div className="faq-question">{faq.question}</div>
                  <div className="faq-answer">{faq.answer}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {activeTab === 'location' && (
          <div className="rental-section">
            <h2>📍 Location</h2>
            {rental.address_line_1 && (
              <p className="address">
                {rental.address_line_1}<br />
                {[rental.city, rental.state, rental.zip].filter(Boolean).join(', ')}
              </p>
            )}
            {rental.directions_url && (
              <a href={rental.directions_url} target="_blank" rel="noopener noreferrer" className="btn btn-directions">
                📍 Get Directions
              </a>
            )}
            {!rental.address_line_1 && !rental.directions_url && (
              <p className="no-data">Contact host for exact address after booking.</p>
            )}
          </div>
        )}

        {/* Full Gallery */}
        {activeTab === 'gallery' && (
          <div className="rental-section">
            <h2>📸 All Photos ({photos.length})</h2>
            <div className="gallery-grid-preview">
              {photos.slice(galleryPage * GALLERY_PER_PAGE, (galleryPage + 1) * GALLERY_PER_PAGE).map((url, idx) => (
                <img key={idx} src={url} alt={`${rental.name} ${galleryPage * GALLERY_PER_PAGE + idx + 1}`}
                  className="gallery-preview-img"
                  onClick={() => setLightboxIdx(galleryPage * GALLERY_PER_PAGE + idx)} />
              ))}
            </div>
            {galleryTotal > 1 && (
              <div className="gallery-pagination">
                <button disabled={galleryPage === 0} onClick={() => setGalleryPage(p => p - 1)}>← Prev</button>
                <span>{galleryPage + 1} / {galleryTotal}</span>
                <button disabled={galleryPage >= galleryTotal - 1} onClick={() => setGalleryPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
        )}

        <button className="rd-back-btn" onClick={() => navigate('/staying')}>← Back to Rentals</button>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="rental-lightbox" onClick={() => setLightboxIdx(null)}>
          <button className="lightbox-close">✕</button>
          <button className="lightbox-prev" onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + photos.length) % photos.length) }}>‹</button>
          <img src={photos[lightboxIdx]} alt="" onClick={e => e.stopPropagation()} />
          <button className="lightbox-next" onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % photos.length) }}>›</button>
          <div className="lightbox-counter">{lightboxIdx + 1} / {photos.length}</div>
        </div>
      )}
    </div>
  )
}
