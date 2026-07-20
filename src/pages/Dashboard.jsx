import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import './Dashboard.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

export default function Dashboard() {
  const { userId } = useApp()
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (!userId) {
      navigate('/auth')
      return
    }

    async function loadBusinesses() {
      try {
        setLoading(true)
        const token = localStorage.getItem('gcr_access_token')
        const res = await fetch(`${API_BASE}/api/dashboard/businesses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data.businesses || []
          setBusinesses(list)
          if (list.length > 0) {
            setSelectedBusiness(list[0])
          }
        }
      } catch (err) {
        console.error('Error loading businesses:', err)
      } finally {
        setLoading(false)
      }
    }
    loadBusinesses()
  }, [userId, navigate])

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>

  if (!selectedBusiness) {
    return (
      <div className="dashboard-empty">
        <h1>Welcome!</h1>
        <p>Create your first business to get started</p>
        <button className="create-btn" onClick={() => navigate('/create-business')}>
          Create Business
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>{selectedBusiness.name}</h1>
        <div className="business-switcher">
          <select
            value={selectedBusiness.id}
            onChange={(e) => {
              const biz = businesses.find(b => b.id === e.target.value)
              if (biz) setSelectedBusiness(biz)
            }}
          >
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="dashboard-sidebar">
        <nav className="dashboard-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>

          {/* Artist Tabs */}
          {selectedBusiness.type === 'artist' && (
            <>
              <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                👤 Profile
              </button>
              <button
                className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveTab('queue')}
              >
                🎵 Live Queue
              </button>
              <button
                className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
              >
                📅 Bookings
              </button>
              <button
                className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`}
                onClick={() => setActiveTab('goals')}
              >
                🎯 Goals & Coops
              </button>
            </>
          )}

          {/* Restaurant Tabs */}
          {selectedBusiness.type === 'restaurant' && (
            <>
              <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                👤 Profile
              </button>
              <button
                className={`nav-item ${activeTab === 'artist' ? 'active' : ''}`}
                onClick={() => setActiveTab('artist')}
              >
                🎸 Set Live Artist
              </button>
              <button
                className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveTab('queue')}
              >
                🎵 Song Requests
              </button>
              <button
                className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`}
                onClick={() => setActiveTab('menu')}
              >
                🍽️ Menu
              </button>
            </>
          )}

          {/* Condo Tabs */}
          {selectedBusiness.type === 'condo' && (
            <>
              <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                🏠 Properties
              </button>
              <button
                className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                📅 Calendar
              </button>
              <button
                className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
              >
                📦 Bookings
              </button>
              <button
                className={`nav-item ${activeTab === 'guests' ? 'active' : ''}`}
                onClick={() => setActiveTab('guests')}
              >
                👥 Guests
              </button>
            </>
          )}

          {/* Service Tabs */}
          {selectedBusiness.type === 'service' && (
            <>
              <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                👤 Profile
              </button>
              <button
                className={`nav-item ${activeTab === 'availability' ? 'active' : ''}`}
                onClick={() => setActiveTab('availability')}
              >
                ⏰ Availability
              </button>
              <button
                className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
              >
                📋 Bookings
              </button>
              <button
                className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => setActiveTab('messages')}
              >
                💬 Messages
              </button>
            </>
          )}

          {/* Common Tabs */}
          <div className="nav-divider" />
          <button
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📈 Analytics
          </button>
          <button
            className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            💬 Messages
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <OverviewSection business={selectedBusiness} />
        )}
        {activeTab === 'profile' && (
          <ProfileSection business={selectedBusiness} />
        )}
        {activeTab === 'queue' && (
          <QueueSection business={selectedBusiness} />
        )}
        {activeTab === 'bookings' && (
          <BookingsSection business={selectedBusiness} />
        )}
        {activeTab === 'calendar' && (
          <CalendarSection business={selectedBusiness} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsSection business={selectedBusiness} />
        )}
        {activeTab === 'messages' && (
          <MessagesSection business={selectedBusiness} />
        )}
        {activeTab === 'settings' && (
          <SettingsSection business={selectedBusiness} />
        )}
      </div>
    </div>
  )
}

// Placeholder sections
function OverviewSection({ business }) {
  return <div className="section"><h2>Overview</h2><p>Welcome to {business.name}</p></div>
}

function ProfileSection({ business }) {
  return <div className="section"><h2>Profile</h2><p>Edit your {business.type} profile</p></div>
}

function QueueSection({ business }) {
  return <div className="section"><h2>Queue / Requests</h2><p>View live requests</p></div>
}

function BookingsSection({ business }) {
  return <div className="section"><h2>Bookings</h2><p>Manage bookings</p></div>
}

function CalendarSection({ business }) {
  const token = localStorage.getItem('gcr_access_token')
  const authHeaders = { Authorization: `Bearer ${token}` }
  const [units, setUnits] = useState([])
  const [feeds, setFeeds] = useState([])
  const [feedUrl, setFeedUrl] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [form, setForm] = useState({ source_label: '', ical_url: '', provider: 'airbnb', resource_id: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [copied, setCopied] = useState(false)

  async function loadAll() {
    try {
      const [u, f, fu] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/units`, { headers: authHeaders }).then(r => (r.ok ? r.json() : [])),
        fetch(`${API_BASE}/api/dashboard/ical/external`, { headers: authHeaders }).then(r => (r.ok ? r.json() : [])),
        fetch(`${API_BASE}/api/dashboard/ical/feed-url`, { headers: authHeaders }).then(r => (r.ok ? r.json() : {})),
      ])
      const ulist = Array.isArray(u) ? u : []
      setUnits(ulist)
      setFeeds(Array.isArray(f) ? f : [])
      setFeedUrl(fu.feed_url || '')
      setSelectedUnit(prev => prev || (ulist[0]?.id ?? ''))
    } catch { /* ignore */ }
  }
  useEffect(() => { loadAll() }, [business?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    if (!form.ical_url) { setMsg('Paste your calendar link first.'); return }
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/ical/external`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_label: form.source_label || form.provider,
          ical_url: form.ical_url,
          provider: form.provider,
          resource_id: form.resource_id || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setForm({ source_label: '', ical_url: '', provider: 'airbnb', resource_id: '' })
      setMsg('Calendar connected — booked dates will sync in shortly.')
      loadAll()
    } catch { setMsg('Could not connect that calendar. Double-check the link.') }
    finally { setBusy(false) }
  }

  const syncNow = async (id) => {
    setBusy(true)
    try { await fetch(`${API_BASE}/api/dashboard/ical/external/${id}/sync-now`, { method: 'POST', headers: authHeaders }); await loadAll() }
    finally { setBusy(false) }
  }
  const removeFeed = async (id) => {
    setBusy(true)
    try { await fetch(`${API_BASE}/api/dashboard/ical/external/${id}`, { method: 'DELETE', headers: authHeaders }); await loadAll() }
    finally { setBusy(false) }
  }
  const copyUrl = () => { navigator.clipboard?.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }

  const unitName = (id) => units.find(u => u.id === id)?.name
  const selUnit = units.find(u => u.id === selectedUnit)

  return (
    <div className="section cal-editor">
      <h2>📅 Calendar &amp; Availability</h2>
      <p className="cal-sub">Connect the calendars you already use — GCR pulls your booked dates in automatically so nothing double-books.</p>

      <div className="cal-card">
        <h3>Connect a calendar</h3>
        <div className="cal-form">
          <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
            <option value="airbnb">Airbnb</option>
            <option value="vrbo">Vrbo</option>
            <option value="track">Track</option>
            <option value="google">Google Calendar</option>
            <option value="other">Other</option>
          </select>
          {units.length > 1 && (
            <select value={form.resource_id} onChange={e => setForm(f => ({ ...f, resource_id: e.target.value }))}>
              <option value="">Whole property</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <input placeholder="Paste your .ics calendar link" value={form.ical_url}
            onChange={e => setForm(f => ({ ...f, ical_url: e.target.value }))} />
          <button className="cal-btn" onClick={connect} disabled={busy}>Connect</button>
        </div>
        {msg && <div className="cal-msg">{msg}</div>}
      </div>

      {feeds.length > 0 && (
        <div className="cal-card">
          <h3>Connected calendars</h3>
          <div className="cal-feeds">
            {feeds.map(fd => (
              <div key={fd.id} className="cal-feed">
                <div className="cal-feed-main">
                  <strong>{fd.source_label || fd.provider || 'Calendar'}</strong>
                  <span className="cal-feed-unit">{fd.resource_id ? (unitName(fd.resource_id) || 'Unit') : 'Whole property'}</span>
                  <span className="cal-feed-status">{fd.last_sync_status || 'not synced yet'}</span>
                </div>
                <div className="cal-feed-actions">
                  <button onClick={() => syncNow(fd.id)} disabled={busy}>Sync now</button>
                  <button className="danger" onClick={() => removeFeed(fd.id)} disabled={busy}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedUrl && (
        <div className="cal-card">
          <h3>Share your GCR calendar</h3>
          <p className="cal-sub">Paste this into Airbnb/Vrbo’s “import calendar” so GCR bookings block those platforms too.</p>
          <div className="cal-url-row">
            <input readOnly value={feedUrl} onFocus={e => e.target.select()} />
            <button className="cal-btn" onClick={copyUrl}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>
      )}

      <div className="cal-card">
        <div className="cal-cal-head">
          <h3>Availability</h3>
          {units.length > 1 && (
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
        {selUnit
          ? <AvailabilityCalendar key={selUnit.id} resourceId={selUnit.id} mode="view" />
          : <p className="cal-sub">No bookable units found for this listing yet.</p>}
      </div>
    </div>
  )
}

function AnalyticsSection({ business }) {
  return <div className="section"><h2>Analytics</h2><p>View metrics</p></div>
}

function MessagesSection({ business }) {
  return <div className="section"><h2>Messages</h2><p>Chat with guests/customers</p></div>
}

function SettingsSection({ business }) {
  return <div className="section"><h2>Settings</h2><p>Configure your business</p></div>
}
