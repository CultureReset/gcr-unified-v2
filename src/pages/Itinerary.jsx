import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, authFetch } from '../context/AppContext'
import './Itinerary.css'

export default function Itinerary() {
  const navigate = useNavigate()
  const { itinerary, tourist, savedPlaces } = useApp()
  const [activeDay, setActiveDay] = useState(0)
  const [doneItems, setDoneItems] = useState([])
  const [emailing, setEmailing] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')

  async function emailItinerary() {
    setEmailing(true); setEmailMsg('')
    try {
      const r = await authFetch('/api/tourist/itinerary/email', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) setEmailMsg(d.error || 'Failed to send')
      else setEmailMsg('Sent to ' + d.sent_to)
    } catch(e) { setEmailMsg('Network error') }
    finally {
      setEmailing(false)
      setTimeout(() => setEmailMsg(''), 4000)
    }
  }

  if (!itinerary) {
    return (
      <div className="itin-empty page safe-top safe-bottom">
        <div style={{fontSize:64}}>🗺️</div>
        <h3>No itinerary yet</h3>
        <p>Save some places and let AI build your trip</p>
        <button className="btn-primary" style={{width:'auto',padding:'14px 32px'}}
          onClick={() => savedPlaces.length >= 3 ? navigate('/building') : navigate('/home')}>
          {savedPlaces.length >= 3 ? 'Build My Trip ✨' : 'Start Swiping →'}
        </button>
      </div>
    )
  }

  const day = itinerary.days[activeDay]

  function toggleDone(key) {
    setDoneItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  return (
    <div className="itin-page page safe-top safe-bottom">
      <div className="itin-header">
        <div>
          <h2>Your {tourist?.destination?.split(',')[0] || 'Gulf Coast'} Trip</h2>
          <p className="itin-sub">
            {tourist?.arrival && `${new Date(tourist.arrival).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
            {tourist?.departure && ` – ${new Date(tourist.departure).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
            {tourist?.group_type && ` · ${tourist.group_type}`}
          </p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="share-btn" onClick={emailItinerary} disabled={emailing} title="Email me this itinerary">
            {emailing ? '…' : '✉️ Email'}
          </button>
        </div>
      </div>
      {emailMsg && (
        <div style={{margin:'8px 16px',padding:'8px 12px',background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.3)',borderRadius:10,color:'#86efac',fontSize:13}}>
          {emailMsg}
        </div>
      )}

      <div className="day-tabs">
        {itinerary.days.map((d, i) => (
          <button
            key={i}
            className={`day-tab ${activeDay === i ? 'active' : ''}`}
            onClick={() => setActiveDay(i)}
          >
            Day {d.day}
          </button>
        ))}
      </div>

      <div className="day-date">{day.date}</div>

      <div className="timeline">
        {day.slots.map((slot, idx) => {
          const key = `${activeDay}-${idx}`
          const isDone = doneItems.includes(key)
          const b = slot.business

          return (
            <div key={key} className={`timeline-item ${isDone ? 'done' : ''}`}>
              <div className="timeline-left">
                <div className="timeline-time">{slot.time}</div>
                <div className="timeline-line" />
              </div>

              <div className="timeline-card" onClick={() => navigate(`/business/${b.slug}`)}>
                <div className="tc-image-wrap">
                  {b.hero_image_url && (
                    <img src={b.hero_image_url} alt={b.name} className="tc-image"
                      onError={e => { e.target.style.display = 'none' }} />
                  )}
                  {isDone && <div className="tc-done-overlay">✓ Done!</div>}
                </div>
                <div className="tc-body">
                  <div className="tc-top">
                    <div>
                      <div className="tc-name">{b.name}</div>
                      {b.subtitle && <div className="tc-sub">{b.subtitle}</div>}
                    </div>
                    {b.rating && <div className="tc-rating">⭐ {b.rating}</div>}
                  </div>

                  {(b.price_range || b.address) && (
                    <div className="tc-meta">
                      {b.price_range && <span>{b.price_range}</span>}
                      {b.price_range && b.address && <span className="dot">·</span>}
                      {b.address && <span>{b.address}</span>}
                    </div>
                  )}

                  {slot.note && <p className="tc-note">{slot.note}</p>}

                  <div className="tc-actions">
                    {b.booking_url ? (
                      <a className="tc-btn-book" href={b.booking_url} target="_blank" rel="noopener noreferrer"
                        onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        📅 Book
                      </a>
                    ) : (
                      <button className="tc-btn-book"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); navigate(`/business/${b.slug}`) }}>
                        View →
                      </button>
                    )}
                    {b.address && (
                      <a className="tc-btn-dir"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                        target="_blank" rel="noopener noreferrer"
                        onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        🗺️ Directions
                      </a>
                    )}
                    <button
                      className={`tc-btn-done ${isDone ? 'is-done' : ''}`}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); toggleDone(key) }}
                    >
                      {isDone ? '✓' : '○'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="itin-footer">
        <button className="btn-outline itin-edit-btn" onClick={() => navigate('/home')}>
          + Add More Places
        </button>
      </div>
    </div>
  )
}
