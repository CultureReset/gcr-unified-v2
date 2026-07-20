import { useState, useEffect } from 'react'
import { API_BASE } from '../config'

export default function BookingCalendar({ slug }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [guestCount, setGuestCount] = useState(1)
  const [availability, setAvailability] = useState(null)
  const [bookingData, setBookingData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    special_requests: ''
  })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset everything when the business changes -- previously nothing here
  // depended on slug at all, so a previously-picked date, guest count, and
  // availability from one business carried straight into a different
  // business's booking form when this component was reused.
  useEffect(() => {
    setSelectedDate(null)
    setGuestCount(1)
    setAvailability(null)
    setBookingData({ guest_name: '', guest_email: '', guest_phone: '', special_requests: '' })
    setMessage('')
  }, [slug])

  useEffect(() => {
    if (selectedDate) {
      checkAvailability(selectedDate)
    } else {
      setAvailability(null)
    }
  }, [selectedDate])

  const checkAvailability = async (date) => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings/${slug}/availability?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setAvailability(data)
      }
    } catch (err) {
      console.error('Error checking availability:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedDate || !bookingData.guest_name || !bookingData.guest_email) {
      setMessage('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/bookings/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_date: selectedDate,
          guest_count: guestCount,
          ...bookingData
        })
      })

      if (res.ok) {
        setMessage('Booking submitted successfully!')
        setSelectedDate(null)
        setBookingData({ guest_name: '', guest_email: '', guest_phone: '', special_requests: '' })
        setGuestCount(1)
      } else {
        const error = await res.json()
        setMessage(error.error || 'Error submitting booking')
      }
    } catch (err) {
      setMessage('Error submitting booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="content-section booking-section">
      <h2>📅 Book Now</h2>

      <form className="booking-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Date *</label>
          <input
            type="date"
            value={selectedDate || ''}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          {availability && (
            <div className={`availability-info ${availability.blocked ? 'blocked' : 'available'}`}>
              {availability.blocked ? '❌ Not available' : `✓ ${availability.available_slots - availability.booked_slots} slots available`}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Number of Guests</label>
          <input
            type="number"
            min="1"
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            value={bookingData.guest_name}
            onChange={(e) => setBookingData({ ...bookingData, guest_name: e.target.value })}
            placeholder="Your name"
          />
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            value={bookingData.guest_email}
            onChange={(e) => setBookingData({ ...bookingData, guest_email: e.target.value })}
            placeholder="Your email"
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            value={bookingData.guest_phone}
            onChange={(e) => setBookingData({ ...bookingData, guest_phone: e.target.value })}
            placeholder="Your phone"
          />
        </div>

        <div className="form-group">
          <label>Special Requests</label>
          <textarea
            value={bookingData.special_requests}
            onChange={(e) => setBookingData({ ...bookingData, special_requests: e.target.value })}
            placeholder="Any special requests or dietary restrictions?"
            rows="3"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Submitting...' : 'Submit Booking'}
        </button>

        {message && <div className="form-message">{message}</div>}
      </form>
    </section>
  )
}
