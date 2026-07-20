import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import './TransportationRequest.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TIME_WINDOWS = [
  '8:00 AM – 10:00 AM', '10:00 AM – 12:00 PM', '12:00 PM – 2:00 PM',
  '2:00 PM – 4:00 PM', '4:00 PM – 6:00 PM', 'Flexible / call to confirm',
]

// Generic request form for ANY business with offers_transportation=true —
// not specific to one tenant. request_type toggles luggage vs passenger
// framing, driven by the business's own registered driver capabilities.
export default function TransportationRequest() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [requestType, setRequestType] = useState('passenger')
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropoffLocation, setDropoffLocation] = useState('')
  const [pickupDate, setPickupDate] = useState(todayISO())
  const [pickupWindow, setPickupWindow] = useState('')
  const [passengers, setPassengers] = useState(2)
  const [bagCount, setBagCount] = useState('1–2 bags')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/gcr/entity/${slug}`)
        if (res.ok) {
          const data = await res.json()
          setBusiness(data)
          if (data.entity_subtype === 'luggage_service') setRequestType('luggage')
        }
      } catch (err) {
        console.error('Error loading transportation service:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pickupLocation.trim() || !dropoffLocation.trim()) { setToast({ message: 'Pickup and drop-off locations are required', type: 'error' }); return }
    if (!name.trim() || !phone.trim()) { setToast({ message: 'Name and phone are required', type: 'error' }); return }
    if (!pickupWindow) { setToast({ message: 'Pick a time window', type: 'error' }); return }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/transportation/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'direct',
          linked_entity_slug: slug,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          request_type: requestType,
          pickup_location: pickupLocation.trim(),
          dropoff_location: dropoffLocation.trim(),
          pickup_date: pickupDate,
          pickup_window: pickupWindow,
          passengers: requestType === 'passenger' ? passengers : 1,
          bag_count: requestType === 'luggage' ? bagCount : null,
          notes,
        }),
      })
      if (!res.ok) throw new Error('Request failed — please try again')
      const data = await res.json()
      navigate(`/confirmation/transportation/${data.request_id || 'pending'}`)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="transport-loading">Loading...</div>
  if (!business) return <div className="transport-error">Business not found</div>
  if (!business.offers_transportation) return <div className="transport-error">This business doesn't offer transportation requests.</div>

  return (
    <div className="transport-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <button className="transport-back" onClick={() => navigate(`/business/${slug}`)}>← Back</button>

      <div className="transport-hero">
        <span className="transport-hero-icon">{business.icon || '🚗'}</span>
        <h1>{business.name}</h1>
        <p>{business.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="transport-container">
        <section className="transport-section">
          <div className="transport-section-label">What do you need moved?</div>
          <div className="request-type-toggle">
            <button type="button" className={requestType === 'passenger' ? 'active' : ''} onClick={() => setRequestType('passenger')}>🧍 People</button>
            <button type="button" className={requestType === 'luggage' ? 'active' : ''} onClick={() => setRequestType('luggage')}>🧳 Luggage</button>
          </div>
        </section>

        <section className="transport-section">
          <div className="transport-section-label">Pickup</div>
          <input type="text" placeholder="Pickup location (condo, hotel, airport...)" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} required />
        </section>

        <section className="transport-section">
          <div className="transport-section-label">Drop-off</div>
          <input type="text" placeholder="Drop-off location" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} required />
        </section>

        <section className="transport-section">
          <div className="transport-row">
            <div className="transport-field">
              <label>Date</label>
              <input type="date" value={pickupDate} min={todayISO()} onChange={e => setPickupDate(e.target.value)} required />
            </div>
            <div className="transport-field">
              <label>Time Window</label>
              <select value={pickupWindow} onChange={e => setPickupWindow(e.target.value)} required>
                <option value="" disabled>Choose a window</option>
                {TIME_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </section>

        {requestType === 'passenger' ? (
          <section className="transport-section">
            <div className="transport-section-label">Passengers</div>
            <div className="party-stepper">
              <button type="button" onClick={() => setPassengers(p => Math.max(1, p - 1))}>−</button>
              <span>{passengers} {passengers === 1 ? 'passenger' : 'passengers'}</span>
              <button type="button" onClick={() => setPassengers(p => Math.min(12, p + 1))}>+</button>
            </div>
          </section>
        ) : (
          <section className="transport-section">
            <div className="transport-section-label">Bags</div>
            <div className="bag-count-row">
              {['1–2 bags', '3–4 bags', '5–6 bags', '7+ bags'].map(b => (
                <button type="button" key={b} className={`bag-count-btn ${bagCount === b ? 'active' : ''}`} onClick={() => setBagCount(b)}>{b}</button>
              ))}
            </div>
          </section>
        )}

        <section className="transport-section">
          <div className="transport-section-label">Your Information</div>
          <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} required />
        </section>

        <section className="transport-section">
          <div className="transport-section-label">Details (Optional)</div>
          <textarea placeholder="Flight time, gate code, special instructions..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
        </section>

        <button type="submit" className="transport-submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Request Pickup'}
        </button>
        <p className="transport-disclaimer">
          This is brokered separately by Gulf Coast Radar — a driver will text you a price to confirm. No payment is collected here.
        </p>
      </form>
    </div>
  )
}
