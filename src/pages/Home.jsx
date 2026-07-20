import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Toast from '../components/Toast'
import { CATEGORIES } from '../data/categories'
import { fetchHomeFeed, saveItem, unsaveItem } from '../services/gcrApi'
import './Home.css'

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function SlideRow({ title, children, empty }) {
  const ref = useRef(null)
  if (!children || children.length === 0) return null
  return (
    <div className="slide-section">
      <h3 className="section-title">{title}</h3>
      <div className="slide-row" ref={ref}>
        {children}
        {empty && <div className="slide-empty">{empty}</div>}
      </div>
    </div>
  )
}

function EntityImg({ url, name }) {
  const [err, setErr] = useState(false)
  if (!url || err) return <div className="card-img-placeholder" />
  return <img src={url} alt={name} onError={() => setErr(true)} />
}

export default function Home() {
  const navigate = useNavigate()
  const { tourist, savedPlaces, itinerary, addSavedPlace, removeSavedPlace, userId } = useApp()
  const [feed, setFeed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const savedSlugs = new Set((savedPlaces || []).map(p => p.slug))

  useEffect(() => {
    let cancelled = false
    fetchHomeFeed()
      .then(d => { if (!cancelled) { setFeed(d); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const handleSave = async (e, slug) => {
    e.stopPropagation()
    if (!userId) { navigate('/auth'); return }
    try {
      if (savedSlugs.has(slug)) {
        const item = savedPlaces.find(p => p.slug === slug)
        if (item) await removeSavedPlace(item.id)
        setToast({ message: 'Removed', type: 'info' })
      } else {
        const biz = feed && [...(feed.events||[]), ...(feed.thingsToDo||[])].find(b => (b.entity?.slug||b.entity_slug||b.slug) === slug)
        if (biz?.entity || biz) await addSavedPlace(biz.entity || biz)
        setToast({ message: 'Saved!', type: 'success' })
      }
    } catch { setToast({ message: 'Error saving', type: 'error' }) }
  }

  const events     = feed?.events     || []
  const specials   = feed?.specials   || []
  const happyHours = feed?.happyHours || []
  const liveMusic  = feed?.liveMusic  || []
  const thingsToDo = feed?.thingsToDo || []
  const socialPosts = feed?.socialPosts || []

  const hasContent = events.length || specials.length || happyHours.length || liveMusic.length || thingsToDo.length || socialPosts.length

  return (
    <div className="home-page page safe-top safe-bottom">

      {/* Header */}
      <div className="home-header">
        <div className="home-greeting">
          <h2>{greeting()}{tourist?.name ? `, ${tourist.name.split(' ')[0]}` : ''}! 👋</h2>
          <p className="home-dest">
            📍 {tourist?.destination || 'Gulf Coast'}
            {tourist?.arrival && ` · ${new Date(tourist.arrival).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
            {tourist?.departure && ` – ${new Date(tourist.departure).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
          </p>
        </div>
        <button className="home-avatar" onClick={() => navigate('/profile')}>
          {tourist?.name?.[0]?.toUpperCase() || '?'}
        </button>
      </div>

      {/* Setup prompt — shown when profile incomplete */}
      {!tourist?.setupComplete && (
        <div className="setup-banner" onClick={() => navigate('/setup')}>
          <div className="setup-banner-icon">✨</div>
          <div className="setup-banner-text">
            <div className="setup-banner-title">Complete your trip profile</div>
            <div className="setup-banner-sub">Get personalized picks for your dates & vibe</div>
          </div>
          <span className="setup-banner-arrow">→</span>
        </div>
      )}

      {/* Still need a place to stay? — shown when tourist is looking for lodging */}
      {tourist?.stay_status === 'looking' && (
        <div className="stay-banner">
          <span>🏨</span>
          <div>
            <div className="stay-banner-title">Still need a place to stay?</div>
            <div className="stay-banner-sub">We'll show hotels & condos in your deck</div>
          </div>
          <button className="stay-banner-btn" onClick={() => navigate('/swipe/staying')}>Browse →</button>
        </div>
      )}

      {/* Quick stats */}
      <div className="home-stats">
        <div className="stat"><div className="stat-num">{savedPlaces.length}</div><div className="stat-label">Saved</div></div>
        <div className="stat-divider" />
        <div className="stat"><div className="stat-num">{tourist?.trip_days || (tourist?.arrival && tourist?.departure ? Math.ceil((new Date(tourist.departure) - new Date(tourist.arrival)) / 86400000) : '—')}</div><div className="stat-label">Days</div></div>
        <div className="stat-divider" />
        <div className="stat"><div className="stat-num">{itinerary ? itinerary.days.length : '—'}</div><div className="stat-label">Planned</div></div>
      </div>

      {/* Plan with friends — group trips entry point */}
      <button className="stay-banner" onClick={() => navigate('/groups')} style={{width:'100%',border:'none',cursor:'pointer',background:'linear-gradient(135deg,rgba(14,165,233,.15),rgba(124,106,247,.15))',borderColor:'rgba(124,106,247,.3)'}}>
        <span>👥</span>
        <div style={{flex:1,textAlign:'left'}}>
          <div className="stay-banner-title">Plan with friends</div>
          <div className="stay-banner-sub">Swipe together, see overlaps, build a shared trip</div>
        </div>
        <span className="stay-banner-btn">Open →</span>
      </button>

      {/* Loading skeletons */}
      {loading && (
        <div className="feed-skeletons">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-section">
              <div className="skeleton-title" />
              <div className="skeleton-row">
                {[1,2,3].map(j => <div key={j} className="skeleton-card-h" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SLIDE ROWS ────────────────────────────────────────── */}

      {/* Happy Hours NOW */}
      {!loading && happyHours.length > 0 && (
        <SlideRow title="🍺 Happy Hour Right Now">
          {happyHours.map(b => (
            <button key={b.slug} className="slide-card hh-card" onClick={() => navigate(`/business/${b.slug}`)}>
              <div className="slide-card-img">
                <EntityImg url={b.hero_image_url} name={b.name} />
                <span className="live-badge">LIVE</span>
              </div>
              <div className="slide-card-body">
                <div className="slide-card-name">{b.name}</div>
                {b.hh_description && <div className="slide-card-sub">{b.hh_description}</div>}
                <div className="slide-card-time">Until {formatTime(b.hh_end)}</div>
              </div>
            </button>
          ))}
        </SlideRow>
      )}

      {/* Events Tonight */}
      {!loading && events.length > 0 && (
        <SlideRow title="🎉 Events Tonight">
          {events.map(ev => {
            const ent = ev.entity || {}
            return (
              <button key={ev.id} className="slide-card event-card" onClick={() => navigate(`/business/${ev.entity_slug}`)}>
                <div className="slide-card-img event-img">
                  <EntityImg url={ev.image_url || ent.hero_image_url} name={ev.event_name} />
                  {ev.start_time && <span className="time-badge">{formatTime(ev.start_time)}</span>}
                </div>
                <div className="slide-card-body">
                  <div className="slide-card-name">{ev.event_name}</div>
                  <div className="slide-card-venue">{ent.name}</div>
                  {ev.cover_charge > 0 && <div className="slide-card-cover">${ev.cover_charge} cover</div>}
                  {ev.cover_charge === 0 && <div className="slide-card-free">Free</div>}
                </div>
              </button>
            )
          })}
        </SlideRow>
      )}

      {/* Live Music */}
      {!loading && liveMusic.length > 0 && (
        <SlideRow title="🎸 Live Music Tonight">
          {liveMusic.map(ev => {
            const ent = ev.entity || {}
            return (
              <button key={ev.id} className="slide-card music-card" onClick={() => navigate(`/business/${ev.entity_slug}`)}>
                <div className="slide-card-img music-img">
                  <EntityImg url={ev.image_url || ent.hero_image_url} name={ev.artist_name || ev.event_name} />
                  {ev.start_time && <span className="time-badge">{formatTime(ev.start_time)}</span>}
                </div>
                <div className="slide-card-body">
                  <div className="slide-card-name">{ev.artist_name || ev.event_name}</div>
                  <div className="slide-card-venue">{ent.name}</div>
                </div>
              </button>
            )
          })}
        </SlideRow>
      )}

      {/* Specials */}
      {!loading && specials.length > 0 && (
        <SlideRow title="⭐ Deals & Specials">
          {specials.map(sp => {
            const ent = sp.entity || {}
            return (
              <button key={sp.id} className="slide-card special-card" onClick={() => navigate(`/business/${sp.entity_slug}`)}>
                <div className="slide-card-img special-img">
                  <EntityImg url={sp.image_url || ent.hero_image_url} name={sp.title || sp.special_name} />
                  <span className="deal-badge">DEAL</span>
                </div>
                <div className="slide-card-body">
                  <div className="slide-card-name">{sp.title || sp.special_name}</div>
                  <div className="slide-card-venue">{ent.name}</div>
                  {sp.discount_text && <div className="slide-card-discount">{sp.discount_text}</div>}
                </div>
              </button>
            )
          })}
        </SlideRow>
      )}

      {/* Things To Do */}
      {!loading && thingsToDo.length > 0 && (
        <SlideRow title="🌊 Things To Do">
          {thingsToDo.map(b => (
            <button key={b.slug} className="slide-card activity-card" onClick={() => navigate(`/business/${b.slug}`)}>
              <div className="slide-card-img activity-img">
                <EntityImg url={b.hero_image_url} name={b.name} />
                {b.rating && <span className="rating-badge">⭐ {b.rating}</span>}
              </div>
              <div className="slide-card-body">
                <div className="slide-card-name">{b.name}</div>
                {b.city && <div className="slide-card-venue">{b.city}</div>}
              </div>
            </button>
          ))}
        </SlideRow>
      )}

      {/* Empty state */}
      {!loading && !hasContent && (
        <div className="feed-empty">
          <div className="feed-empty-icon">🌅</div>
          <div className="feed-empty-title">Good things are coming</div>
          <div className="feed-empty-sub">Events and specials will show up here as businesses add them</div>
        </div>
      )}

      {/* Social Feed */}
      {!loading && socialPosts.length > 0 && (
        <SlideRow title="📱 From the Gulf Coast">
          {socialPosts.map(post => (
            <button
              key={post.id}
              className="slide-card social-card"
              onClick={() => post.entity_slug
                ? navigate(`/business/${post.entity_slug}`)
                : window.open(post.post_url, '_blank')
              }
            >
              <div className="slide-card-img social-img">
                {post.image_url
                  ? <img src={post.image_url} alt={post.card_entity_name || 'Post'} />
                  : <div className="social-placeholder">
                      <span>{post.source === 'instagram' ? '📸' : '📘'}</span>
                    </div>
                }
                <span className="source-badge">
                  {post.source === 'instagram' ? '📸 IG' : post.source === 'facebook' ? '📘 FB' : '📱'}
                </span>
              </div>
              <div className="slide-card-body">
                <div className="slide-card-name">{post.card_title || post.card_entity_name || 'Gulf Coast'}</div>
                {post.caption && <div className="slide-card-sub">{post.caption.slice(0, 60)}{post.caption.length > 60 ? '…' : ''}</div>}
              </div>
            </button>
          ))}
        </SlideRow>
      )}

      {/* Category grid */}
      <h3 className="section-title" style={{marginTop: 28}}>🗺️ Explore by Category</h3>
      <div className="category-grid">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className="category-card"
            style={{ '--cat-color': cat.color }}
            onClick={() => navigate(`/swipe/${cat.id}`)}
          >
            <span className="cat-emoji">{cat.emoji}</span>
            <div className="cat-label">{cat.label}</div>
            <div className="cat-glow" />
          </button>
        ))}
      </div>

      {/* Build itinerary prompt */}
      {savedPlaces.length >= 3 && (
        <div className="build-banner">
          <div>
            <div className="build-title">Ready to plan your trip?</div>
            <div className="build-sub">You have {savedPlaces.length} places saved</div>
          </div>
          <button className="btn-primary build-btn" onClick={() => navigate('/building')}>
            Build My Itinerary ✨
          </button>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  )
}
