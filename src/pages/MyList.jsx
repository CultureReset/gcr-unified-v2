import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './MyList.css'

const FILTERS = ['All', 'Food & Drink', 'Activities', 'Nightlife', 'Shopping']

export default function MyList() {
  const navigate = useNavigate()
  const { savedPlaces, removeSavedPlace, superLikedPlaces, removeSuperLike } = useApp()
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? savedPlaces
    : savedPlaces.filter(b => {
        if (filter === 'Food & Drink') return b.category === 'food'
        if (filter === 'Activities') return b.category === 'activities'
        if (filter === 'Nightlife') return b.category === 'nightlife'
        if (filter === 'Shopping') return b.category === 'shopping'
        return true
      })

  const total = savedPlaces.length + superLikedPlaces.length

  return (
    <div className="list-page page safe-top safe-bottom">
      <div className="list-header">
        <h2>My List</h2>
        <span className="list-count">{total} places</span>
      </div>

      {/* Must Do section */}
      {superLikedPlaces.length > 0 && (
        <div className="mustdo-section">
          <div className="mustdo-label">⭐ Must Do ({superLikedPlaces.length})</div>
          <div className="mustdo-list">
            {superLikedPlaces.map(b => (
              <div key={b.id} className="mustdo-item" onClick={() => navigate(`/business/${b.slug}`)}>
                <div className="mustdo-img" style={b.hero_image_url ? undefined : {background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                  {b.hero_image_url && <img src={b.hero_image_url} alt={b.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e => { e.target.style.display='none' }} />}
                </div>
                <div className="mustdo-name">{b.name}</div>
                <button className="mustdo-remove" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); removeSuperLike(b.id) }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="filter-scroll">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`filter-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="list-empty">
          <div style={{fontSize:64}}>❤️</div>
          <h3>Nothing saved yet</h3>
          <p>Start swiping to build your list</p>
          <button className="btn-primary" style={{width:'auto',padding:'14px 32px'}} onClick={() => navigate('/home')}>
            Start Swiping →
          </button>
        </div>
      ) : (
        <>
          <div className="places-list">
            {filtered.map(b => (
              <div key={b.id} className="place-item" onClick={() => navigate(`/business/${b.slug}`)}>
                <img src={b.hero_image_url} alt={b.name} className="place-thumb" />
                <div className="place-info">
                  <div className="place-name">{b.name}</div>
                  <div className="place-sub">{b.subtitle}</div>
                  <div className="place-meta">
                    {b.rating && <span>⭐ {b.rating}</span>}
                    {b.rating && b.price_range && <span className="dot">·</span>}
                    {b.price_range && <span>{b.price_range}</span>}
                  </div>
                </div>
                <button
                  className="remove-btn"
                  onClick={e => { e.stopPropagation(); removeSavedPlace(b.id) }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {savedPlaces.length >= 3 && (
            <div className="list-build-cta">
              <button className="btn-primary" onClick={() => navigate('/building')}>
                ✨ Build My Itinerary ({savedPlaces.length} places)
              </button>
              <p>Your AI will plan the perfect day-by-day trip</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
