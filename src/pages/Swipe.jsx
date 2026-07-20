import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TinderCard from 'react-tinder-card'
import { useApp } from '../context/AppContext'
import { CATEGORIES } from '../data/categories'
import { TAG_EMOJI } from '../components/GCRCard'
import { fetchBusinesses, calcDistance, formatDistance, fetchPreferences, personalizeAndSort, searchProperties, fetchHomeFeed } from '../services/gcrApi'
import { API_BASE, SMS_NUMBER } from '../config'
import './Swipe.css'

function formatEventTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

// Live music/concerts, events tonight, happy hours right now, and daily
// specials — same source the Home page's slide rows use (fetchHomeFeed),
// reshaped into swipeable cards. Synthetic id/slug, same convention as the
// promo/deal cards above: resolveReal() doesn't remap these, so swiping
// right saves the card object itself, matching existing precedent.
async function fetchFeedCards() {
  try {
    const feed = await fetchHomeFeed()
    const cards = []

    // 🎸 Live music / concerts — artist photo, name, venue, set time
    const musicEventIds = new Set()
    ;(feed.liveMusic || []).slice(0, 8).forEach(ev => {
      musicEventIds.add(ev.id)
      const ent = ev.entity || {}
      cards.push({
        id: 'music-' + ev.id,
        slug: 'music-' + ev.id,
        _isEvent: true,
        _eventKind: 'music',
        _artistSlug: ev.artist?.slug || null,
        entity_slug: ev.entity_slug,
        name: ev.artist_name || ev.event_name,
        hero_image_url: ev.artist?.image_url || ev.image_url || ent.hero_image_url || null,
        photos: [],
        city: ent.city || '',
        category: 'all',
        _venueName: ent.name || '',
        _timeLabel: ev.start_time ? formatEventTime(ev.start_time) : '',
      })
    })

    // 🎉 Events tonight (skip ones already shown above as live music)
    ;(feed.events || []).filter(ev => !musicEventIds.has(ev.id)).slice(0, 8).forEach(ev => {
      const ent = ev.entity || {}
      cards.push({
        id: 'event-' + ev.id,
        slug: 'event-' + ev.id,
        _isEvent: true,
        _eventKind: 'event',
        entity_slug: ev.entity_slug,
        name: ev.event_name,
        hero_image_url: ev.image_url || ent.hero_image_url || null,
        photos: [],
        city: ent.city || '',
        category: 'all',
        _venueName: ent.name || '',
        _timeLabel: ev.start_time ? formatEventTime(ev.start_time) : '',
        _coverCharge: ev.cover_charge,
      })
    })

    // 🍺 Happy hours active right now
    ;(feed.happyHours || []).slice(0, 8).forEach(b => {
      cards.push({
        id: 'hh-' + b.id,
        slug: 'hh-' + b.id,
        _isEvent: true,
        _eventKind: 'happyhour',
        entity_slug: b.slug,
        name: b.name,
        hero_image_url: b.hero_image_url || null,
        photos: [],
        city: b.city || '',
        category: 'all',
        _venueName: b.name,
        _timeLabel: b.hh_end ? `Until ${formatEventTime(b.hh_end)}` : '',
        _subtitle: b.hh_description || '',
      })
    })

    // ⭐ Daily specials
    ;(feed.specials || []).slice(0, 8).forEach(sp => {
      const ent = sp.entity || {}
      cards.push({
        id: 'special-' + sp.id,
        slug: 'special-' + sp.id,
        _isEvent: true,
        _eventKind: 'special',
        entity_slug: sp.entity_slug,
        name: sp.title || sp.special_name,
        hero_image_url: sp.image_url || ent.hero_image_url || null,
        photos: [],
        city: ent.city || '',
        category: 'all',
        _venueName: ent.name || '',
        _discountText: sp.discount_text || '',
      })
    })

    return cards.filter(c => c.hero_image_url) // deck already drops cards w/o an image, so don't bother injecting ones that would just get filtered right back out
  } catch {
    return []
  }
}

// Same Twilio number used across the app (GCRHeader/Auth/Landing) — texting
// SWIPE here (vs BEACH elsewhere) just tells the inbound webhook this signup
// came from the swipe-deck prompt.
const SMS_SIGNUP_NUMBER = SMS_NUMBER
const SMS_SIGNUP_LINK = `sms:${SMS_SIGNUP_NUMBER}?body=${encodeURIComponent('SWIPE')}`

// Fetch social post cards (IG Reels, FB videos) to inject into the swipe deck
async function fetchSocialCards() {
  try {
    const res = await fetch(`${API_BASE}/api/gcr/social-posts/feed?limit=20`)
    if (!res.ok) return []
    const d = await res.json()
    return (d.posts || []).map(p => ({
      ...p,
      _isSocial: true,
      slug: `social-${p.id}`,
      id: `social-${p.id}`,
      name: p.caption || p.entity_slug,
      category: 'all', // inject into every category view
    }))
  } catch {
    return []
  }
}

// Every real section on the platform (same split CategoryPage.jsx's nav
// uses, via categoryMap.js's subtypeToCategory() — see gcrApi.js's toCard(),
// which stamps this onto each card as `section`, separate from the older,
// cruder `category` field EntityCard/HubTemplate/Home's category rails
// already depend on elsewhere). "Activities" used to be one catch-all tab
// covering marinas/wellness/public-spots/services/everything-else at once;
// this is the actual breakdown. Happy Hours isn't a subtype at all (any
// restaurant or bar can have one) so it's filtered on the `happy_hour` field
// instead of `section` — see the businesses filters below. Events still
// isn't a standalone swipeable entity (see fetchFeedCards' event/live-music/
// happy-hour/special cards, always category:'all' and interleaved into every
// tab instead), so that tab still links out to the full Events page.
const CAT_TABS = [
  { id: 'all',           label: 'All',          emoji: '🌟' },
  { id: 'restaurants',   label: 'Restaurants',  emoji: '🍽️' },
  { id: 'coffee',        label: 'Coffee',       emoji: '☕' },
  { id: 'nightlife',     label: 'Nightlife',    emoji: '🎵' },
  { id: 'things-to-do',  label: 'Things To Do', emoji: '🏄' },
  { id: 'shopping',      label: 'Shopping',     emoji: '🛍️' },
  { id: 'public-spots',  label: 'Public Spots', emoji: '✨' },
  { id: 'wellness',      label: 'Wellness',     emoji: '💆' },
  { id: 'marinas',       label: 'Marinas',      emoji: '⚓' },
  { id: 'staying',       label: 'Stay',         emoji: '🏨' },
  { id: 'happy-hours',   label: 'Happy Hours',  emoji: '🍹' },
  { id: 'services',      label: 'Services',     emoji: '🧰' },
  { id: 'events',        label: 'Events',       emoji: '🎪', to: '/events' },
]

// Shared by every "which cards match this tab" filter below -- Happy Hours
// isn't a section (any restaurant/bar can have one), so it checks the
// happy_hour field directly instead of `section`.
function matchesCategory(b, category) {
  if (category === 'happy-hours') return !!b.happy_hour
  return b.section === category
}

// Same options as /api/tourist/setup-questions' group_type question —
// kept in sync manually since that endpoint returns a static, hardcoded list.
const GROUP_TYPES = [
  { value: 'solo',    label: 'Solo',    emoji: '🙋' },
  { value: 'couple',  label: 'Couple',  emoji: '👫' },
  { value: 'family',  label: 'Family',  emoji: '👨‍👩‍👧' },
  { value: 'friends', label: 'Friends', emoji: '👯' },
]

