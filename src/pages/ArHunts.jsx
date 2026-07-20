import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageHeader from '../components/PageHeader'
import Toast from '../components/Toast'
import { SkeletonGrid } from '../components/SkeletonLoader'
import { calculateDistance } from '../services/locationService'
import { API_BASE } from '../config'
import ArCameraOverlay from '../components/ArCameraOverlay'
import './ArHunts.css'

const METERS_PER_MILE = 1609.344
// Fallback only — the real value is per-hunt (hunt.captureRadiusMeters, admin-settable),
// this just covers hunts loaded before that field existed or from a stale cache.
const DEFAULT_CAPTURE_RADIUS_MILES = 35 / METERS_PER_MILE
function captureRadiusMilesFor(hunt) {
  return hunt.captureRadiusMeters != null ? hunt.captureRadiusMeters / METERS_PER_MILE : DEFAULT_CAPTURE_RADIUS_MILES
}
const DIFFICULTY_META = {
  easy:   { label: 'Easy',   color: '#22c55e' },
  medium: { label: 'Medium', color: '#f59e0b' },
  hard:   { label: 'Hard',   color: '#ef4444' },
}

export default function ArHunts() {
  const navigate = useNavigate()
  const { userId } = useApp()

  const [permissionState, setPermissionState] = useState('idle') // idle | requesting | granted | denied
  const [userLocation, setUserLocation] = useState(null)
  const [hunts, setHunts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [capturingId, setCapturingId] = useState(null)
  const [capturedIds, setCapturedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('gcr_ar_captured') || '[]')) }
    catch { return new Set() }
  })
  const [rewardModal, setRewardModal] = useState(null) // { brandName, rewardCode } | null
  const [arViewHuntId, setArViewHuntId] = useState(null)

  const watchIdRef = useRef(null)

  const persistCaptured = useCallback((ids) => {
    localStorage.setItem('gcr_ar_captured', JSON.stringify([...ids]))
  }, [])

  const loadNearbyHunts = useCallback(async (lat, lng) => {
    setLoading(true)
    setError(null)
    try {
      const radiusMeters = 8000 // ~5 miles — show everything reachable, sorted by distance
      const res = await fetch(`${API_BASE}/api/ar-hunts/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`)
      if (!res.ok) throw new Error('Could not load hunts')
      const data = await res.json()
      setHunts(data || [])
    } catch (e) {
      setError(e.message || 'Failed to load hunts')
    } finally {
      setLoading(false)
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setPermissionState('denied')
      setError('Location is not supported on this device.')
      return
    }
    setPermissionState('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setPermissionState('granted')
        loadNearbyHunts(loc.lat, loc.lng)

        // Keep location fresh while the page is open so distances/capture stay accurate
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
        )
      },
      () => {
        setPermissionState('denied')
        setError('Location access was denied. Enable location to find hunts near you.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [loadNearbyHunts])

  useEffect(() => {
    requestLocation()
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [requestLocation])

  const distanceToHunt = (hunt) => {
    if (!userLocation) return null
    return calculateDistance(userLocation.lat, userLocation.lng, hunt.latitude, hunt.longitude)
  }

  const handleCapture = async (hunt) => {
    if (!userLocation) return
    const dist = distanceToHunt(hunt)
    if (dist == null || dist > captureRadiusMilesFor(hunt)) {
      setToast({ message: "You're not close enough yet — keep walking toward the hint!", type: 'error' })
      return
    }
    setCapturingId(hunt.id)
    try {
      const res = await fetch(`${API_BASE}/api/ar-hunts/${hunt.id}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId || null, lat: userLocation.lat, lng: userLocation.lng }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Capture failed')

      const next = new Set(capturedIds)
      next.add(hunt.id)
      setCapturedIds(next)
      persistCaptured(next)
      setRewardModal({ brandName: hunt.brandName, rewardCode: data.reward_code, reward: hunt.reward })
    } catch (e) {
      setToast({ message: e.message || 'Could not capture this item', type: 'error' })
    } finally {
      setCapturingId(null)
    }
  }

  const sortedHunts = [...hunts].sort((a, b) => (distanceToHunt(a) ?? 999) - (distanceToHunt(b) ?? 999))

  return (
    <div className="ar-hunts-page">
      <PageHeader title="🎯 AR Scavenger Hunt" subtitle="Find sponsor items hidden around the Gulf Coast" />

      <div className="ar-hunts-content">
        {permissionState === 'idle' || permissionState === 'requesting' ? (
          <div className="ar-permission-card">
            <div className="ar-permission-icon">📍</div>
            <h2>Turn On Location</h2>
            <p>We need your location to show hunts near you and let you capture items when you arrive.</p>
            <button className="ar-btn-primary" onClick={requestLocation} disabled={permissionState === 'requesting'}>
              {permissionState === 'requesting' ? 'Requesting…' : 'Enable Location'}
            </button>
          </div>
        ) : permissionState === 'denied' ? (
          <div className="ar-permission-card">
            <div className="ar-permission-icon">🚫</div>
            <h2>Location Needed</h2>
            <p>{error || 'Please enable location access in your browser settings to play.'}</p>
            <button className="ar-btn-primary" onClick={requestLocation}>Try Again</button>
          </div>
        ) : loading ? (
          <SkeletonGrid count={4} />
        ) : error ? (
          <div className="ar-permission-card">
            <p>{error}</p>
            <button className="ar-btn-primary" onClick={() => userLocation && loadNearbyHunts(userLocation.lat, userLocation.lng)}>Retry</button>
          </div>
        ) : sortedHunts.length === 0 ? (
          <div className="ar-permission-card">
            <div className="ar-permission-icon">🗺️</div>
            <h2>No Hunts Nearby</h2>
            <p>There aren't any active hunts within range right now. Check back soon!</p>
          </div>
        ) : (
          <div className="ar-hunt-grid">
            {sortedHunts.map((hunt) => {
              const dist = distanceToHunt(hunt)
              const captured = capturedIds.has(hunt.id)
              const inRange = dist != null && dist <= captureRadiusMilesFor(hunt)
              const meta = DIFFICULTY_META[hunt.difficulty] || DIFFICULTY_META.medium
              const unavailableReason = hunt.soldOut ? 'All rewards claimed'
                : hunt.notStarted ? 'Coming soon'
                : hunt.ended ? 'Hunt ended'
                : null

              return (
                <div key={hunt.id} className={`ar-hunt-card ${captured ? 'is-captured' : ''}`}>
                  <div className="ar-hunt-card-top">
                    {hunt.imageData ? (
                      <img src={hunt.imageData} alt={hunt.brandName} className="ar-hunt-brand-img" />
                    ) : (
                      <div className="ar-hunt-brand-img ar-hunt-brand-placeholder">🎯</div>
                    )}
                    <span className="ar-hunt-difficulty" style={{ background: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="ar-hunt-card-body">
                    <h3>{hunt.brandName}</h3>
                    {hunt.hint && <p className="ar-hunt-hint">💡 {hunt.hint}</p>}
                    <div className="ar-hunt-meta-row">
                      <span>⭐ {hunt.points} pts</span>
                      {dist != null && <span>{dist < 0.1 ? `${Math.round(dist * 5280)} ft` : `${dist.toFixed(1)} mi`} away</span>}
                    </div>
                    {captured ? (
                      <div className="ar-hunt-captured-badge">✓ Captured</div>
                    ) : unavailableReason ? (
                      <div className="ar-hunt-unavailable-badge">{unavailableReason}</div>
                    ) : (
                      <div className="ar-hunt-actions">
                        <button className="ar-btn-ar-view" onClick={() => setArViewHuntId(hunt.id)}>
                          🎥 AR View
                        </button>
                        <button
                          className={`ar-btn-capture ${inRange ? 'is-ready' : ''}`}
                          disabled={!inRange || capturingId === hunt.id}
                          onClick={() => handleCapture(hunt)}
                        >
                          {capturingId === hunt.id ? 'Capturing…' : inRange ? '🎯 Capture Now!' : 'Get Closer'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {arViewHuntId && (() => {
        const hunt = hunts.find((h) => h.id === arViewHuntId)
        if (!hunt) return null
        return (
          <ArCameraOverlay
            hunt={hunt}
            userLocation={userLocation}
            captureRadiusMiles={captureRadiusMilesFor(hunt)}
            captured={capturedIds.has(hunt.id)}
            capturing={capturingId === hunt.id}
            onCapture={() => handleCapture(hunt)}
            onClose={() => setArViewHuntId(null)}
          />
        )
      })()}

      {rewardModal && (
        <div className="ar-reward-overlay" onClick={() => setRewardModal(null)}>
          <div className="ar-reward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ar-reward-icon">🎉</div>
            <h2>You found it!</h2>
            <p className="ar-reward-brand">{rewardModal.brandName}</p>
            {rewardModal.reward && <p className="ar-reward-desc">{rewardModal.reward}</p>}
            {rewardModal.rewardCode && (
              <div className="ar-reward-code">
                <span>Your code</span>
                <strong>{rewardModal.rewardCode}</strong>
              </div>
            )}
            <button className="ar-btn-primary" onClick={() => setRewardModal(null)}>Keep Hunting</button>
          </div>
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  )
}
