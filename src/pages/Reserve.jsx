import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Toast from '../components/Toast'
import './Reserve.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

const SMS_CONSENT_TEXT = 'By checking this box, you agree to receive text messages about this booking from Gulf Coast Radar and the business at the phone number provided. Msg & data rates may apply, message frequency varies. Reply STOP to opt out at any time. Consent is not a condition of purchase.'

// Common dinner-service window, in 30-min increments — used as a fallback
// grid whenever a business hasn't set up (or synced from FareHarbor/Peak/
// Airbnb) real per-slot capacity in business_availability yet. Real slots
// from the API always take priority over this when present for a date.
function defaultTimeOptions() {
  const times = []
  for (let mins = 17 * 60; mins <= 21 * 60 + 30; mins += 30) {
    const h24 = Math.floor(mins / 60)
    const m = mins % 60
    const h12 = h24 % 12 || 12
    times.push({ value: `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}` })
  }
  return times
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Reserve() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clickId = searchParams.get('cid') || null

  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [availability, setAvailability] = useState([])
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Opt-in gate — captured before the rest of the booking flow so the
  // business has a name + phone on file even if the customer abandons
  // checkout, and so SMS only ever goes to numbers with explicit consent
  // (required until A2P 10DLC approval is in place).
  const [optedIn, setOptedIn] = useState(false)
  const [optInId, setOptInId] = useState(null)
  const [optInSubmitting, setOptInSubmitting] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  // Waiver — clickwrap (typed name already collected above + checkbox),
  // shown only when the business has turned waiver_required on.
  const [waiverAgreed, setWaiverAgreed] = useState(false)
  const [waiverSigned, setWaiverSigned] = useState(false)
  const [waiverId, setWaiverId] = useState(null)
  const [waiverSubmitting, setWaiverSubmitting] = useState(false)
  const [signatureTypedName, setSignatureTypedName] = useState('')

  const [partySize, setPartySize] = useState(2)
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState(null)
  const [notes, setNotes] = useState('')

  // Transportation add-on — available on ANY booking, not just pickup/delivery
  // businesses like Gulf Coast Luggo. GCR brokers this out via SMS dispatch
  // (POST /api/transportation/request), separate from the reservation itself.
  const [wantsRide, setWantsRide] = useState(false)
  const [ridePickup, setRidePickup] = useState('')
  const [rideDropoff, setRideDropoff] = useState('')
  const [rideWindow, setRideWindow] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [bizRes, availRes] = await Promise.all([
          fetch(`${API_BASE}/api/gcr/entity/${slug}`),
          fetch(`${API_BASE}/api/email-parser/availability/${slug}`),
        ])
        if (bizRes.ok) setBusiness(await bizRes.json())
        if (availRes.ok) {
          const d = await availRes.json()
          setAvailability(d.availability || [])
        }
      } catch (err) {
        console.error('Error loading reservation page:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // Real synced slots for the selected date (from FareHarbor/Peak/Airbnb sync
  // or a business's own manual setup) — falls back to the generic dinner
  // window when the business hasn't got real slot data for this date yet.
  const slotsForDate = useMemo(
    () => availability.filter(a => a.availability_date === date && a.time_slot),
    [availability, date]
  )
  const hasRealSlots = slotsForDate.length > 0
  const timeOptions = hasRealSlots
    ? slotsForDate.map(s => ({
        value: s.time_slot,
        label: new Date(`2000-01-01T${s.time_slot}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        remaining: s.remaining_spots,
        full: s.status === 'full' || s.remaining_spots === 0,
      }))
    : defaultTimeOptions()

  async function handleOptInContinue(e) {
    e.preventDefault()
    if (!guestName.trim()) { setToast({ message: 'Name required', type: 'error' }); return }
    if (!guestPhone.trim()) { setToast({ message: 'Phone number required', type: 'error' }); return }

    setOptInSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/gcr/opt-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_slug: slug,
          click_id: clickId,
          name: guestName.trim(),
          phone: guestPhone.trim(),
          email: guestEmail.trim() || null,
          sms_consent: smsConsent,
          consent_text: smsConsent ? SMS_CONSENT_TEXT : null,
        }),
      })
      if (!res.ok) throw new Error('Could not continue — please try again')
      const data = await res.json()
      setOptInId(data.opt_in_id || null)
      setOptedIn(true)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setOptInSubmitting(false)
    }
  }

  async function handleWaiverSign(e) {
    e.preventDefault()
    if (!waiverAgreed) { setToast({ message: 'Check the box to agree to the waiver', type: 'error' }); return }

    setWaiverSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/gcr/waiver/${slug}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: guestName.trim(),
          customer_email: guestEmail.trim() || null,
          customer_phone: guestPhone.trim() || null,
          waiver_text: business.waiver_text,
          signature_typed_name: signatureTypedName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not sign waiver')
      setWaiverId(data.waiver_id || null)
      setWaiverSigned(true)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setWaiverSubmitting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!time) { setToast({ message: 'Pick a time', type: 'error' }); return }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/email-parser/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_slug: slug,
          platform: 'gcr',
          booking_type: 'restaurant',
          event_date: date,
          event_time: time,
          party_size: partySize,
          customer_name: guestName.trim(),
          customer_email: guestEmail.trim() || null,
          customer_phone: guestPhone.trim() || null,
          opt_in_id: optInId,
          status: 'pending',
          notes: [notes, waiverId && `Waiver ID: ${waiverId}`].filter(Boolean).join(' | '),
        }),
      })
      if (!res.ok) throw new Error('Reservation request failed')
      const data = await res.json()

      if (wantsRide && ridePickup.trim() && rideDropoff.trim()) {
        fetch(`${API_BASE}/api/transportation/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'reservation_addon',
            linked_entity_slug: slug,
            customer_name: guestName.trim(),
            customer_phone: guestPhone.trim(),
            request_type: 'passenger',
            pickup_location: ridePickup.trim(),
            dropoff_location: rideDropoff.trim(),
            pickup_date: date,
            pickup_window: rideWindow,
            passengers: partySize,
          }),
        }).catch(() => {})
      }

      navigate(`/confirmation/reservation/${data.log_id || 'pending'}`)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="reserve-loading">Loading...</div>
  if (!business) return <div className="reserve-error">Business not found</div>

  const hero = business.hero_image_url || business.photos?.[0]?.image_url

  return (
    <div className="reserve-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <button className="reserve-back" onClick={() => navigate(`/business/${slug}`)}>← Back</button>

      <div className="reserve-hero" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
        {!hero && <span className="reserve-hero-emoji">{business.icon || '🍽️'}</span>}
      </div>

      <div className="reserve-container">
        <h1>Reserve a Table</h1>
        <div className="reserve-biz-name">{business.name}</div>
        {business.address_line_1 && (
          <div className="reserve-biz-addr">📍 {business.address_line_1}{business.city ? `, ${business.city}` : ''}</div>
        )}
        {business.description && <p className="reserve-biz-desc">{business.description}</p>}

        {!optedIn ? (
          <form onSubmit={handleOptInContinue} className="reserve-form">
            <section className="reserve-section">
              <h2>Your Information</h2>
              <input type="text" placeholder="Full Name" value={guestName} onChange={e => setGuestName(e.target.value)} required />
              <input type="tel" placeholder="Phone Number" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} required />
              <input type="email" placeholder="Email (optional)" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
            </section>

            <section className="reserve-section">
              <label className="reserve-consent-row">
                <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} />
                <span>Text me updates about this booking</span>
              </label>
              <p className="reserve-consent-text">{SMS_CONSENT_TEXT}</p>
            </section>

            <button type="submit" className="reserve-submit" disabled={optInSubmitting}>
              {optInSubmitting ? 'Please wait...' : 'Continue'}
            </button>
          </form>
        ) : business.waiver_required && !waiverSigned ? (
          <form onSubmit={handleWaiverSign} className="reserve-form">
            <section className="reserve-section">
              <h2>Waiver</h2>
              <div className="reserve-waiver-text">{business.waiver_text}</div>
              {business.waiver_document_url && (
                <a href={business.waiver_document_url} target="_blank" rel="noopener noreferrer" className="reserve-doc-link">📄 View full waiver document</a>
              )}
            </section>

            <section className="reserve-section">
              <label className="reserve-consent-row">
                <input type="checkbox" checked={waiverAgreed} onChange={e => setWaiverAgreed(e.target.checked)} />
                <span>I have read and agree to the waiver above</span>
              </label>
              <p className="reserve-consent-text">Type your full name exactly as entered above to sign.</p>
              <input type="text" placeholder="Type your full name to sign" value={signatureTypedName} onChange={e => setSignatureTypedName(e.target.value)} required />
            </section>

            <button type="submit" className="reserve-submit" disabled={waiverSubmitting || !waiverAgreed}>
              {waiverSubmitting ? 'Signing...' : 'Agree & Sign'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="reserve-form">
            <section className="reserve-section">
              <h2>Party Size</h2>
              <div className="party-stepper">
                <button type="button" onClick={() => setPartySize(p => Math.max(1, p - 1))}>−</button>
                <span>{partySize} {partySize === 1 ? 'guest' : 'guests'}</span>
                <button type="button" onClick={() => setPartySize(p => Math.min(20, p + 1))}>+</button>
              </div>
            </section>

            <section className="reserve-section">
              <h2>Date</h2>
              <input
                type="date"
                value={date}
                min={todayISO()}
                onChange={e => { setDate(e.target.value); setTime(null) }}
                required
              />
            </section>

            <section className="reserve-section">
              <h2>Time</h2>
              {!hasRealSlots && (
                <p className="reserve-time-note">Showing typical hours — exact time will be confirmed by the restaurant.</p>
              )}
              <div className="time-grid">
                {timeOptions.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    disabled={t.full}
                    className={`time-slot ${time === t.value ? 'active' : ''} ${t.full ? 'full' : ''}`}
                    onClick={() => setTime(t.value)}
                  >
                    {t.label}
                    {hasRealSlots && !t.full && t.remaining != null && <span className="time-slot-spots">{t.remaining} left</span>}
                    {t.full && <span className="time-slot-spots">Full</span>}
                  </button>
                ))}
              </div>
            </section>

            <section className="reserve-section">
              <h2>Special Requests (Optional)</h2>
              <textarea placeholder="Allergies, occasion, seating preference..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </section>

            <section className="reserve-section reserve-addon">
              <label className="reserve-consent-row">
                <input type="checkbox" checked={wantsRide} onChange={e => setWantsRide(e.target.checked)} />
                <span>🚗 Need a ride to or from {business.name}?</span>
              </label>
              {wantsRide && (
                <div className="reserve-addon-fields">
                  <input type="text" placeholder="Pickup location" value={ridePickup} onChange={e => setRidePickup(e.target.value)} required={wantsRide} />
                  <input type="text" placeholder="Drop-off location" value={rideDropoff} onChange={e => setRideDropoff(e.target.value)} required={wantsRide} />
                  <input type="text" placeholder="Preferred time (e.g. 6:30 PM)" value={rideWindow} onChange={e => setRideWindow(e.target.value)} />
                  <p className="reserve-consent-text">A local driver is offered this trip separately and will text you a price to confirm — not run or guaranteed by {business.name}.</p>
                </div>
              )}
            </section>

            {(business.deposit_amount || business.cancellation_policy || business.refund_policy) && (
              <section className="reserve-section reserve-policies">
                <h2>Policies</h2>
                {business.deposit_amount && (
                  <p><strong>Deposit:</strong> {business.deposit_type === 'percent' ? `${business.deposit_amount}%` : `$${business.deposit_amount}`}</p>
                )}
                {business.cancellation_policy && (
                  <div>
                    <strong>Cancellation Policy</strong>
                    <p>{business.cancellation_policy}</p>
                    {business.cancellation_policy_doc_url && (
                      <a href={business.cancellation_policy_doc_url} target="_blank" rel="noopener noreferrer" className="reserve-doc-link">📄 Full document</a>
                    )}
                  </div>
                )}
                {business.refund_policy && (
                  <div>
                    <strong>Refund Policy</strong>
                    <p>{business.refund_policy}</p>
                    {business.refund_policy_doc_url && (
                      <a href={business.refund_policy_doc_url} target="_blank" rel="noopener noreferrer" className="reserve-doc-link">📄 Full document</a>
                    )}
                  </div>
                )}
              </section>
            )}

            <button type="submit" className="reserve-submit" disabled={submitting}>
              {submitting ? 'Sending...' : `Request Table for ${partySize}`}
            </button>
            <p className="reserve-disclaimer">
              This sends a reservation request to {business.name} — no payment is collected here.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