// Same live property search Setup.jsx already uses for "where are you
// staying" — reused here so returning tourists can set/update it too,
// not just at initial signup.
function PropertyAutocomplete({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)

  const handleChange = async (e) => {
    const text = e.target.value
    onChange(text)
    if (text.length > 0) {
      const results = await searchProperties(text)
      setSuggestions(results)
      setOpen(true)
    } else {
      setSuggestions([])
      setOpen(false)
    }
  }

  const select = (s) => {
    onChange(s.name)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="trip-edit-input"
        type="text"
        placeholder={placeholder}
        value={value || ''}
        onChange={handleChange}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
      />
      {open && suggestions.length > 0 && (
        <div className="trip-edit-autocomplete">
          {suggestions.map(s => (
            <button key={s.id} type="button" className="trip-edit-autocomplete-item" onClick={() => select(s)}>
              <div className="ac-name">{s.name}</div>
              <div className="ac-meta">{s.type} · {s.city}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DECK_SIZE = 15

function shuffle(arr) {
  const copy = [...arr]
  for (let j = copy.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [copy[j], copy[k]] = [copy[k], copy[j]]
  }
  return copy
}

// Same normalization GCRCard.jsx uses to key into TAG_EMOJI, duplicated here
// rather than imported since it's one line and pulling in the whole module
// just for this would be overkill.
function tagEmoji(label) {
  if (/happy\s*hour/i.test(label)) return '🍹'
  const key = label.toLowerCase().replace(/[\s\-/]+/g, '_').replace(/[^a-z0-9_]/g, '')
  return TAG_EMOJI[key] || ''
}

function titleCase(str) {
  return str.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Open/closed status line — same logic as GCRCard.jsx (not shared as a util
// since that component pulls in its own CSS/deps this page doesn't need).
function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2,'0')}${ap}` : `${h12}${ap}`
}

function getTodayHours(hours) {
  if (!hours || !hours.length) return null
  const todayIdx = new Date().getDay()
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const todayName = DAYS[todayIdx]
  return hours.find(h => {
    if (typeof h.day_of_week === 'number') return h.day_of_week === todayIdx
    const s = String(h.day_of_week || h.day || '').toLowerCase()
    return s === todayName || s === String(todayIdx)
  }) || null
}

function computeStatus(hours) {
  if (!hours || !hours.length) return null
  const h = getTodayHours(hours)
  if (!h) return null
  if (h.is_closed) return { label: 'Closed Today', cls: 'closed' }

  const openStr  = h.open_time  || h.opens_at  || h.open  || ''
  const closeStr = h.close_time || h.closes_at || h.close || ''
  if (!openStr || !closeStr) return null

  const cur = new Date().getHours() * 60 + new Date().getMinutes()
  const [oh, om] = openStr.split(':').map(Number)
  const [ch, cm] = closeStr.split(':').map(Number)
  const openMin  = oh * 60 + om
  const closeMin = ch * 60 + cm

  if (cur < openMin - 60) return null
  if (cur < openMin)       return { label: `Opens ${fmt12(openStr)}`,           cls: 'opening' }
  if (cur < closeMin - 30) return { label: `Open · Closes ${fmt12(closeStr)}`,  cls: 'open'    }
  if (cur < closeMin)      return { label: `Closing Soon · ${fmt12(closeStr)}`, cls: 'closing' }
  return { label: 'Closed', cls: 'closed' }
}

// Per-category "where they left off" deck order — just ids, looked up
// against freshly-fetched businesses on restore so the data itself never goes stale.
const SWIPE_QUEUE_PREFIX = 'gcr_swipe_queue_'

function loadQueuedDeck(category) {
  try {
    const raw = localStorage.getItem(SWIPE_QUEUE_PREFIX + category)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveQueuedDeck(category, ids) {
  try { localStorage.setItem(SWIPE_QUEUE_PREFIX + category, JSON.stringify(ids)) } catch {}
}

export default function Swipe() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { addSavedPlace, removeSavedPlace, savedPlaces, addSuperLike, tourist, seenSlugs, setSeenSlugs, recordSwipe, retractLastSwipe, resetSeenSlugs, userLocation, requestLocation, geocodeStay, saveTourist } = useApp()

  const [allBusinesses, setAllBusinesses] = useState([])
  const [pool, setPool] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [deckReady, setDeckReady] = useState(false)
  const [error, setError] = useState(null)
  const [lastAction, setLastAction] = useState(null)
  const [likedCount, setLikedCount] = useState(0)
  const [view, setView] = useState('swipe')
  const [showBackTop, setShowBackTop] = useState(false)
  const [locPrompt, setLocPrompt] = useState(false)
  const [smsPrompt, setSmsPrompt] = useState(false)
  const [smsDone, setSmsDone] = useState(() => !!localStorage.getItem('gcr_sms_opted'))
  const [prefMap, setPrefMap] = useState({})
  const [swipingDir, setSwipingDir] = useState(null)
  const [undoStack, setUndoStack] = useState([]) // { business, action: 'like'|'nope'|'super' }
  // Maybe/Undo float quietly in the card's top corners (see the layout
  // rationale where they're rendered below) — that's deliberately subtle,
  // but a first-time visitor has no way to discover them on their own.
  // Show a caption under each once, dismissed on first interaction with
  // either or after a few seconds, never shown again on this device.
  const [showCornerHint, setShowCornerHint] = useState(() => !localStorage.getItem('gcr_corner_hint_seen'))
  const swipeCountRef = useRef(0)
  const pageRef = useRef(null)
  const personalizationCounterRef = useRef(0)

  // Trip-context "Change" modal — lets a returning tourist update their dates
  // and who they're traveling with. Destination isn't editable: the app is
  // Orange Beach/Gulf Shores only today (Setup.jsx hardcodes it), so there's
  // nothing real to switch between yet.
  const [showTripEdit, setShowTripEdit] = useState(false)
  const [editArrival, setEditArrival] = useState('')
  const [editDeparture, setEditDeparture] = useState('')
  const [editGroupType, setEditGroupType] = useState('')
  const [editHotelName, setEditHotelName] = useState('')
  const [savingTrip, setSavingTrip] = useState(false)

  // CAT_TABS is now the real, full section list (restaurants/coffee/nightlife/
  // things-to-do/shopping/public-spots/wellness/marinas/staying/happy-hours/
  // services/all) -- looking this up from CAT_TABS instead of the older,
  // cruder CATEGORIES file (still used elsewhere for the unrelated `category`
  // field) means every real section id resolves correctly here, not just
  // whichever ones happened to overlap between the two lists.
  const catInfo = CAT_TABS.find(c => c.id === category) || CAT_TABS[0]

  // /swipe/events and /swipe/drinks aren't real swipeable sections — catch
  // direct/bookmarked links to them too, not just the tab bar. Drinks has no
  // dedicated page, so send it to the closest real section (bars/cocktails
  // surface under Nightlife). /swipe/restaurants IS a real section id now
  // (see CAT_TABS) so it's deliberately not redirected anymore.
  useEffect(() => {
    if (category === 'events') navigate('/events', { replace: true })
    else if (category === 'drinks') navigate('/swipe/nightlife', { replace: true })
  }, [category, navigate])

  const businesses = (category === 'all'
    // Promos are admin-scoped to a category (gcrApi.js defaults unset ones to 'all') —
    // only exclude ones deliberately targeted at a specific tab, same rule deals/social
    // cards already follow (they're always category:'all' and always show here).
    ? allBusinesses.filter(b => !b._isPromo || b.category === 'all')
    : allBusinesses.filter(b => matchesCategory(b, category)))
    .filter(b => !seenSlugs.includes(b.slug))
    .filter(b => b.hero_image_url) // Only show businesses with images

  function closeTrip() {
    // notify parent iframe if embedded, then go back
    try { window.parent.postMessage({ type: 'tripswipe-close' }, '*') } catch {}
    window.history.back()
  }

  function scrollToTop() {
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    function onScroll() { setShowBackTop(el.scrollTop > 250) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // fetchBusinesses() defaults to limit:50 -- fine for a quick preview list
    // elsewhere, but the swipe deck is the ONE place meant to draw from the
    // platform's real full catalog (270+ restaurants alone, before nightlife/
    // shopping/activities/stay). At the old default, every swipe session --
    // no matter how much you swiped or how many times you reloaded -- only
    // ever pulled the same first 50 entities the API happened to return,
    // split five ways across category tabs. That's the real cause of "same
    // ~25 cards over and over no matter what" -- a fetch-size bug, not a
    // shuffle bug (shuffle() itself is a correct Fisher-Yates).
    Promise.all([fetchBusinesses({ limit: 2000 }), fetchPreferences(), fetchSocialCards(), fetchFeedCards()])
      .then(([all, prefs, social, feed]) => {
        if (cancelled) return
        setPrefMap(prefs)
        // Interleave social posts with the events/live-music/happy-hour/
        // specials cards so neither type dominates a stretch of the deck,
        // then inject the combined list every 5th position in the pool.
        const extras = []
        const maxLen = Math.max(social.length, feed.length)
        for (let i = 0; i < maxLen; i++) {
          if (social[i]) extras.push(social[i])
          if (feed[i]) extras.push(feed[i])
        }
        const withExtras = [...all]
        extras.forEach((card, i) => {
          const insertAt = (i + 1) * 5
          if (insertAt <= withExtras.length) withExtras.splice(insertAt, 0, card)
          else withExtras.push(card)
        })
        setAllBusinesses(withExtras)
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  // Show location prompt once if no location yet
  useEffect(() => {
    if (!userLocation) setLocPrompt(true)
  }, [])

  // Corner hint auto-dismisses on its own after a few seconds even if the
  // visitor never taps Maybe/Undo — it's a one-time nudge, not something
  // that should sit on screen indefinitely waiting for an interaction.
  useEffect(() => {
    if (!showCornerHint) return
    const timer = setTimeout(dismissCornerHint, 5000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch SMS config and set up opt-in trigger
  useEffect(() => {
    if (smsDone) return
    const token = localStorage.getItem('gcr_access_token')
    const isGuest = !token
    let timer = null
    fetch(`${API_BASE}/api/admin/sms-config`)
      .then(r => r.json())
      .then(cfg => {
        if (!cfg.popup_enabled) return
        const val = parseInt(cfg.popup_value) || 5
        if (cfg.popup_trigger === 'time') {
          timer = setTimeout(() => setSmsPrompt(true), val * 60 * 1000)
        } else {
          // Guests: show after they finish the 15-card free deck, not mid-deck
          // Logged-in: use configured value
          swipeCountRef.current = isGuest ? -DECK_SIZE : -val
        }
      })
      .catch(() => {
        // default: guests see prompt after finishing the deck, others after 5 min
        if (isGuest) {
          swipeCountRef.current = -DECK_SIZE
        } else {
          timer = setTimeout(() => setSmsPrompt(true), 5 * 60 * 1000)
        }
      })
    return () => { if (timer) clearTimeout(timer) }
  }, [smsDone])

  useEffect(() => {
    if (allBusinesses.length === 0) return
    setDeckReady(false)
    const token = localStorage.getItem('gcr_access_token')
    const isGuest = !token
    // Guests always get a fresh deck — don't filter by seenSlugs so the first
    // 15 cards always show regardless of prior localStorage state
    const visible = (category === 'all'
      ? allBusinesses.filter(b => !b._isPromo || b.category === 'all')
      : allBusinesses.filter(b => matchesCategory(b, category)))
      .filter(b => isGuest ? true : !seenSlugs.includes(b.slug))
      .filter(b => b.hero_image_url) // Only show cards with images — no blank gradient placeholders
    setPool(visible)

    // Resume exactly where they left off: restore whichever still-unseen
    // cards were queued last time (same order — last item stays "on top"),
    // then fill any remaining deck capacity with freshly personalized/shuffled
    // cards, same convention refillDeck() already uses for new cards (added
    // to the front, so what was queued keeps priority).
    const queuedIds = isGuest ? [] : loadQueuedDeck(category)
    const byId = new Map(visible.map(b => [b.id, b]))
    const resumed = queuedIds.map(id => byId.get(id)).filter(Boolean)
    const resumedIds = new Set(resumed.map(b => b.id))
    const rest = visible.filter(b => !resumedIds.has(b.id))

    // Use personalized order if we have preference data, else shuffle
    const sortedRest = Object.keys(prefMap).length
      ? personalizeAndSort(rest, prefMap)
      : shuffle(rest)

    const fillCount = Math.max(0, DECK_SIZE - resumed.length)
    setCards([...sortedRest.slice(0, fillCount), ...resumed])
    setLikedCount(0)
    setDeckReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, allBusinesses, prefMap])

  // Persist the current deck order (by id) so returning to this category
  // resumes instead of rebuilding a fresh personalized/shuffled list.
  useEffect(() => {
    if (localStorage.getItem('gcr_access_token') && deckReady) {
      saveQueuedDeck(category, cards.map(c => c.id))
    }
  }, [cards, category, deckReady])

  useEffect(() => {
    if (allBusinesses.length === 0) return
    if (seenSlugs.length > 0) return
    const visible = (category === 'all'
      ? allBusinesses.filter(b => !b._isPromo || b.category === 'all')
      : allBusinesses.filter(b => matchesCategory(b, category)))
      .filter(b => b.hero_image_url) // Only show cards with images — no blank gradient placeholders
    setPool(visible)
    const sorted = Object.keys(prefMap).length
      ? personalizeAndSort(visible, prefMap)
      : shuffle(visible)
    setCards(sorted.slice(0, DECK_SIZE))
    setLikedCount(0)
    setDeckReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenSlugs])

  if (loading || !deckReady) return (
    <div className="swipe-page page safe-top">
      <div className="swipe-header">
        <button className="back-btn-sm close-btn" onClick={() => window.history.back()}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={20} height={20}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="swipe-title"><span>{catInfo.emoji}</span><span>Swipe Your Trip</span></div>
        <div style={{width:40}} />
      </div>
      <div className="cat-tabs">
        {CAT_TABS.map(tab => (
          <div key={tab.id} className={`cat-tab ${category === tab.id ? 'active' : ''}`}>
            <span>{tab.emoji}</span><span>{tab.label}</span>
          </div>
        ))}
      </div>
      <div className="cards-container">
        <div className="swipe-card-wrapper" style={{position:'relative'}}>
          {/* Mirrors the real card's proportions (big photo, dark info panel
              below) instead of a generic thin-footer shape, so there's no
              jarring resize/recolor jump once the real deck renders in. */}
          <div className="business-card">
            <div className="card-image-wrap skeleton-pulse" style={{background:'rgba(0,0,0,0.06)'}} />
            <div className="card-info-panel">
              <div className="skeleton-pulse" style={{height:22,width:'65%',background:'rgba(255,255,255,0.14)',borderRadius:8,marginBottom:10}} />
              <div className="skeleton-pulse" style={{height:13,width:'40%',background:'rgba(255,255,255,0.08)',borderRadius:8,marginBottom:14}} />
              <div className="skeleton-pulse" style={{height:13,width:'85%',background:'rgba(255,255,255,0.08)',borderRadius:8,marginBottom:6}} />
              <div className="skeleton-pulse" style={{height:13,width:'55%',background:'rgba(255,255,255,0.08)',borderRadius:8}} />
            </div>
          </div>
        </div>
      </div>
      <div className="swipe-actions">
        <div className="action-btn nope" style={{opacity:0.3}} />
        <div className="action-btn super" style={{opacity:0.3}} />
        <div className="action-btn like" style={{opacity:0.3}} />
      </div>
    </div>
  )
  if (error) return (
    <div className="swipe-page" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text)',textAlign:'center',padding:20}}>
      <div>
        <div>Could not load businesses.</div>
        <div style={{fontSize:13,color:'var(--text3)',marginTop:8}}>{error}</div>
        <button onClick={() => navigate('/home')} style={{marginTop:16,padding:'10px 18px'}}>Back</button>
      </div>
    </div>
  )

  function flash(action) {
    setLastAction(action)
    setTimeout(() => setLastAction(null), 800)
  }

  function refillDeck(next) {
    if (next.length < 5) {
      const shownIds = new Set(next.map(b => b.id))
      // Allow the same business (slug) to appear multiple times in the
      // INITIAL deck (once per exploded photo-card) — but not once its slug
      // has actually been swiped. Without the seenSlugs check, once the
      // real unseen supply in `pool` ran low this refilled from already-
      // decided cards forever: cards.length never reached 0, so `allGone`
      // (which requires exactly that) never fired and the deck looped
      // through repeats instead of ever reaching "You've seen them all!".
      const remaining = pool.filter(b => !shownIds.has(b.id) && !seenSlugs.includes(b.slug))
      return [...remaining.slice(0, DECK_SIZE - next.length), ...next]
    }
    return next
  }

  // For sponsored cards, resolve to real business slug before saving
  function resolveReal(business) {
    if (!business._isSponsored) return business
    return { ...business, id: business._sponsorSlug, slug: business._sponsorSlug }
  }

  // Re-fetch preference scores every 10 swipes and re-sort the remaining pool
  // (not the visible deck — that would yank cards out from under the user
  // and reset likedCount) so cards pulled in from here on reflect patterns
  // from *this* session, not just whatever was known when the page loaded.
  async function refreshPersonalization() {
    try {
      const prefs = await fetchPreferences()
      if (prefs && Object.keys(prefs).length) {
        setPool(prev => personalizeAndSort(prev, prefs))
      }
    } catch {}
  }

  function bumpPersonalizationCounter() {
    personalizationCounterRef.current += 1
    if (personalizationCounterRef.current >= 10) {
      personalizationCounterRef.current = 0
      // Small delay — the swipe batch itself flushes to the backend on its
      // own timer (see AppContext's flushSwipes), which is what actually
      // updates the preference scores we're about to re-fetch.
      setTimeout(refreshPersonalization, 1500)
    }
  }

  function onSwipe(direction, business) {
    setSwipingDir(null)
    if (direction === 'right') {
      addSavedPlace(resolveReal(business))
      setLikedCount(p => p + 1)
      flash('like')
      recordSwipe(business, 'like')
      setUndoStack(prev => [...prev.slice(-4), { business, action: 'like' }])
    } else {
      flash('nope')
      recordSwipe(business, 'nope')
      setUndoStack(prev => [...prev.slice(-4), { business, action: 'nope' }])
    }
    bumpPersonalizationCounter()
    // swipe-count based SMS trigger
    if (!smsDone && swipeCountRef.current < 0) {
      swipeCountRef.current += 1
      if (swipeCountRef.current === 0) setSmsPrompt(true)
    }
  }

  function onCardLeftScreen(business) {
    setCards(prev => refillDeck(prev.filter(b => b.id !== business.id)))
  }

  // Quick save/unsave from the card's heart button — independent of the
  // swipe gesture (doesn't dismiss the card or advance the deck), unlike
  // pressLike which is a full swipe-right.
  function toggleSavePlace(business) {
    const real = resolveReal(business)
    if (savedPlaces.some(p => p.id === real.id)) {
      removeSavedPlace(real.id)
      setLikedCount(p => Math.max(0, p - 1))
    } else {
      addSavedPlace(real)
      // Same preference/seen signal a swipe-right records — a heart-save
      // is just as real an endorsement as swiping right, it just doesn't
      // dismiss the card, so it shouldn't be invisible to the algorithm
      // that's supposed to be learning from likes.
      recordSwipe(business, 'like')
      setLikedCount(p => p + 1)
      bumpPersonalizationCounter()
    }
  }

  function pressLike() {
    if (cards.length === 0) return
    const top = cards[cards.length - 1]
    addSavedPlace(resolveReal(top))
    recordSwipe(top, 'like')
    setLikedCount(p => p + 1)
    setCards(prev => refillDeck(prev.slice(0, -1)))
    flash('like')
    setUndoStack(prev => [...prev.slice(-4), { business: top, action: 'like' }])
    bumpPersonalizationCounter()
  }

  function pressNope() {
    if (cards.length === 0) return
    const top = cards[cards.length - 1]
    recordSwipe(top, 'nope')
    setCards(prev => refillDeck(prev.slice(0, -1)))
    flash('nope')
    setUndoStack(prev => [...prev.slice(-4), { business: top, action: 'nope' }])
    bumpPersonalizationCounter()
  }

  function pressSuper() {
    if (cards.length === 0) return
    const top = cards[cards.length - 1]
    addSuperLike(resolveReal(top))
    recordSwipe(top, 'super')
    setLikedCount(p => p + 1)
    setCards(prev => refillDeck(prev.slice(0, -1)))
    flash('super')
    setUndoStack(prev => [...prev.slice(-4), { business: top, action: 'super' }])
    bumpPersonalizationCounter()
  }

  function dismissCornerHint() {
    if (!showCornerHint) return
    setShowCornerHint(false)
    localStorage.setItem('gcr_corner_hint_seen', '1')
  }

  // "Not sure yet" — distinct from Pass (rejected) and Like (want to go).
  // Mild positive signal for preference scoring (see SWIPE_WEIGHTS.maybe on
  // the backend), doesn't save the place, but is undo-able like every other action.
  function pressMaybe() {
    dismissCornerHint()
    if (cards.length === 0) return
    const top = cards[cards.length - 1]
    recordSwipe(top, 'maybe')
    setCards(prev => refillDeck(prev.slice(0, -1)))
    flash('maybe')
    bumpPersonalizationCounter()
    setUndoStack(prev => [...prev.slice(-4), { business: top, action: 'maybe' }])
  }

  function pressUndo() {
    dismissCornerHint()
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    // Reverse the action
    if (last.action === 'like') {
      removeSavedPlace(last.business.id)
      setLikedCount(p => Math.max(0, p - 1))
    } else if (last.action === 'super') {
      removeSavedPlace(last.business.id)
      setLikedCount(p => Math.max(0, p - 1))
    }
    // Best-effort: pull the swipe back out of the not-yet-sent queue so an
    // undone action doesn't still get counted toward preference scoring.
    retractLastSwipe(last.business._sponsorSlug || last.business.slug)
    // Put the card back on top of the deck
    setCards(prev => {
      const without = prev.filter(b => b.id !== last.business.id)
      return [...without, last.business]
    })
    // Remove from seenSlugs so it doesn't get filtered
    setSeenSlugs(prev => {
      const updated = prev.filter(s => s !== last.business.slug)
      localStorage.setItem('gcr_seen', JSON.stringify(updated))
      return updated
    })
  }

  const allGone = deckReady && cards.length === 0 && pool.filter(b => !seenSlugs.includes(b.slug)).length === 0

  const groupInfo = GROUP_TYPES.find(g => g.value === tourist?.group_type)
  const tripLabel = [
    tourist?.destination?.split(',')[0],
    tourist?.arrival && new Date(tourist.arrival).toLocaleDateString('en-US', {month:'short', day:'numeric'})
      + (tourist?.departure ? ` – ${new Date(tourist.departure).toLocaleDateString('en-US', {month:'short', day:'numeric'})}` : ''),
    groupInfo && `${groupInfo.emoji} ${groupInfo.label}`,
  ].filter(Boolean).join(' · ') || 'Gulf Coast'

  function openTripEdit() {
    setEditArrival(tourist?.arrival || '')
    setEditDeparture(tourist?.departure || '')
    setEditGroupType(tourist?.group_type || '')
    setEditHotelName(tourist?.hotel_name || '')
    setShowTripEdit(true)
  }

  async function saveTripEdit() {
    setSavingTrip(true)
    try {
      let trip_days = tourist?.trip_days || null
      if (editArrival && editDeparture) {
        const a = new Date(editArrival), b = new Date(editDeparture)
        trip_days = Math.max(1, Math.round((b - a) / 86400000) + 1)
      }
      await saveTourist({
        arrival: editArrival || null,
        departure: editDeparture || null,
        group_type: editGroupType || null,
        hotel_name: editHotelName || null,
        trip_days,
      })
      setShowTripEdit(false)
    } finally {
      setSavingTrip(false)
    }
  }

  return (
    <div className="swipe-page page safe-top" ref={pageRef}>
      {/* Header + category tabs share this wrapper so the location prompt
          (position:absolute, top:100%) floats below BOTH of them instead of
          pushing the deck down -- it used to be scoped to just the header,
          which meant it floated over the exact spot the category tabs sit,
          blocking taps on them the whole time it was showing. */}
      <div className="swipe-header-wrap">
        <div className="swipe-header">
          <div className="swipe-header-left">
            <button className="back-btn-sm" onClick={() => navigate('/home')} aria-label="Home">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={19} height={19}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4h2v4a1 1 0 001 1h4a1 1 0 001-1V10" />
              </svg>
            </button>
            <button className="back-btn-sm close-btn" onClick={closeTrip} aria-label="Close">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={20} height={20}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="swipe-title">
            <span>{catInfo.emoji}</span>
            <span>Swipe Your Trip</span>
          </div>
          <div className="swipe-view-toggle">
            <button className={view === 'swipe' ? 'active' : ''} onClick={() => setView('swipe')}>
              <SwipeIcon />
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              <ListIcon />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="cat-tabs">
          {CAT_TABS.map(tab => (
            <button
              key={tab.id}
              className={`cat-tab ${category === tab.id ? 'active' : ''}`}
              onClick={() => navigate(tab.to || `/swipe/${tab.id}`)}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {locPrompt && (
          <div className="loc-prompt">
            <span>📍 Share location for distances</span>
            <button className="loc-yes" onClick={async () => {
              setLocPrompt(false)
              const gps = await requestLocation()
              if (!gps && tourist?.hotel_name) await geocodeStay(tourist.hotel_name)
              else if (!gps && tourist?.destination) await geocodeStay(tourist.destination)
            }}>Allow</button>
            <button className="loc-no" onClick={() => setLocPrompt(false)}>✕</button>
          </div>
        )}
      </div>

      <div className="swipe-dest">
        📍 {tripLabel}
        <button className="swipe-change-btn" onClick={openTripEdit}>Change</button>
        {view === 'swipe' && (
          <span className="swipe-progress">
            {businesses.length === 0 ? 'All done' : (
              <>
                {/* clamp: refillDeck recycles cards from the pool, so the live
                    deck can briefly hold more entries than the de-duplicated
                    `businesses` count — without clamping, "seen" went negative. */}
                {Math.min(businesses.length, Math.max(0, businesses.length - cards.length))}/{businesses.length}
              </>
            )}
          </span>
        )}
        {view === 'list' && (
          <span className="swipe-progress">{businesses.length} places</span>
        )}
      </div>

      {showTripEdit && (
        <div className="trip-edit-overlay" onClick={() => !savingTrip && setShowTripEdit(false)}>
          <div className="trip-edit-sheet" onClick={e => e.stopPropagation()}>
            <h3>Update your trip</h3>
            <label className="trip-edit-label">Dates</label>
            <div className="trip-edit-dates">
              <input type="date" value={editArrival} onChange={e => setEditArrival(e.target.value)} />
              <span>–</span>
              <input type="date" value={editDeparture} min={editArrival || undefined} onChange={e => setEditDeparture(e.target.value)} />
            </div>
            <label className="trip-edit-label">Who's joining you?</label>
            <div className="trip-edit-group-row">
              {GROUP_TYPES.map(g => (
                <button
                  key={g.value}
                  className={`trip-edit-group-btn ${editGroupType === g.value ? 'active' : ''}`}
                  onClick={() => setEditGroupType(g.value)}
                >
                  <span>{g.emoji}</span><span>{g.label}</span>
                </button>
              ))}
            </div>
            <label className="trip-edit-label">Where are you staying?</label>
            <div style={{ marginBottom: 24 }}>
              <PropertyAutocomplete
                value={editHotelName}
                onChange={setEditHotelName}
                placeholder="Search condos, hotels…"
              />
            </div>
            <div className="trip-edit-actions">
              <button className="trip-edit-cancel" onClick={() => setShowTripEdit(false)} disabled={savingTrip}>Cancel</button>
              <button className="trip-edit-save" onClick={saveTripEdit} disabled={savingTrip}>
                {savingTrip ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SWIPE VIEW ── */}
      {view === 'swipe' && (
        <>
          <div className="swipe-hint">
            <span className="hint-nope">← NOPE</span>
            <span className="hint-like">LIKE →</span>
          </div>

          {lastAction && (
            <div className={`swipe-flash ${lastAction}`}>
              {lastAction === 'like' ? '❤️ LIKE' : lastAction === 'super' ? '⭐ MUST DO' : lastAction === 'maybe' ? '🤔 MAYBE' : '✕ NOPE'}
            </div>
          )}

          <div className="cards-container">
            {allGone ? (
              <div className="all-done">
                <div className="done-emoji">🎉</div>
                <h3>You've seen them all!</h3>
                <p>You saved {likedCount} place{likedCount !== 1 ? 's' : ''} this session</p>
                <button className="btn-primary" onClick={() => navigate('/list')}>View My List →</button>
                <button className="btn-outline" onClick={resetSeenSlugs} style={{marginTop:10}}>
                  🔄 Swipe Again
                </button>
                <button className="btn-outline" onClick={() => navigate('/home')} style={{marginTop:8}}>Explore More</button>
              </div>
            ) : (
              cards.map((business, index) => (
                <TinderCard
                  key={business.id}
                  onSwipe={(dir) => onSwipe(dir, business)}
                  onCardLeftScreen={() => { setSwipingDir(null); onCardLeftScreen(business) }}
                  onSwipingDirection={(dir) => { if (index === cards.length - 1) setSwipingDir(dir) }}
                  preventSwipe={['up', 'down']}
                  className="swipe-card-wrapper"
                >
                  {business._isPromo
                    ? <PromoCard card={business} isTop={index === cards.length - 1} onDetail={() => navigate(business.linked_slug ? `/business/${business.linked_slug}` : '#')} />
                    : business._isSocial
                      ? <SocialCard post={business} isTop={index === cards.length - 1} onDetail={() => navigate(`/business/${business.entity_slug}`)} swipingDir={index === cards.length - 1 ? swipingDir : null} />
                      : business._isDeal
                        ? <DealSwipeCard deal={business._dealData} isTop={index === cards.length - 1} onDetail={() => business.entity_slug ? navigate(`/business/${business.entity_slug}`) : navigate('/deals')} />
                        : business._isEvent
                          ? <EventSwipeCard card={business} isTop={index === cards.length - 1} onDetail={() => navigate(business._artistSlug ? `/artist/${business._artistSlug}` : business.entity_slug ? `/business/${business.entity_slug}` : '#')} />
                          : <BusinessCard business={business} isTop={index === cards.length - 1} onDetail={() => navigate(`/business/${business._isSponsored ? business._sponsorSlug : business.slug}`)} userLocation={userLocation} swipingDir={index === cards.length - 1 ? swipingDir : null} savedPlaces={savedPlaces} onToggleSave={toggleSavePlace} />
                  }
                </TinderCard>
              ))
            )}

            {/* Maybe/Undo float on the card itself instead of a second full-width
                row below the deck — they're secondary actions, not worth the
                same screen real estate as Nope/Must Do/Like, and the card
                (the actual thing being decided on) should get that space instead. */}
            {!allGone && (
              <>
                <button
                  className={`card-float-btn undo-float ${undoStack.length === 0 ? 'disabled' : ''}`}
                  onClick={pressUndo}
                  disabled={undoStack.length === 0}
                  aria-label="Undo last swipe"
                >
                  ↩
                </button>
                {showCornerHint && <span className="card-float-hint hint-undo">Undo</span>}
                <button className="card-float-btn maybe-float" onClick={pressMaybe} aria-label="Maybe">
                  🤔
                </button>
                {showCornerHint && <span className="card-float-hint hint-maybe">Maybe</span>}
              </>
            )}
          </div>

          {!allGone && (
            <div className="swipe-actions">
              <div className="swipe-actions-row primary">
                <button className="action-btn nope" onClick={pressNope}>
                  <span>✕</span>
                  <span>NOPE</span>
                </button>
                <button className="action-btn super" onClick={pressSuper}>
                  <span>⭐</span>
                  <span>MUST DO</span>
                </button>
                <button className="action-btn like" onClick={pressLike}>
                  <span>♥</span>
                  <span>LIKE</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showBackTop && (
        <button className="back-to-top" onClick={scrollToTop} aria-label="Back to top">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={18} height={18}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* ── SMS Opt-in Card: one-tap "Text SWIPE" (autofills Messages, they just hit send) ── */}
      {smsPrompt && !smsDone && (
        <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',alignItems:'flex-end',justifyContent:'center',background:'rgba(0,0,0,.5)'}}
             onClick={e => { if(e.target===e.currentTarget) setSmsPrompt(false) }}>
          <div style={{position:'relative',width:'calc(100% - 32px)',maxWidth:400,margin:'0 0 100px',background:'var(--card)',borderRadius:18,padding:'16px 20px 18px',boxShadow:'0 -8px 40px rgba(0,0,0,.3)'}}>
            <button
              onClick={() => { setSmsPrompt(false); localStorage.setItem('gcr_sms_opted','skip'); setSmsDone(true) }}
              style={{position:'absolute',top:8,right:10,background:'none',border:'none',color:'var(--text3)',fontSize:20,lineHeight:1,cursor:'pointer',padding:6}}
              aria-label="Dismiss"
            >×</button>
            <div style={{fontSize:20,textAlign:'center',marginBottom:2}}>📲</div>
            <h3 style={{textAlign:'center',color:'var(--text)',fontSize:16,fontWeight:900,margin:'0 0 4px'}}>Save your picks + get local deals</h3>
            <p style={{textAlign:'center',color:'var(--text2)',fontSize:13,margin:'0 0 14px',lineHeight:1.4}}>
              One tap texts us — we'll set up your account and send same-day specials your way.
            </p>
            <a
              href={SMS_SIGNUP_LINK}
              onClick={() => { localStorage.setItem('gcr_sms_opted', '1'); setSmsDone(true); setSmsPrompt(false) }}
              style={{display:'block',width:'100%',boxSizing:'border-box',textAlign:'center',textDecoration:'none',background:'linear-gradient(135deg, var(--primary), var(--primary-dark))',color:'#fff',borderRadius:10,padding:'13px',fontSize:15,fontWeight:800}}
            >
              Text SWIPE to sign up
            </a>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="list-view">
          {businesses.length === 0 ? (
            <div className="all-done">
              <div className="done-emoji">🔍</div>
              <h3>Nothing here yet</h3>
              <p>Try a different category</p>
            </div>
          ) : (
            businesses.map(b => {
              const saved = savedPlaces.some(p => p.id === b.id)
              return (
                <div key={b.id} className="list-card" onClick={() => navigate(`/business/${b.slug}`)}>
                  <div className="list-card-img" style={b.hero_image_url ? undefined : {background:'linear-gradient(135deg,#1a3a5c,#0ea5e9)'}}>
                    {b.hero_image_url && (
                      <img src={b.hero_image_url} alt={b.name} style={{width:'100%',height:'100%',objectFit:'cover'}}
                        onError={e => {
                          try { e.target.style.display='none'; if (e.target.parentNode) e.target.parentNode.style.background='linear-gradient(135deg,#1a3a5c,#0ea5e9)' } catch {}
                        }} />
                    )}
                  </div>
                  <div className="list-card-body">
                    <div className="list-card-top">
                      <div>
                        <div className="list-card-name">{b.name}</div>
                        {b.subtitle && <div className="list-card-sub">{b.subtitle}</div>}
                        <div className="list-card-meta">
                          {b.rating && <span>⭐ {b.rating}</span>}
                          {b.rating && b.price_range && <span className="dot"> · </span>}
                          {b.price_range && <span>{b.price_range}</span>}
                          {(b.rating || b.price_range) && b.city && <span className="dot"> · </span>}
                          {b.city && <span className="list-card-addr">{b.city}</span>}
                        </div>
                      </div>
                      <button
                        className={`list-save-btn ${saved ? 'saved' : ''}`}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); saved ? removeSavedPlace(b.id) : addSavedPlace(b) }}
                      >
                        {saved ? '♥' : '♡'}
                      </button>
                    </div>
                    {(b.live_music || b.happy_hour || b.duration) && (
                      <div className="list-card-badges">
                        {b.live_music && <span className="badge badge-live">🎵 Live Music</span>}
                        {b.happy_hour && <span className="badge badge-happy">🍹 HH</span>}
                        {b.duration && <span className="badge badge-music">⏱ {b.duration}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Social Card — Instagram Reel / Facebook video injected into the swipe deck ──
function SocialCard({ post, isTop, onDetail, swipingDir }) {
  const videoRef = useRef(null)
  const isVideo = post.media_type === 'reel' || post.media_type === 'video'
  const platformIcon = { instagram: '📸', facebook: '👥', tiktok: '🎵' }[post.platform] || '📱'
  const platformLabel = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }[post.platform] || post.platform

  // Autoplay video when this card is on top
  useEffect(() => {
    if (!videoRef.current) return
    if (isTop) { videoRef.current.play().catch(() => {}) }
    else { videoRef.current.pause() }
  }, [isTop])

  const tintStyle = swipingDir === 'right'
    ? { boxShadow: '0 0 0 4px #4ade80', border: '2px solid #4ade80' }
    : swipingDir === 'left'
    ? { boxShadow: '0 0 0 4px #ef4444', border: '2px solid #ef4444' }
    : {}

  return (
    <div className="swipe-card social-card" style={tintStyle}>
      {/* Platform badge */}
      <div className="social-card-badge">
        <span>{platformIcon}</span>
        <span>{platformLabel}</span>
      </div>

      {/* Video or image */}
      {isVideo && post.video_url ? (
        <video
          ref={videoRef}
          src={post.video_url}
          poster={post.thumbnail_url}
          muted
          loop
          playsInline
          className="social-card-media"
        />
      ) : post.thumbnail_url ? (
        <img src={post.thumbnail_url} alt={post.caption || 'Post'} className="social-card-media" />
      ) : (
        <div className="social-card-placeholder">
          <span style={{ fontSize: 48 }}>{platformIcon}</span>
        </div>
      )}

      {/* Bottom info bar — tapping anywhere here opens the profile, same as
          the other card types, not just the explicit button. */}
      <div className="social-card-info" onClick={onDetail} role="button" tabIndex={0}>
        {post.entity_name && <div className="social-card-biz">{post.entity_name}</div>}
        {post.caption && <div className="social-card-caption">{post.caption.slice(0, 80)}{post.caption.length > 80 ? '…' : ''}</div>}
        <button className="social-card-view" onClick={e => { e.stopPropagation(); onDetail() }}>View Profile →</button>
      </div>

      {/* Play indicator for videos */}
      {isVideo && !post.video_url && (
        <div className="social-card-play-badge">▶ Reel</div>
      )}
    </div>
  )
}

function BusinessCard({ business, isTop, onDetail, userLocation, swipingDir, savedPlaces, onToggleSave }) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const ptrRef = useRef(null)
  const distMiles = userLocation
    ? calcDistance(userLocation.lat, userLocation.lng, business.latitude, business.longitude)
    : null
  const distLabel = formatDistance(distMiles)
  // Sponsored cards save under their real business id (_sponsorSlug), not
  // this card instance's own display id — same remap toggleSavePlace's
  // resolveReal() does — so the saved-state check has to match that.
  const realId = business._isSponsored ? business._sponsorSlug : business.id
  const isSaved = (savedPlaces || []).some(p => p.id === realId)

  const allPhotos = [
    business.hero_image_url,
    ...(business.photos || []).filter(p => p !== business.hero_image_url)
  ].filter(Boolean)

  const photo = allPhotos[photoIdx] || null

  function handleImgDown(e) {
    ptrRef.current = { x: e.clientX, y: e.clientY }
  }

  function handleImgUp(e) {
    if (!ptrRef.current) return
    const dx = Math.abs(e.clientX - ptrRef.current.x)
    const dy = Math.abs(e.clientY - ptrRef.current.y)
    ptrRef.current = null
    if (dx < 8 && dy < 8 && allPhotos.length > 1) {
      e.stopPropagation()
      setPhotoIdx(i => (i + 1) % allPhotos.length)
    }
  }

  const extraTags = []
  if (business.live_music) extraTags.push('Live Music')
  if (business.happy_hour) extraTags.push('Happy Hour')
  const displayedTags = [...extraTags, ...(business.tags || [])].slice(0, 3)
  const desc = business.subtitle || (business.description ? business.description.slice(0, 140) + (business.description.length > 140 ? '…' : '') : '')
  const status = computeStatus(business.hours || [])
  const categoryInfo = CATEGORIES.find(c => c.id === business.category)
  const badgeLabel = business.type ? titleCase(business.type) : (categoryInfo?.label || 'Place')
  const badgeEmoji = categoryInfo?.emoji || '📍'

  return (
    <div className={`business-card ${business._isSponsored ? 'sponsored-card' : ''} ${isTop ? 'top' : ''}`}>
      {/* Photo */}
      <div
        className="card-image-wrap"
        style={!photo ? {background:'linear-gradient(135deg,#1a3a5c,#0ea5e9)'} : undefined}
        onPointerDown={handleImgDown}
        onPointerUp={handleImgUp}
      >
        {photo && (
          <img src={photo} alt={business.name} className="swipe-card-photo"
            onError={e => { try { e.target.style.display='none'; if (e.target.parentNode) e.target.parentNode.style.background='linear-gradient(135deg,#1a3a5c,#0ea5e9)' } catch {} }} />
        )}

        {/* Drag direction tint + stamp */}
        {swipingDir === 'right' && (
          <div className="card-drag-tint like-tint">
            <span className="drag-stamp like-stamp">LIKE ♥</span>
          </div>
        )}
        {swipingDir === 'left' && (
          <div className="card-drag-tint nope-tint">
            <span className="drag-stamp nope-stamp">NOPE ✕</span>
          </div>
        )}

        {/* Sponsored disclosure takes the primary top-left badge slot instead
            of the category type badge — an ad label has to stay visible and
            unambiguous, not compete with/get buried under other badging. */}
        {business._isSponsored ? (
          <div className="card-sponsored-badge">⭐ Sponsored</div>
        ) : (
          <div className="card-type-badge">{badgeEmoji} {badgeLabel}</div>
        )}

        {business.verified && (
          <div className="card-featured-badge card-badge-stacked">⭐ Featured</div>
        )}
        {!business.verified && business._matchScore >= 15 && (
          <div className="card-match-badge card-badge-stacked">⚡ Your Vibe</div>
        )}

        <button
          className={`card-save-btn ${isSaved ? 'saved' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleSave?.(business) }}
          aria-label={isSaved ? 'Remove from saved' : 'Save'}
        >
          {isSaved ? '❤️' : '🤍'}
        </button>
        {allPhotos.length > 1 && (
          <div className="card-photo-counter card-photo-counter-stacked">{photoIdx + 1}/{allPhotos.length}</div>
        )}
      </div>

      {/* Info panel — solid, below the photo (not overlaid on it). Tapping
          anywhere here (not the photo — that cycles photos, not the buttons
          below — those already stop propagation) opens the full profile,
          same as tapping a Tinder card's info area. */}
      <div className="card-info-panel" onClick={onDetail} role="button" tabIndex={0}>
        <div className="card-name-row">
          <h3 className="card-name">{business.name}</h3>
          {business.rating ? (
            <div className="card-rating">
              ⭐ {business.rating}
              {business.review_count > 0 && <span className="card-review-count"> ({business.review_count})</span>}
            </div>
          ) : null}
        </div>
        {/* Price up top, large — but only for a bookable activity/experience,
            where price_per_person is one exact figure for the whole thing
            (parasailing, charters, tours). A restaurant doesn't have a
            single price — it has a menu — so it keeps the $$ range in the
            meta row below instead of a fabricated "exact" number up top. */}
        {business.price_per_person && business.category !== 'food' && (
          <div className="card-price-hero">💵 {business.price_per_person}</div>
        )}
        <div className="card-meta-row">
          {business.city && <span>📍 {business.city}</span>}
          {business.price_range && <><span className="dot">·</span><span>{business.price_range}</span></>}
          {distLabel && <><span className="dot">·</span><span>🚗 {distLabel}</span></>}
        </div>
        {desc && <p className="card-desc">{desc}</p>}

        {displayedTags.length > 0 && (
          <div className="card-tag-row">
            {displayedTags.map((tag, i) => (
              <span key={tag} className="card-tag-item">
                {i > 0 && <span className="card-tag-divider">|</span>}
                {tagEmoji(tag) ? `${tagEmoji(tag)} ` : ''}{tag}
              </span>
            ))}
          </div>
        )}

        <div className="card-bottom-row">
          {status && (
            <span className={`card-status-pill status-${status.cls}`}>
              <span className="card-status-dot" />
              {status.label}
            </span>
          )}
          {isTop && (
            <div className="card-bottom-actions"
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
            >
              {business.booking_url && (
                <a className="card-book-pill pressable" href={business.booking_url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}>
                  📅 Book Now
                </a>
              )}
              <button className="card-chevron-btn pressable"
                onPointerUp={e => { e.stopPropagation(); onDetail() }}
                onClick={e => { e.stopPropagation(); onDetail() }}
                aria-label="View details"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PromoCard({ card, isTop, onDetail }) {
  return (
    <div className={`business-card promo-card ${isTop ? 'top' : ''}`}>
      <div className="card-image-wrap" style={!card.hero_image_url ? {background:'linear-gradient(135deg,#4f46e5,#7c3aed)'} : undefined}>
        {card.hero_image_url && (
          <img src={card.hero_image_url} alt={card.name} className="swipe-card-photo"
            onError={e => { try { e.target.style.display='none' } catch {} }} />
        )}
        <div className="card-promo-badge">📅 Tonight</div>
      </div>

      <div className="card-info-panel" onClick={onDetail} role="button" tabIndex={0}>
        <div className="card-name-row">
          <h3 className="card-name">{card.name}</h3>
        </div>
        {card.city && (
          <div className="card-meta-row">
            <span>📍 {card.city}</span>
          </div>
        )}
        {card.description && <p className="card-desc">{card.description}</p>}

        {isTop && (
          <div className="card-bottom-row">
            <div className="card-bottom-actions"
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
            >
              {card.cta_url && (
                <a className="card-book-pill pressable" href={card.cta_url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}>
                  {card.cta_label || '📅 Learn More'}
                </a>
              )}
              {card.linked_slug && (
                <button className="card-chevron-btn pressable"
                  onPointerUp={e => { e.stopPropagation(); onDetail() }}
                  onClick={e => { e.stopPropagation(); onDetail() }}
                  aria-label="View place"
                >
                  ›
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DealSwipeCard({ deal, isTop, onDetail }) {
  if (!deal) return null

  const DEAL_COLORS = {
    charter_opening: { bg: 'linear-gradient(135deg,#0e5f8a,#0ea5e9)', badge: '🎣 Charter Spot' },
    last_minute:     { bg: 'linear-gradient(135deg,#b45309,#f59e0b)', badge: '⚡ Last Minute' },
    rental_gap:      { bg: 'linear-gradient(135deg,#065f46,#10b981)', badge: '🏠 Rental Opening' },
    session_opening: { bg: 'linear-gradient(135deg,#4c1d95,#8b5cf6)', badge: '📸 Photo Session' },
    happy_hour:      { bg: 'linear-gradient(135deg,#92400e,#d97706)', badge: '🍻 Happy Hour' },
    daily_special:   { bg: 'linear-gradient(135deg,#065f46,#34d399)', badge: '🌟 Daily Special' },
  }
  const style = DEAL_COLORS[deal.deal_type] || DEAL_COLORS.last_minute

  const spotsRemaining = deal.spots_remaining
  const spotsTotal = deal.spots_total
  const urgency = spotsRemaining !== null && spotsRemaining <= 2

  return (
    <div className={`business-card deal-swipe-card ${isTop ? 'top' : ''}`}>
      <div className="card-image-wrap" style={{ background: style.bg }}>
        {deal.image_url && (
          <img src={deal.image_url} alt={deal.entity_name} className="swipe-card-photo"
            style={{ opacity: 0.35 }}
            onError={e => { try { e.target.style.display = 'none' } catch {} }} />
        )}

        {/* Deal type badge top-left */}
        <div className="card-featured-badge" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          {style.badge}
        </div>

        {/* Urgency pulse top-right */}
        {urgency && (
          <div className="deal-swipe-urgent">🔴 URGENT</div>
        )}
      </div>

      {/* Info panel — same dark panel BusinessCard uses, not overlaid on
          the photo, so the deal's own gradient stays visible above it. */}
      <div className="card-info-panel" onClick={onDetail} role="button" tabIndex={0}>
        <div className="deal-swipe-entity">{deal.entity_name}</div>
        <div className="card-name-row">
          <h3 className="card-name">{deal.headline}</h3>
        </div>

        {(deal.deal_price || deal.price_label) && (
          <div className="card-price-hero">
            💵 {deal.price_label || `$${deal.deal_price}${deal.price_unit ? `/${deal.price_unit}` : ''}`}
          </div>
        )}

        {/* Spots bar */}
        {spotsRemaining !== null && spotsTotal && (
          <div className="deal-swipe-spots">
            <div className="deal-swipe-spots-text">
              {spotsRemaining === 0
                ? '🔴 Fully booked'
                : spotsRemaining === 1
                ? '🔴 Last spot!'
                : spotsRemaining <= 3
                ? `🟡 Only ${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} left`
                : `🟢 ${spotsRemaining} of ${spotsTotal} open`}
            </div>
            <div className="deal-swipe-bar">
              <div
                className="deal-swipe-bar-fill"
                style={{ width: `${Math.min(100, ((spotsTotal - spotsRemaining) / spotsTotal) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="deal-swipe-hint">← Swipe right to save · Tap for details →</div>

        {isTop && (
          <div className="card-bottom-row">
            <div className="card-bottom-actions"
              onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
            >
              {deal.claim_url && (
                <a className="card-book-pill pressable" href={deal.claim_url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}>
                  {deal.deal_type === 'charter_opening' ? '🎣 Grab This Spot' :
                   deal.deal_type === 'rental_gap' ? '🏠 Book Now' :
                   '📅 Claim Deal'}
                </a>
              )}
              <button className="card-chevron-btn pressable"
                onPointerUp={e => { e.stopPropagation(); onDetail() }}
                onClick={e => { e.stopPropagation(); onDetail() }}
                aria-label="View details"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Live music/concerts, events tonight, happy hours right now, and daily
// specials — one card, four looks (KIND_STYLE), so they all reuse the same
// business-card/deal-swipe-card CSS DealSwipeCard already relies on.
function EventSwipeCard({ card, isTop, onDetail }) {
  if (!card) return null

  const KIND_STYLE = {
    music:     { bg: 'linear-gradient(135deg,#4c1d95,#8b5cf6)', badge: '🎸 Live Music' },
    event:     { bg: 'linear-gradient(135deg,#0e5f8a,#0ea5e9)', badge: '🎉 Event Tonight' },
    happyhour: { bg: 'linear-gradient(135deg,#92400e,#d97706)', badge: '🍺 Happy Hour' },
    special:   { bg: 'linear-gradient(135deg,#065f46,#34d399)', badge: '⭐ Daily Special' },
  }
  const style = KIND_STYLE[card._eventKind] || KIND_STYLE.event

  return (
    <div className={`business-card deal-swipe-card ${isTop ? 'top' : ''}`}>
      <div className="card-image-wrap" style={{ background: style.bg }}>
        {card.hero_image_url && (
          <img src={card.hero_image_url} alt={card.name} className="swipe-card-photo"
            onError={e => { try { e.target.style.display = 'none' } catch {} }} />
        )}
        <div className="card-featured-badge" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          {style.badge}
        </div>
        {card._timeLabel && (
          <div className="deal-swipe-urgent" style={{ background: 'rgba(0,0,0,.55)' }}>🕒 {card._timeLabel}</div>
        )}
      </div>

      <div className="card-info-panel" onClick={onDetail} role="button" tabIndex={0}>
        {card._venueName && <div className="deal-swipe-entity">📍 {card._venueName}</div>}
        <div className="card-name-row">
          <h3 className="card-name">{card.name}</h3>
        </div>

        {card._eventKind === 'event' && card._coverCharge > 0 && (
          <div className="card-price-hero">💵 ${card._coverCharge} cover</div>
        )}
        {card._eventKind === 'event' && card._coverCharge === 0 && (
          <div className="card-price-hero">🎟️ Free</div>
        )}
        {card._eventKind === 'happyhour' && card._subtitle && (
          <div className="deal-swipe-spots-text">{card._subtitle}</div>
        )}
        {card._discountText && (
          <div className="card-price-hero">💵 {card._discountText}</div>
        )}

        <div className="deal-swipe-hint">
          {card._artistSlug ? '← Swipe right to save · Tap to see the artist →' : '← Swipe right to save · Tap for details →'}
        </div>

        {isTop && (
          <div className="card-bottom-row">
            <div className="card-bottom-actions"
              onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
            >
              <button className="card-chevron-btn pressable"
                onPointerUp={e => { e.stopPropagation(); onDetail() }}
                onClick={e => { e.stopPropagation(); onDetail() }}
                aria-label="View details"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SwipeIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path strokeLinecap="round" d="M8 12h8M15 9l3 3-3 3" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
