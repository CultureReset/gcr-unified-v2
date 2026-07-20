import { useEffect, useRef, useState, useCallback } from 'react'
import { calculateDistance } from '../services/locationService'
import { bearingTo, relativeBearing, headingFromOrientationEvent } from '../services/compassService'
import './ArCameraOverlay.css'

// Assumed horizontal field of view for a rear phone camera. Real FOV varies
// by device/lens, but this is a reasonable average for the "does the marker
// look roughly where the thing should be" experience we're going for here —
// this isn't true 3D-anchored AR, just a heading-driven overlay.
const ASSUMED_FOV_DEGREES = 65
const NO_COMPASS_TIMEOUT_MS = 2500

export default function ArCameraOverlay({ hunt, userLocation, captureRadiusMiles, captured, capturing, onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const noCompassTimerRef = useRef(null)

  const [permissionState, setPermissionState] = useState('idle') // idle | requesting | granted | denied
  const [permissionError, setPermissionError] = useState(null)
  const [heading, setHeading] = useState(null)
  const [compassAvailable, setCompassAvailable] = useState(true)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const handleOrientation = useCallback((event) => {
    const h = headingFromOrientationEvent(event)
    if (h != null) {
      setHeading(h)
      setCompassAvailable(true)
      if (noCompassTimerRef.current) {
        clearTimeout(noCompassTimerRef.current)
        noCompassTimerRef.current = null
      }
    }
  }, [])

  const start = useCallback(async () => {
    setPermissionState('requesting')
    setPermissionError(null)
    try {
      // iOS 13+ requires this to be called directly inside a user-gesture
      // handler (the "Start AR" tap) — no awaited work before it, or the
      // browser silently treats it as not user-initiated and denies it.
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result !== 'granted') {
          setPermissionState('denied')
          setPermissionError('Compass access was denied — you can still capture using distance alone.')
          setCompassAvailable(false)
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      // Don't attach to videoRef here — the <video> element only mounts once
      // permissionState becomes 'granted' below, so videoRef.current is still
      // null at this point. A separate effect attaches it once it exists.

      // Prefer deviceorientationabsolute (true compass heading, no permission
      // prompt needed on Android/Chrome); fall back to deviceorientation,
      // which iOS Safari fires with webkitCompassHeading already attached.
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', handleOrientation)
      } else {
        window.addEventListener('deviceorientation', handleOrientation)
      }
      // If no heading-bearing event arrives in time, this device/browser
      // doesn't expose a usable compass — degrade to a centered marker
      // driven by distance alone rather than leaving it stuck loading.
      noCompassTimerRef.current = setTimeout(() => setCompassAvailable(false), NO_COMPASS_TIMEOUT_MS)

      setPermissionState('granted')
    } catch (err) {
      setPermissionState('denied')
      setPermissionError(err.message || 'Camera access was denied.')
    }
  }, [handleOrientation])

  // The <video> element only exists once permissionState is 'granted', so the
  // stream is attached here (once the ref is actually live) rather than
  // inline in start(), where videoRef.current would still be null.
  useEffect(() => {
    if (permissionState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [permissionState])

  useEffect(() => {
    return () => {
      stopCamera()
      window.removeEventListener('deviceorientationabsolute', handleOrientation)
      window.removeEventListener('deviceorientation', handleOrientation)
      if (noCompassTimerRef.current) clearTimeout(noCompassTimerRef.current)
    }
  }, [stopCamera, handleOrientation])

  // Auto-close back to the card grid once this hunt is actually captured —
  // the reward modal lives in the parent (ArHunts.jsx) and takes over from here.
  useEffect(() => {
    if (captured) onClose()
  }, [captured, onClose])

  const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, hunt.latitude, hunt.longitude) : null
  const inRange = distance != null && distance <= captureRadiusMiles

  let markerStyle = null
  let offScreenSide = null
  if (userLocation) {
    const targetBearing = bearingTo(userLocation.lat, userLocation.lng, hunt.latitude, hunt.longitude)
    if (compassAvailable && heading != null) {
      const rel = relativeBearing(heading, targetBearing)
      if (Math.abs(rel) <= ASSUMED_FOV_DEGREES / 2) {
        const xPercent = 50 + (rel / (ASSUMED_FOV_DEGREES / 2)) * 50
        // Closer = bigger. Scale from ~40px (far) up to ~140px (at capture range).
        const closeness = distance != null ? Math.max(0, 1 - Math.min(distance, 0.3) / 0.3) : 0
        const size = 40 + closeness * 100
        markerStyle = { left: `${xPercent}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }
      } else {
        offScreenSide = rel < 0 ? 'left' : 'right'
      }
    } else {
      // No compass reading yet/available — keep the marker centered so the
      // player can still see and capture it, just without directional help.
      const closeness = distance != null ? Math.max(0, 1 - Math.min(distance, 0.3) / 0.3) : 0
      const size = 40 + closeness * 100
      markerStyle = { left: '50%', width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }
    }
  }

  return (
    <div className="ar-cam-overlay">
      {permissionState === 'idle' && (
        <div className="ar-cam-prompt">
          <div className="ar-cam-prompt-icon">🎥</div>
          <h2>Point your camera around</h2>
          <p>We'll show {hunt.brandName} on your screen as you get close. Needs camera and compass access.</p>
          <button className="ar-btn-primary" onClick={start}>Start AR</button>
          <button className="ar-cam-cancel" onClick={onClose}>Cancel</button>
        </div>
      )}

      {permissionState === 'requesting' && (
        <div className="ar-cam-prompt">
          <p>Requesting access…</p>
        </div>
      )}

      {permissionState === 'denied' && (
        <div className="ar-cam-prompt">
          <div className="ar-cam-prompt-icon">🚫</div>
          <h2>Camera Needed</h2>
          <p>{permissionError || 'Enable camera access in your browser settings to use AR view.'}</p>
          <button className="ar-btn-primary" onClick={start}>Try Again</button>
          <button className="ar-cam-cancel" onClick={onClose}>Use Card View Instead</button>
        </div>
      )}

      {permissionState === 'granted' && (
        <>
          <video ref={videoRef} className="ar-cam-video" autoPlay playsInline muted />

          <button className="ar-cam-close" onClick={onClose} aria-label="Close AR view">✕</button>

          {!compassAvailable && (
            <div className="ar-cam-no-compass-hint">No compass detected — move around, it'll still capture by distance.</div>
          )}

          {markerStyle && (
            <div className={`ar-cam-marker ${inRange ? 'is-ready' : ''}`} style={markerStyle}>
              {hunt.imageData ? <img src={hunt.imageData} alt={hunt.brandName} /> : <span>🎯</span>}
            </div>
          )}

          {offScreenSide && (
            <div className={`ar-cam-edge-hint ar-cam-edge-${offScreenSide}`}>
              <span>{offScreenSide === 'left' ? '◀' : '▶'}</span>
            </div>
          )}

          <div className="ar-cam-hud">
            <div className="ar-cam-hud-brand">{hunt.brandName}</div>
            <div className="ar-cam-hud-distance">
              {distance != null ? (distance < 0.1 ? `${Math.round(distance * 5280)} ft away` : `${distance.toFixed(1)} mi away`) : '…'}
            </div>
            <button
              className={`ar-btn-capture ar-cam-capture-btn ${inRange ? 'is-ready' : ''}`}
              disabled={!inRange || capturing}
              onClick={onCapture}
            >
              {capturing ? 'Capturing…' : inRange ? '🎯 Capture Now!' : 'Get Closer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
