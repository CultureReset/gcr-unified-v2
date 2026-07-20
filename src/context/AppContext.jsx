import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { API_BASE as API } from '../config'
import * as locationService from '../services/locationService'

const AppContext = createContext(null)

function loadLS(k, fallback) {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)) } catch { return fallback }
}

function getToken() { return localStorage.getItem('gcr_access_token') || '' }

// A signed-out visitor still gets an identity: a random id minted once and
// kept in localStorage, sent as X-Guest-Id on every request that doesn't
// have a real login token. None of the tourist_swipe_events/tourist_seen/
// tourist_saves/user_preference_scores tables have a foreign key back to a
// real account, so the backend can safely record activity under this id
// from a visitor's very first swipe — and merge it into their real account
// the moment they sign up (see anonymousVisitorId() below, sent alongside
// signup/signin so the backend can find and reassign it).
export function anonymousVisitorId() {
  let id = localStorage.getItem('gcr_guest_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('gcr_guest_id', id)
  }
  return id
}

function authHeaders() {
  const t = getToken()
  if (t) return { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' }
  return { 'X-Guest-Id': anonymousVisitorId(), 'Content-Type': 'application/json' }
}

async function apiGet(path) {
  const r = await fetch(API + path, { headers: authHeaders() })
  if (r.status === 401) { handleUnauthorized(); return null }
  if (!r.ok) return null
  return await r.json()
}
async function apiSend(method, path, body) {
  const r = await fetch(API + path, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined })
  if (r.status === 401) { handleUnauthorized(); return null }
  if (!r.ok) return null
  return await r.json()
}
function clearSession() {
  ['gcr_access_token','gcr_refresh_token','gcr_expires_at','gcr_user_id','gcr_user_email'].forEach(k => localStorage.removeItem(k))
}
function handleUnauthorized() {
  clearSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gcr:unauthorized'))
  }
}

export async function authFetch(path, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const url = path.startsWith('http') ? path : API + path
  const r = await fetch(url, { ...options, headers })
  if (r.status === 401) handleUnauthorized()
  return r
}

function toSaveRow(r) {
  return {
    id: r.entity_id || r.entity_slug,
    slug: r.entity_slug,
    name: r.business_name,
    hero_image_url: r.hero_image_url,
    subtitle: r.subtitle,
    category: r.category,
    rating: r.rating,
    price_range: r.price_range,
    is_super_like: !!r.is_super_like,
    _saveId: r.id,
  }
}

