import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageHeader from '../components/PageHeader'
import Toast from '../components/Toast'
import { SkeletonGrid } from '../components/SkeletonLoader'
import './Saves.css'

// Reads/writes through AppContext's savedPlaces instead of its own independent
// fetch — this used to be a second, disconnected copy of "my saved places"
// (MyList.jsx and Swipe.jsx both go through AppContext), so removing or
// adding a save on one screen wouldn't show up on the other.
export default function Saves() {
  const navigate = useNavigate()
  const { userId, savedPlaces, removeSavedPlace, refreshSaves } = useApp()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!userId) {
      navigate('/auth')
      return
    }

    setLoading(true)
    setError(null)
    refreshSaves()
      .catch(() => setError('Connection error. Please try again.'))
      .finally(() => setLoading(false))
  }, [userId, navigate, refreshSaves])

  const saves = savedPlaces

  const handleRemove = async (id) => {
    try {
      await removeSavedPlace(id)
      setToast({ message: 'Removed from saved', type: 'success' })
    } catch (err) {
      setToast({ message: 'Failed to remove save', type: 'error' })
    }
  }

  return (
    <div className="saves-page">
      <PageHeader title="❤️ Saved Places" subtitle={`${saves.length} item${saves.length !== 1 ? 's' : ''} saved`} showBack={true} />

      <div className="saves-content">
        {loading ? (
          <SkeletonGrid count={4} />
        ) : error ? (
          <div className="empty-state" style={{background:'rgba(239,68,68,0.1)',borderRadius:'12px',padding:'40px 20px'}}>
            <p style={{fontSize:'28px',marginBottom:'12px'}}>⚠️</p>
            <p style={{fontWeight:600,marginBottom:'8px'}}>Couldn't Load Saves</p>
            <p style={{fontSize:'13px',color:'var(--text2)'}}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{marginTop:'12px',padding:'8px 16px',background:'var(--accent)',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'14px'}}
            >
              Try Again
            </button>
          </div>
        ) : saves.length === 0 ? (
          <div className="empty-state" style={{padding:'60px 20px'}}>
            <p style={{fontSize:'40px',marginBottom:'12px'}}>💾</p>
            <p style={{fontWeight:600,marginBottom:'8px'}}>No saved places yet</p>
            <p style={{fontSize:'13px',color:'var(--text2)',marginBottom:'20px'}}>Save restaurants, events, and activities to your list</p>
            <button
              onClick={() => navigate('/search')}
              style={{padding:'10px 20px',background:'var(--primary)',color:'white',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'14px',fontWeight:600}}
            >
              Browse Places →
            </button>
          </div>
        ) : (
          <div className="saves-grid">
            {saves.map(item => (
              <div key={item.id || item.slug} className="save-card">
                {item.hero_image_url && (
                  <img src={item.hero_image_url} alt={item.name} className="save-image" />
                )}
                <div className="save-content">
                  <h3 className="save-name">{item.name}</h3>
                  {item.subtitle && <p className="save-subtitle">{item.subtitle}</p>}
                  {item.category && <p className="save-category">{item.category}</p>}
                  <div className="save-actions">
                    <button
                      className="save-btn primary"
                      onClick={() => navigate(`/business/${item.slug}`)}
                    >
                      View Details
                    </button>
                    <button
                      className="save-btn danger"
                      onClick={() => handleRemove(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  )
}
