import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import './BookService.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

export default function BookService() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    check_in_date: searchParams.get('date') || '',
    check_in_time: searchParams.get('time') || '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function loadService() {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/api/services/${slug}`)
        if (!res.ok) throw new Error('Service not found')
        const data = await res.json()
        setService(data)
      } catch (err) {
        console.error('Error loading service:', err)
      } finally {
        setLoading(false)
      }
    }
    loadService()
  }, [slug])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSubmitting(true)
      const res = await fetch(`${API_BASE}/api/services/${slug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Booking failed')
      const booking = await res.json()

      // Redirect to confirmation
      navigate(`/confirmation/service/${booking.booking_id}`)
    } catch (err) {
      setToast({ message: 'Booking failed: ' + err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="book-service-loading">Loading...</div>
  if (!service) return <div className="book-service-error">Service not found</div>

  return (
    <div className="book-service">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="book-container">
        <h1>Book {service.name}</h1>

        <form onSubmit={handleSubmit} className="booking-form">
          {/* Guest Info */}
          <section className="form-section">
            <h2>Your Information</h2>
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

          {/* Service Date/Time */}
          <section className="form-section">
            <h2>Service Date & Time</h2>
            <input
              type="date"
              name="check_in_date"
              value={formData.check_in_date}
              onChange={handleInputChange}
              required
            />
            <input
              type="time"
              name="check_in_time"
              value={formData.check_in_time}
              onChange={handleInputChange}
              required
            />
          </section>

          {/* Notes */}
          <section className="form-section">
            <h2>Special Requests (Optional)</h2>
            <textarea
              name="notes"
              placeholder="Any special requests or details..."
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
            />
          </section>

          {/* Price */}
          <div className="price-display">
            <span>Price:</span>
            <span className="amount">${service.nightly_price || 0}</span>
          </div>

          <button type="submit" className="confirm-btn" disabled={submitting}>
            {submitting ? 'Sending...' : `Request to Book — $${service.nightly_price || 0} est.`}
          </button>
          <p className="booking-disclaimer">
            This sends a booking request to the service provider — no payment is collected here.
          </p>
        </form>

        <button className="bs-back-btn" onClick={() => navigate(`/service/${slug}`)}>
          ← Back
        </button>
      </div>
    </div>
  )
}