export function AppProvider({ children }) {
  const [tourist, setTourist] = useState(() => loadLS('gcr_tourist', null))
  const [savedPlaces, setSavedPlaces] = useState(() => loadLS('gcr_saved', []))
  const [superLikedPlaces, setSuperLikedPlaces] = useState(() => loadLS('gcr_super', []))
  const [itinerary, setItinerary] = useState(() => loadLS('gcr_itinerary', null))
  const [userId, setUserId] = useState(() => localStorage.getItem('gcr_user_id') || null)
  const [seenSlugs, setSeenSlugs] = useState(() => loadLS('gcr_seen', []))
  const [userLocation, setUserLocation] = useState(() => loadLS('gcr_location', null))
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(() => loadLS('gcr_location_sharing', false))

  const seenQueue = useRef([])
  const swipeQueue = useRef([])   // { slug, direction, business_name, category }
  const flushTimer = useRef(null)
  const swipeFlushTimer = useRef(null)

  useEffect(() => {
    if (!getToken()) return
    hydrateFromApi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Accept auth token passed from GCR parent page when embedded in iframe
  useEffect(() => {
    function onMessage(e) {
      if (e.data?.type === 'gcr-auth' && e.data.token) {
        localStorage.setItem('gcr_access_token', e.data.token)
        hydrateFromApi()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Flush pending swipes/seen before page unload to prevent data loss
  useEffect(() => {
    function beforeUnload() {
      flushSeen()
      flushSwipes()
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', beforeUnload)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('pagehide', beforeUnload)
    }
  }, [])

  async function hydrateFromApi() {
    try {
      const d = await apiGet('/api/tourist/me')
      if (!d) {
        setUserId(null)
        setSavedPlaces([])
        setSuperLikedPlaces([])
        return null
      }
      setUserId(d.user?.id || null)

      const saves = Array.isArray(d.saves) ? d.saves.map(toSaveRow) : []
      const supers = saves.filter(s => s.is_super_like)

      setSavedPlaces(saves)
      localStorage.setItem('gcr_saved', JSON.stringify(saves))

      setSuperLikedPlaces(supers)
      localStorage.setItem('gcr_super', JSON.stringify(supers))

      if (d.itinerary && d.itinerary.days) {
        const it = { days: d.itinerary.days, destination: d.itinerary.destination, _id: d.itinerary.id }
        setItinerary(it)
        localStorage.setItem('gcr_itinerary', JSON.stringify(it))
      }

      if (d.profile) {
        const t = { ...d.profile, email: d.user?.email, setupComplete: !!d.profile.setup_complete }
        setTourist(t)
        localStorage.setItem('gcr_tourist', JSON.stringify(t))
        return t
      } else if (d.user?.email) {
        const t = { email: d.user.email, verified: true }
        setTourist(t)
        localStorage.setItem('gcr_tourist', JSON.stringify(t))
        return t
      }
      return null
    } catch (e) {
      console.error('Failed to hydrate from API:', e)
      setSavedPlaces([])
      setSuperLikedPlaces([])
      return null
    }
  }

  // Upload any saves/super-likes made while browsing as a guest so signing up
  // doesn't wipe them. Guest actions only ever touch localStorage (there's no
  // userId yet to persist against) — without this, the first hydrateFromApi()
  // after login would overwrite that local state with the new account's
  // (empty) server list and the guest's session would just be gone.
  // `preLoginSaves` must be captured BEFORE hydrateFromApi() runs, since that
  // call immediately overwrites localStorage['gcr_saved'] with the server's
  // list — by the time this function runs there's no other way to recover
  // what the guest had.
  async function migrateGuestSaves(preLoginSaves) {
    if (!preLoginSaves.length) return
    const serverSlugs = new Set(loadLS('gcr_saved', []).map(s => s.slug))
    const missing = preLoginSaves.filter(b => b.slug && !serverSlugs.has(b.slug))
    if (!missing.length) return
    for (const b of missing) {
      await apiSend('POST', '/api/tourist/saves', {
        entity_slug: b.slug,
        entity_id: b.id && /^[0-9a-f-]{36}$/i.test(String(b.id)) ? b.id : null,
        business_name: b.name,
        hero_image_url: b.hero_image_url,
        subtitle: b.subtitle,
        category: b.category,
        rating: b.rating ?? null,
        price_range: b.price_range,
        is_super_like: !!b.is_super_like,
      })
    }
    await hydrateFromApi()
  }

  async function setSessionFromLogin(loginData) {
    setUserId(loginData.user?.id || null)
    const preLoginSaves = loadLS('gcr_saved', [])
    const hydrated = await hydrateFromApi()
    await migrateGuestSaves(preLoginSaves)
    return hydrated
  }

  // Record a swipe: marks slug as seen + queues direction event for analytics
  function recordSwipe(business, direction) {
    const slug = typeof business === 'string' ? business : business?.slug
    if (!slug) return

    // Sponsored cards have fake slugs — don't add to seenSlugs so they can reappear
    if (!business?._isSponsored && !business?._isDeal) {
      setSeenSlugs(prev => {
        if (prev.includes(slug)) return prev
        const updated = [...prev, slug]
        localStorage.setItem('gcr_seen', JSON.stringify(updated))
        return updated
      })

      seenQueue.current = [...new Set([...seenQueue.current, slug])]
      if (seenQueue.current.length >= 10) {
        flushSeen()
      } else {
        clearTimeout(flushTimer.current)
        flushTimer.current = setTimeout(flushSeen, 5000)
      }
    }

    // Queue swipe direction event (skip promo cards; use real slug for sponsored)
    if (direction && typeof business === 'object' && !business._isPromo) {
      swipeQueue.current.push({
        slug: business._sponsorSlug || business.slug,
        direction,
        business_name: business.name || null,
        category: business.category || null,
      })
      if (swipeQueue.current.length >= 10) {
        flushSwipes()
      } else {
        clearTimeout(swipeFlushTimer.current)
        swipeFlushTimer.current = setTimeout(flushSwipes, 5000)
      }
    }
  }

  // Best-effort undo: if the swipe hasn't been flushed to the server yet,
  // pull it back out of the queue so an undone action doesn't still count
  // toward preference scoring. If it already flushed (the 5s/10-event
  // window passed), there's nothing left to retract — a rare, low-impact
  // edge case since undo is almost always pressed right after the swipe.
  function retractLastSwipe(slug) {
    const idx = swipeQueue.current.map(e => e.slug).lastIndexOf(slug)
    if (idx !== -1) swipeQueue.current.splice(idx, 1)
  }

  async function flushSeen() {
    const toFlush = seenQueue.current
    if (!toFlush.length) return
    seenQueue.current = []
    await apiSend('POST', '/api/tourist/seen', { slugs: toFlush })
  }

  async function flushSwipes() {
    const toFlush = swipeQueue.current
    if (!toFlush.length) return
    swipeQueue.current = []
    await apiSend('POST', '/api/tourist/swipes', { events: toFlush })
  }

  async function resetSeenSlugs() {
    setSeenSlugs([])
    seenQueue.current = []
    localStorage.removeItem('gcr_seen')
    await apiSend('DELETE', '/api/tourist/seen')
  }

  async function saveTourist(data) {
    const merged = { ...tourist, ...data }
    setTourist(merged)
    localStorage.setItem('gcr_tourist', JSON.stringify(merged))
    if (!userId) return
    await apiSend('PUT', '/api/tourist/profile', {
      name: merged.name || null,
      destination: merged.destination || null,
      arrival: merged.arrival || null,
      departure: merged.departure || null,
      trip_days: merged.trip_days || null,
      group_type: merged.group_type || null,
      budget: merged.budget || null,
      interests: merged.interests || [],
      stay_status: merged.stay_status || null,
      hotel_name: merged.hotel_name || null,
      setup_complete: !!merged.setupComplete,
    })
  }

  async function addSavedPlace(business) {
    setSavedPlaces(prev => {
      if (prev.find(p => p.id === business.id || p.slug === business.slug)) return prev
      const updated = [...prev, business]
      localStorage.setItem('gcr_saved', JSON.stringify(updated))
      return updated
    })
    // tourist_saves.user_id has a real FK to auth.users — saves only
    // persist server-side once signed in; guests keep this local-only
    // until they sign up (matches existing device-local behavior).
    if (!userId) return
    await apiSend('POST', '/api/tourist/saves', {
      entity_slug: business.slug,
      entity_id: business.id && /^[0-9a-f-]{36}$/i.test(String(business.id)) ? business.id : null,
      business_name: business.name,
      hero_image_url: business.hero_image_url,
      subtitle: business.subtitle,
      category: business.category,
      rating: business.rating ?? null,
      price_range: business.price_range,
      is_super_like: !!business._isSuper,
    })
  }

  async function addSuperLike(business) {
    const enriched = { ...business, is_super_like: true, _isSuper: true }

    // Add to both lists
    setSuperLikedPlaces(prev => {
      if (prev.find(p => p.id === enriched.id || p.slug === enriched.slug)) return prev
      const updated = [...prev, enriched]
      localStorage.setItem('gcr_super', JSON.stringify(updated))
      return updated
    })
    setSavedPlaces(prev => {
      const existing = prev.find(p => p.id === enriched.id || p.slug === enriched.slug)
      const updated = existing
        ? prev.map(p => (p.id === enriched.id || p.slug === enriched.slug) ? { ...p, is_super_like: true } : p)
        : [...prev, enriched]
      localStorage.setItem('gcr_saved', JSON.stringify(updated))
      return updated
    })

    if (!userId) return
    await apiSend('POST', '/api/tourist/saves', {
      entity_slug: business.slug,
      entity_id: business.id && /^[0-9a-f-]{36}$/i.test(String(business.id)) ? business.id : null,
      business_name: business.name,
      hero_image_url: business.hero_image_url,
      subtitle: business.subtitle,
      category: business.category,
      rating: business.rating ?? null,
      price_range: business.price_range,
      is_super_like: true,
    })
  }

  async function removeSuperLike(id) {
    const target = superLikedPlaces.find(p => p.id === id)
    setSuperLikedPlaces(prev => {
      const updated = prev.filter(p => p.id !== id)
      localStorage.setItem('gcr_super', JSON.stringify(updated))
      return updated
    })
    // Un-flag in saves list (keep the save, just remove the Must Do flag)
    setSavedPlaces(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, is_super_like: false } : p)
      localStorage.setItem('gcr_saved', JSON.stringify(updated))
      return updated
    })
    if (!userId || !target?.slug) return
    await apiSend('DELETE', '/api/tourist/super-likes/' + encodeURIComponent(target.slug))
  }

  async function removeSavedPlace(id) {
    const target = savedPlaces.find(p => p.id === id)
    setSavedPlaces(prev => {
      const updated = prev.filter(p => p.id !== id)
      localStorage.setItem('gcr_saved', JSON.stringify(updated))
      return updated
    })
    setSuperLikedPlaces(prev => {
      const updated = prev.filter(p => p.id !== id)
      localStorage.setItem('gcr_super', JSON.stringify(updated))
      return updated
    })
    if (!userId || !target?.slug) return
    await apiSend('DELETE', '/api/tourist/saves/' + encodeURIComponent(target.slug))
  }

  async function saveItinerary(data) {
    setItinerary(data)
    localStorage.setItem('gcr_itinerary', JSON.stringify(data))
    if (!userId) return
    const d = await apiSend('PUT', '/api/tourist/itinerary', {
      destination: data.destination || null,
      days: data.days || [],
      model_used: data.model_used || null,
    })
    if (d?.itinerary?.id) {
      const updated = { ...data, _id: d.itinerary.id }
      setItinerary(updated)
      localStorage.setItem('gcr_itinerary', JSON.stringify(updated))
    }
  }

  async function requestLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' }
          setUserLocation(loc)
          localStorage.setItem('gcr_location', JSON.stringify(loc))
          resolve(loc)
        },
        () => resolve(null),
        { timeout: 8000, maximumAge: 300000 }
      )
    })
  }

  async function enableLocationSharing(settings = {}) {
    const token = getToken()
    if (!token) return false

    try {
      const result = await locationService.enableLocationSharing(token, settings)
      if (result) {
        setLocationSharingEnabled(true)
        localStorage.setItem('gcr_location_sharing', JSON.stringify(true))
        // Start background tracking
        locationService.startLocationTracking(token)
        return true
      }
      return false
    } catch (e) {
      console.error('Error enabling location sharing:', e)
      return false
    }
  }

  async function disableLocationSharing() {
    const token = getToken()
    if (!token) return false

    try {
      const result = await locationService.disableLocationSharing(token)
      setLocationSharingEnabled(false)
      localStorage.setItem('gcr_location_sharing', JSON.stringify(false))
      return result
    } catch (e) {
      console.error('Error disabling location sharing:', e)
      return false
    }
  }

  // Geocode hotel name or destination to get lat/lng as fallback
  async function geocodeStay(query) {
    if (!query) return null
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const d = await r.json()
      if (!d[0]) return null
      const loc = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), source: 'hotel' }
      setUserLocation(loc)
      localStorage.setItem('gcr_location', JSON.stringify(loc))
      return loc
    } catch { return null }
  }

  function logout() {
    flushSeen()
    flushSwipes()
    locationService.stopLocationTracking()
    clearSession()
    localStorage.removeItem('gcr_tourist')
    localStorage.removeItem('gcr_saved')
    localStorage.removeItem('gcr_super')
    localStorage.removeItem('gcr_itinerary')
    localStorage.removeItem('gcr_seen')
    localStorage.removeItem('gcr_location_sharing')
    setTourist(null)
    setSavedPlaces([])
    setSuperLikedPlaces([])
    setItinerary(null)
    setUserId(null)
    setSeenSlugs([])
    setLocationSharingEnabled(false)
    seenQueue.current = []
    swipeQueue.current = []
  }

  return (
    <AppContext.Provider value={{
      tourist, saveTourist,
      savedPlaces, addSavedPlace, removeSavedPlace,
      superLikedPlaces, addSuperLike, removeSuperLike,
      itinerary, saveItinerary,
      seenSlugs, recordSwipe, retractLastSwipe, resetSeenSlugs, setSeenSlugs,
      userLocation, requestLocation, geocodeStay,
      locationSharingEnabled, enableLocationSharing, disableLocationSharing,
      userId, logout,
      setSessionFromLogin, refreshSaves: hydrateFromApi,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
