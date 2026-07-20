import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'
import { useApp, authFetch } from '../context/AppContext'

export default function ReviewsSection({ slug, googleRating, googleReviewCount }) {
  const navigate = useNavigate()
  const { userId } = useApp()
  const loggedIn = !!userId || !!localStorage.getItem('gcr_access_token')
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    rating: 5,
    title: '',
    body: ''
  })
  const [message, setMessage] = useState('')

  // Reset to page 1 whenever the business changes so a new business isn't
  // queried at whatever page the previous business had scrolled to.
  useEffect(() => {
    setPage(1)
  }, [slug])

  useEffect(() => {
    loadReviews()
    loadStats()
  }, [slug, page])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/reviews/${slug}?page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews || [])
      }
    } catch (err) {
      console.error('Error loading reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reviews/${slug}/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.body) {
      setMessage('Please add a title and your review')
      return
    }
    try {
      // Logged-in tourists post authentic reviews tied to their phone account
      // (name/email come from the account — no anonymous typing).
      const res = await authFetch('/api/tourist/reviews', {
        method: 'POST',
        body: JSON.stringify({
          entity_slug: slug,
          rating: formData.rating,
          title: formData.title,
          body: formData.body,
        }),
      })
      if (res.ok) {
        setMessage('Review submitted — pending review. Thank you!')
        setFormData({ rating: 5, title: '', body: '' })
        setShowForm(false)
        loadReviews()
        loadStats()
      } else {
        const d = await res.json().catch(() => ({}))
        setMessage(d.error || 'Error submitting review')
      }
    } catch (err) {
      setMessage('Error submitting review')
    }
  }

  const renderStars = (rating) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className="star" style={{ color: i < rating ? '#ffc107' : '#ddd' }}>
        ★
      </span>
    ))
  }

  return (
    <section className="content-section reviews-section">
      <h2>⭐ Reviews</h2>

      {stats && stats.total > 0 ? (
        <div className="reviews-stats">
          <div className="rating-summary">
            <div className="rating-large">{stats.average}</div>
            <div className="rating-stars">{renderStars(Math.round(stats.average))}</div>
            <div className="rating-count">{stats.total} reviews</div>
          </div>

          <div className="rating-breakdown">
            {[5, 4, 3, 2, 1].map(rating => (
              <div key={rating} className="rating-bar">
                <span className="rating-label">{rating}★</span>
                <div className="bar-background">
                  <div
                    className="bar-fill"
                    style={{
                      width: stats.total > 0 ? `${((stats.distribution?.[rating] || 0) / stats.total) * 100}%` : '0'
                    }}
                  />
                </div>
                <span className="rating-count">{stats.distribution?.[rating] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      ) : googleRating ? (
        /* No on-platform reviews yet, but we have the business's aggregate
           Google rating — show that instead of an empty all-zero widget that
           contradicts the star rating shown in the page header. */
        <div className="reviews-stats reviews-stats-google">
          <div className="rating-summary">
            <div className="rating-large">{Number(googleRating).toFixed(1)}</div>
            <div className="rating-stars">{renderStars(Math.round(googleRating))}</div>
            <div className="rating-count">{googleReviewCount || 0} Google reviews</div>
          </div>
          <p className="rating-source-note">Aggregate rating from Google. Be the first to leave a review here on Gulf Coast Radar.</p>
        </div>
      ) : null}

      <div className="reviews-actions">
        {loggedIn ? (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : 'Write a Review'}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => navigate('/auth')}
          >
            Sign in to write a review
          </button>
        )}
      </div>

      {showForm && loggedIn && (
        <form className="review-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating *</label>
            <div className="rating-selector">
              {[5, 4, 3, 2, 1].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${formData.rating >= star ? 'active' : ''}`}
                  onClick={() => setFormData({ ...formData, rating: star })}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Review title"
            />
          </div>

          <div className="form-group">
            <label>Review *</label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Share your experience..."
              rows="4"
            />
          </div>

          <button type="submit" className="btn btn-primary">Submit Review</button>
          {message && <div className="form-message">{message}</div>}
        </form>
      )}

      {loading ? (
        <p className="loading">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="no-data">{googleRating ? 'No Gulf Coast Radar reviews yet — be the first to write one!' : 'No reviews yet. Be the first to review!'}</p>
      ) : (
        <>
          <div className="reviews-list">
            {reviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <div className="review-info">
                    <div className="review-name">{review.reviewer_name}</div>
                    <div className="review-rating">{renderStars(review.rating)}</div>
                  </div>
                  <div className="review-date">
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="review-title">{review.title}</div>
                <div className="review-body">{review.body}</div>
                {review.verified_purchase && (
                  <span className="verified-badge">✓ Verified Purchase</span>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="reviews-pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="btn btn-small"
            >
              Previous
            </button>
            <span>{page}</span>
            <button
              onClick={() => setPage(page + 1)}
              className="btn btn-small"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  )
}
