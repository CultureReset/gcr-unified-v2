import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import './BookRental.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

export default function BookRental() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [rental, setRental] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    check_in_date: searchParams.get('checkIn') || '',
    check_out_date: searchParams.get('checkOut') || '',
  })
  const [pricing, setPricing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function loadRental() {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/api/rentals/${slug}`)
        if (!res.ok) throw new Error('Rental not found')
        const data = await res.json()
        setRental(data)
        calculatePricing(data, formData.check_in_date, formData.check_out_date)
      } catch (err) {
        console.error('Error loading rental:', err)
      } finally {
        setLoading(false)
      }
    }
    loadRental()
  }, [slug])

  const calculatePricing = (rental, checkIn, checkOut) => {
    if (!rental || !checkIn || !checkOut) return

    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24))

    const subtotal = (rental.nightly_price || 100) * nights
    const cleaning = rental.cleaning_fee || 0
    const serviceFee = subtotal * ((rental.service_fee_percent || 0) / 100)
    const total = subtotal + cleaning + serviceFee

    setPricing({
      nights,
      subtotal: subtotal.toFixed(2),
      cleaning: cleaning.toFixed(2),
      service_fee: serviceFee.toFixed(2),
      total: total.toFixed(2),
    })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    const updated = { ...formData, [name]: value }
    setFormData(updated)
    calculatePricing(rental, updated.check_in_date, updated.check_out_date)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pricing) return

    try {
      setSubmitting(true)
      const res = await fetch(`${API_BASE}/api/rentals/${slug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          nightly_rate: rental.nightly_price,
          cleaning_fee: parseFloat(pricing.cleaning),
          service_fee: parseFloat(pricing.service_fee),
        }),
      })

      if (!res.ok) throw new Error('Booking failed')
      const booking = await res.json()

      // Redirect to confirmation
      navigate(`/confirmation/rental/${booking.booking_id}`)
    } catch (err) {
      setToast({ message: 'Booking failed: ' + err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="book-rental-loading">Loading...</div>
  if (!rental) return <div className="book-rental-error">Rental not found</div>

  return (
    <div className="book-rental">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="book-container">
        <h1>Confirm Your Booking</h1>
        <p className="subtitle">{rental.name}</p>

        <form onSubmit={handleSubmit} className="booking-form">
          {/* Guest Info */}
          <section className="form-section">
            <h2>Guest Information</h2>
            <input
              type="text"
              name="guest_name"
              placeholder="Full Name"
              value={formData.guest_name}
              onChange={handleInputChange}
              required
            />
            <input
              type="email"
              name="guest_email"
              placeholder="Email"
              value={formData.guest_email}
              onChange={handleInputChange}
            />
            <input
              type="tel"
              name="guest_phone"
              placeholder="Phone"
              value={formData.guest_phone}
              onChange={handleInputChange}
            />
          </section>

          {/* Dates */}
          <section className="form-section">
            <h2>Check-in / Check-out</h2>
            <input
              type="date"
              name="check_in_date"
              value={formData.check_in_date}
              onChange={handleInputChange}
              required
            />
            <input
              type="date"
              name="check_out_date"
              value={formData.check_out_date}
              onChange={handleInputChange}
              required
            />
          </section>

          {/* Pricing Summary */}
          {pricing && (
            <section className="pricing-summary">
              <h2>Estimated Price</h2>
              <div className="price-row">
                <span>${rental.nightly_price || 100} × {pricing.nights} nights</span>
                <span>${pricing.subtotal}</span>
              </div>
              {parseFloat(pricing.cleaning) > 0 && (
                <div className="price-row">
                  <span>Cleaning Fee</span>
                  <span>${pricing.cleaning}</span>
                </div>
              )}
              {parseFloat(pricing.service_fee) > 0 && (
                <div className="price-row">
                  <span>Service Fee</span>
                  <span>${pricing.service_fee}</span>
                </div>
              )}
              <div className="price-row total">
                <span>Total</span>
                <span>${pricing.total}</span>
              </div>
            </section>
          )}

          <button type="submit" className="confirm-btn" disabled={submitting || !pricing}>
            {submitting ? 'Sending...' : `Request to Book — $${pricing?.total || 0} est.`}
          </button>
          <p className="booking-disclaimer">
            This sends a booking request to the property owner — no payment is collected here.
          </p>
        </form>

        <button className="br-back-btn" onClick={() => navigate(`/rental/${slug}`)}>
          ← Back
        </button>
      </div>
    </div>
  )
}
