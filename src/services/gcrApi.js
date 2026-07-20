import { API_BASE } from '../config'
import { anonymousVisitorId } from '../context/AppContext'
import { subtypeToCategory } from '../categoryMap'

export function calcDistance(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function formatDistance(miles) {
  if (miles == null) return null
  if (miles < 0.1) return 'Here'
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

const GCR_API = `${API_BASE}/api/gcr`

// ─── In-memory response cache ──────────────────────────────────────────────
// The SPA has no router-level data cache, so every navigation (including
// back to a page you were just on) re-fetches over the network. This makes
// repeat views of the same URL within `ttlMs` return instantly instead.
// Keyed by URL, so any call site fetching the same endpoint shares a hit —
// e.g. a business card preview and its detail page reuse one cache entry.
const _responseCache = new Map() // url -> { data, expiresAt }

export async function cachedFetchJson(url, { ttlMs = 60000, options, errorMessage } = {}) {
  const cached = _responseCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  const r = await fetch(url, options)
  if (!r.ok) throw new Error(errorMessage || `Request failed (HTTP ${r.status})`)
  const data = await r.json()
  _responseCache.set(url, { data, expiresAt: Date.now() + ttlMs })
  return data
}

function mapCategory(entityType, tags = [], entitySubtype = '') {
  const check = s => (s || '').toLowerCase()
  const t = check(entityType)
  const sub = check(entitySubtype)
  const tagStr = (tags || []).join(' ').toLowerCase()
  const combined = t + ' ' + sub
  if (combined.includes('hotel') || combined.includes('resort') || combined.includes('rental') ||
      combined.includes('condo') || combined.includes('vacation') || combined.includes('accommodation') ||
      combined.includes('motel') || combined.includes('lodge') || combined.includes('cabin') ||
      combined.includes('airbnb') || combined.includes('vrbo'))
    return 'stay'
  if (combined.includes('restaurant') || combined.includes('coffee') || combined.includes('food') ||
      combined.includes('sweet') || combined.includes('cafe') || combined.includes('bakery') ||
      combined.includes('seafood') || combined.includes('pizza') || combined.includes('burger') ||
      combined.includes('sushi') || combined.includes('bbq') || combined.includes('grill') ||
      combined.includes('diner') || combined.includes('eatery') || combined.includes('kitchen'))
    return 'food'
  if (combined.includes('nightlife') || combined.includes('bar') || combined.includes('club') ||
      combined.includes('lounge') || combined.includes('brewery') || combined.includes('winery') ||
      combined.includes('distillery') || combined.includes('tavern') || combined.includes('pub') ||
      tagStr.includes('live music'))
    return 'nightlife'
  if (combined.includes('shop') || combined.includes('retail') || combined.includes('boutique') ||
      combined.includes('clothing') || combined.includes('store') || combined.includes('market') ||
      combined.includes('gallery') || combined.includes('souvenir') || combined.includes('gift'))
    return 'shopping'
  return 'activities'
}

function formatAddress(e) {
  const parts = [e.address_line_1, e.city, e.state].filter(Boolean)
  return parts.join(', ')
}

function formatHappyHour(e) {
  if (!e.hh_start || !e.hh_end) return null
  const t = (t24) => {
    if (!t24) return ''
    const [h, m] = t24.split(':')
    const hr = parseInt(h, 10)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr
    return `${h12}:${m} ${ampm}`
  }
  return `${t(e.hh_start)} - ${t(e.hh_end)}`
}

// Shared photo-URL normalizer — every image src anywhere in the app should
// pass through this before rendering.
export function fixUrl(u) {
  if (!u) return null
  if (u.startsWith('//')) u = 'https:' + u
  if (u.includes('googleapis.com') && u.includes('maxwidth=')) {
    u = u.replace(/maxwidth=\d+/, 'maxwidth=800')
  }
  // Some recovered photo URLs carry literal unencoded spaces in the
  // filename (e.g. ".../Phoenix East Complex 20.jpg") — a raw space is
  // not a valid URL character, so browsers load these inconsistently.
  // Only touch literal spaces so already percent-encoded URLs (e.g.
  // trackhs.com's %3A-encoded paths) aren't double-encoded.
  if (u.includes(' ')) u = u.replace(/ /g, '%20')
  return u
}

function toCard(entity, photos = []) {
  // tag_name is the field the API actually returns (GCRCard.jsx reads it too);
  // label/name/tag are legacy fallbacks. Without tag_name here, every tag
  // silently dropped out of the swipe cards — the tag row rendered empty on
  // real data even though the entities had tags.
  const tags = Array.isArray(entity.tags)
    ? entity.tags.map(t => typeof t === 'string' ? t : t.tag_name || t.label || t.name || t.tag).filter(Boolean)
    : []
  const swipeCurated = (photos || []).filter(p => p.usage_note === 'Trip Swipe')
  const galleryPhotos = swipeCurated.length > 0 ? swipeCurated : photos
  const gallery = [...new Set((galleryPhotos || []).map(p => fixUrl(p.url || p.image_url)).filter(Boolean))]
  const hero = fixUrl(entity.hero_image_url) || gallery[0] || null
  const hasLiveMusic = tags.some(t => /live\s*music/i.test(t))
  return {
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    subtitle: entity.subtitle || '',
    category: mapCategory(entity.entity_type, tags, entity.entity_subtype),
    // Separate from `category` (the crude 5-bucket system EntityCard/HubTemplate/
    // Home's category rails already depend on) -- this is the same real 9-way
    // split CategoryPage.jsx's nav uses (Restaurants/Coffee/Nightlife/Things To
    // Do/Shopping/Public Spots/Wellness/Marinas/Staying), so the swipe deck can
    // offer every real section on the platform without touching what `category`
    // means anywhere else it's already relied on.
    section: subtypeToCategory(entity) || 'services',
    type: entity.entity_subtype || entity.entity_type || '',
    rating: entity.rating || null,
    review_count: entity.review_count || 0,
    price_range: entity.price_range || '',
    hero_image_url: hero,
    photos: gallery,
    tags,
    tagline: entity.subtitle || '',
    happy_hour: formatHappyHour(entity),
    hh_description: entity.hh_description || '',
    hours: entity.hours || [],
    live_music: hasLiveMusic,
    city: [entity.city, entity.state].filter(Boolean).join(', '),
    address: formatAddress(entity),
    latitude: entity.latitude,
    longitude: entity.longitude,
    phone: entity.phone || '',
    website_url: entity.website_url || '',
    booking_url: entity.booking_url || entity.reservation_url || entity.order_url || '',
    directions_url: entity.directions_url || '',
    description: entity.description || '',
    verified: !!entity.featured,
    duration: entity.duration_text || null,
    price_per_person: (entity.price_from && entity.price_unit)
      ? `$${entity.price_from}${entity.price_to && entity.price_to !== entity.price_from ? `-$${entity.price_to}` : ''}/${entity.price_unit}`
      : null,
    social: {
      instagram: entity.social_instagram || '',
      facebook: entity.social_facebook || '',
      tiktok: entity.social_tiktok || '',
    },
    // Rental/unit details (condo units, beach houses) — listing cards show
    // beds/baths/sleeps/nightly price when the data exists
    is_active: entity.is_active,
    rental: entity.rental || null,
    unit_number: entity.unit_number || null,
    building: entity.building || null,
    view_type: entity.view_type || null,
    raw: entity,
  }
}

// Match GCR public's filters — test entities out, dedupe -1 duplicates
function isTestEntity(b) {
  const s = (b.slug || b.subdomain || '').toLowerCase()
  const n = (b.name || '').toLowerCase()
  const a = (b.address_line_1 || b.address || '').toLowerCase()
  return s.startsWith('gcr-upload-test') || s.startsWith('888') ||
         n.includes('upload test') || n.startsWith('888') ||
         a.includes('test lane')
}

function dedupeBusinesses(raw) {
  const slugSet = new Set()
  return raw.filter(b => {
    const s = b.slug || b.subdomain || ''
    if (slugSet.has(s)) return false
    if (s.match(/-1$/) && raw.some(o => (o.slug || o.subdomain) === s.replace(/-1$/, ''))) return false
    slugSet.add(s)
    return true
  })
}

export async function fetchBusinesses({ limit = 50 } = {}) {
  const r = await fetch(`${GCR_API}/entities?limit=${limit}`)
  if (!r.ok) throw new Error(`Failed to load businesses (HTTP ${r.status})`)
  const d = await r.json()
  const entities = d.entities || d.businesses || []
  const clean = dedupeBusinesses(entities.filter(e => e && e.id && e.name && !isTestEntity(e)))
  const cards = clean.map(e => toCard(e, e.photos || []))

  const API = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

  // Merge TripSwipe-specific overrides and fetch tonight cards in parallel
  let mergedCards = cards
  try {
    const timeout = AbortSignal.timeout(4000)
    const [sr, pr, sponsoredR] = await Promise.all([
      fetch(`${API}/api/admin/tripswipe/settings`, { signal: timeout }).catch(() => null),
      fetch(`${API}/api/admin/tripswipe/promo-cards`, { signal: timeout }).catch(() => null),
      fetch(`${API}/api/admin/tripswipe/sponsored`, { signal: timeout }).catch(() => null),
    ])

    // Apply business settings (enabled flag, custom images)
    if (sr?.ok) {
      const sd = await sr.json()
      const list = Array.isArray(sd?.settings) ? sd.settings : Array.isArray(sd) ? sd : []
      if (list.length > 0) {
        const settings = {}
        list.forEach(s => { if (s?.slug) settings[s.slug] = s })
        mergedCards = mergedCards
          .filter(c => settings[c.slug]?.enabled !== false)
          .map(c => {
            const s = settings[c.slug]
            if (!s) return c
            return {
              ...c,
              hero_image_url: s.hero_image || c.hero_image_url,
              photos: Array.isArray(s.extra_images) && s.extra_images.length ? [...s.extra_images, ...(c.photos || [])] : c.photos,
            }
          })
      }
    }

    // Inject tonight's promo cards at the front of the deck
    if (pr?.ok) {
      const pd = await pr.json()
      const today = new Date().toISOString().slice(0, 10)
      const promos = (pd.cards || [])
        .filter(p => p.active && (!p.show_date || p.show_date === today))
        .map(p => ({
          id: 'promo-' + p.id,
          slug: 'promo-' + p.id,
          _isPromo: true,
          name: p.title,
          subtitle: p.cta_label || '',
          description: p.description || '',
          hero_image_url: p.image_url || null,
          photos: p.image_url ? [p.image_url] : [],
          tags: [],
          city: p.city || '',
          category: p.category || 'all',
          rating: null,
          verified: false,
          linked_slug: p.linked_slug || null,
          cta_label: p.cta_label || 'Learn More',
          booking_url: p.cta_url || null,
        }))
      // Promos go at the END of the array = top of the deck (TinderCard renders last element on top)
      mergedCards = [...mergedCards, ...promos]
    }

    // Inject last-minute deals (today/tomorrow only, swipe_card=true)
    // Deals appear at the very top of the deck so they're seen first
    try {
      const dealR = await fetch(`${API}/api/deals/swipe`, { signal: AbortSignal.timeout(3000) }).catch(() => null)
      if (dealR?.ok) {
        const dealData = await dealR.json()
        const today = new Date().toISOString().slice(0, 10)
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        const deals = (Array.isArray(dealData) ? dealData : [])
          .filter(d => d.is_today_only || d.valid_date === today || d.valid_date === tomorrow)
          .slice(0, 5) // max 5 deal cards in the deck at once
          .map(d => ({
            id: 'deal-' + d.id,
            slug: 'deal-' + d.id,
            _isDeal: true,
            _dealData: d,
            name: d.entity_name || 'Last Minute Deal',
            subtitle: d.headline || '',
            description: d.description || '',
            hero_image_url: d.image_url || null,
            photos: d.image_url ? [d.image_url] : [],
            tags: [],
            city: '',
            category: 'all',
            rating: null,
            verified: false,
            booking_url: d.claim_url || null,
            phone: d.claim_phone || null,
            entity_slug: d.entity_slug || null,
            spots_remaining: d.spots_remaining,
            spots_total: d.spots_total,
            deal_type: d.deal_type,
          }))
        // Deal cards go on top of everything — they're urgent
        mergedCards = [...mergedCards, ...deals]
      }
    } catch (e) {}

    // Inject sponsored cards every N positions throughout the deck
    if (sponsoredR?.ok) {
      const sd = await sponsoredR.json()
      const sponsors = (sd.sponsored || [])
        .filter(s => s.active && Array.isArray(s.images) && s.images.length > 0)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))

      if (sponsors.length > 0) {
        const imgCursors = {}
        const result = []
        let regularCount = 0
        let sponsorTurn = 0

        for (const card of mergedCards) {
          result.push(card)
          if (!card._isPromo) regularCount++

          const sponsor = sponsors[sponsorTurn % sponsors.length]
          const freq = sponsor.frequency || 10
          if (regularCount > 0 && !card._isPromo && regularCount % freq === 0) {
            const imgIdx = imgCursors[sponsor.slug] || 0
            imgCursors[sponsor.slug] = imgIdx + 1
            const img = sponsor.images[imgIdx % sponsor.images.length]
            const realCard = mergedCards.find(c => c.slug === sponsor.slug) || null
            result.push({
              ...(realCard || {}),
              id: `sponsored-${sponsor.slug}-${imgIdx}`,
              slug: `sponsored-${sponsor.slug}-${imgIdx}`,
              name: realCard?.name || sponsor.business_name || sponsor.slug,
              hero_image_url: img,
              photos: [img, ...(realCard?.photos || []).filter(p => p !== img)],
              tags: realCard?.tags || [],
              category: realCard?.category || 'all',
              city: realCard?.city || '',
              rating: realCard?.rating || null,
              verified: realCard?.verified || false,
              description: realCard?.description || '',
              subtitle: realCard?.subtitle || '',
              _isSponsored: true,
              _sponsorSlug: sponsor.slug,
            })
            sponsorTurn++
          }
        }
        mergedCards = result
      }
    }
  } catch (e) {}

  // Expand each business into multiple cards (one per image, randomized order)
  const expandedCards = []
  for (const card of mergedCards) {
    if (!card.photos || card.photos.length === 0) {
      // No photos, add as single card
      expandedCards.push(card)
    } else {
      // Shuffle image indices for random order
      const indices = Array.from({ length: card.photos.length }, (_, i) => i)
      for (let j = indices.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [indices[j], indices[k]] = [indices[k], indices[j]]
      }

      // Create one card instance per photo (in randomized order)
      for (let i = 0; i < indices.length; i++) {
        const photoIdx = indices[i]
        expandedCards.push({
          ...card,
          photos: [], // Empty photos array - each card has only its single hero_image_url
          id: `${card.id}-img${i}`,
          _image_index: i,
          _total_images: card.photos.length,
          hero_image_url: card.photos[photoIdx] || card.hero_image_url,
        })
      }
    }
  }

  return expandedCards
}

// Fetch live-now businesses — happy hours active, events tonight, specials
// Pass touristId to personalize sort order by preference match
export async function fetchLiveNow(touristId = null) {
  const qs = touristId ? `?tourist_id=${touristId}&limit=20` : '?limit=20'
  try {
    const r = await fetch(`${GCR_API}/live-now${qs}`)
    if (!r.ok) return []
    const d = await r.json()
    return d.results || []
  } catch {
    return []
  }
}

// Fetch this user's preference scores — returns a tag→score map
export async function fetchPreferences() {
  const token = localStorage.getItem('gcr_access_token')
  // A guest's own in-session swipes/saves are already being recorded under
  // their guest id (see AppContext's authHeaders) — fetch by the same id so
  // their live deck can personalize immediately instead of only after they
  // sign up.
  const headers = token ? { Authorization: `Bearer ${token}` } : { 'X-Guest-Id': anonymousVisitorId() }
  try {
    const r = await fetch(`${API_BASE}/api/tourist/preferences`, { headers })
    if (!r.ok) return {}
    const d = await r.json()
    const map = {}
    for (const s of [...(d.loves || []), ...(d.likes || []), ...(d.dislikes || [])]) {
      map[s.tag.toLowerCase().trim()] = s.score
    }
    return map
  } catch {
    return {}
  }
}

// Score a card against user preference map — higher = better match
// Returns a number: positive = good match, negative = bad match, 0 = no data
export function scoreCard(card, prefMap) {
  if (!prefMap || !Object.keys(prefMap).length) return 0
  let score = 0
  const cardTags = new Set([
    ...(card.tags || []).map(t => t.toLowerCase().trim()),
    card.category?.toLowerCase().trim(),
    card.type?.toLowerCase().trim(),
  ].filter(Boolean))

  for (const tag of cardTags) {
    if (prefMap[tag] != null) score += prefMap[tag]
  }
  return score
}

// Sort deck by preference match — blends personalization with discovery randomness
// Top 60% of deck sorted by match score, bottom 40% random (keeps discovery alive)
export function personalizeAndSort(cards, prefMap) {
  if (!prefMap || !Object.keys(prefMap).length) return cards

  const scored = cards.map(c => ({ card: c, score: scoreCard(c, prefMap) }))

  // Separate: has a preference signal vs no signal
  const hasSignal = scored.filter(s => s.score !== 0)
  const noSignal  = scored.filter(s => s.score === 0)

  // Sort by score descending (best match first)
  hasSignal.sort((a, b) => b.score - a.score)

  // Shuffle the no-signal cards for discovery
  for (let j = noSignal.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [noSignal[j], noSignal[k]] = [noSignal[k], noSignal[j]]
  }

  // Interleave: for every 2 matched cards, inject 1 discovery card
  // This keeps the top of the deck feeling personalized without killing discovery
  const result = []
  let mi = 0, ni = 0
  while (mi < hasSignal.length || ni < noSignal.length) {
    if (mi < hasSignal.length) result.push(hasSignal[mi++])
    if (mi < hasSignal.length) result.push(hasSignal[mi++])
    if (ni < noSignal.length)  result.push(noSignal[ni++])
  }

  return result.map(s => ({
    ...s.card,
    _matchScore: s.score,
  }))
}

export async function fetchBusinessBySlug(slug) {
  // 120s TTL matches the API's own Cache-Control max-age for this endpoint
  // (routes/gcr.js `/entity/:slug`) so the browser HTTP cache and this JS
  // cache agree on freshness.
  const d = await cachedFetchJson(`${GCR_API}/entity/${encodeURIComponent(slug)}`, {
    ttlMs: 120000,
    errorMessage: `Failed to load ${slug}`,
  })

  // API returns a flat object — not wrapped in d.entity
  // All entity fields (name, slug, description, etc.) are at the top level of d
  const photos = d.photos || []
  const card = toCard(d, photos)

  // Normalize tags — entity_tags come back as objects with tag_name
  const enrichedTags = (d.tags || []).map(t => {
    if (typeof t === 'string') return t
    return t.tag_name || t.tag || t.label || t.name || null
  }).filter(Boolean)

  return {
    ...card,
    // Spread all raw entity fields so any column on the entity table
    // is available to the UI without needing explicit mapping
    ...d,
    // Override specific fields with normalized versions
    tags:                enrichedTags.length ? enrichedTags : card.tags,
    photos:              card.photos,
    hero_image_url:      card.hero_image_url,
    booking_url:         card.booking_url,
    // fix key mismatch: DB good_for_kids → UI good_for_children
    good_for_children:   d.good_for_children ?? d.good_for_kids ?? null,
    // Tables — use exact key names the API returns
    sections:            d.sections            || [],
    hours:               d.hours               || [],
    secondary_hours:     d.secondary_hours     || [],
    about_bullets:       d.about_bullets       || [],
    perfect_for:         d.perfect_for         || [],
    social_posts:        d.social_posts        || [],
    faqs:                d.faqs                || [],
    team:                d.team                || [],
    policies:            d.policies            || [],
    announcements:       d.announcements       || [],
    blog_posts:          d.blog_posts          || [],
    events:              d.events              || [],
    reviews:             d.reviews             || [],
    specials:            d.specials            || [],
    // Food
    menu_sections:       d.menu_sections       || [],
    drink_sections:      d.drink_sections      || [],
    happy_hour_sections: d.happy_hour_sections || [],
    hh_sections:         d.happy_hour_sections || [], // alias for UI inconsistency
    sides:               d.sides               || [],
    daily_features:      d.daily_features      || [],
    order_links:         d.order_links         || [],
    // Activity
    pricing:             d.pricing             || [],
    whats_included:      d.whats_included      || [],
    requirements:        d.requirements        || [],
    schedules:           d.schedules           || [],
    meeting_points:      d.meeting_points      || [],
    activity_options:    d.activity_options    || [],
    fish_species:        d.fish_species        || [],
    what_to_bring:       d.what_to_bring       || [],
    activity_details:    d.activity_details    || null,
    // Stay
    property_details:    d.property_details    || null,
    room_types:          d.room_types          || [],
    amenities:           d.amenities           || [],
    property_fees:       d.property_fees       || [],
    stay_links:          d.stay_links          || [],
    availability:        d.availability        || [],
    bookable_resources:  d.bookable_resources  || [],
    // Service
    service_categories:  d.service_categories  || [],
    service_menu:        d.service_menu        || [],
    service_packages:    d.service_packages    || [],
    class_schedule:      d.class_schedule      || [],
    // Shopping
    product_categories:  d.product_categories  || [],
    products:            d.products            || [],
    // Park
    facilities:          d.facilities          || [],
    spot_rules:          d.spot_rules          || [],
    access_info:         d.access_info         || null,
    // Loyalty
    loyalty_program:     d.loyalty_program     || null,
    // Modules
    modules:             d.modules             || [],
    module_keys:         d.module_keys         || [],
  }
}

// Fetch child rental units for a parent property
export async function fetchChildRentals(parentSlug, filters = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.beds) params.append('beds', filters.beds)
    if (filters.baths) params.append('baths', filters.baths)
    if (filters.price_min) params.append('price_min', filters.price_min)
    if (filters.price_max) params.append('price_max', filters.price_max)

    const qs = params.toString() ? '?' + params.toString() : ''
    const r = await fetch(`${GCR_API}/entities/${encodeURIComponent(parentSlug)}/children${qs}`)
    if (!r.ok) return []

    const d = await r.json()
    const children = d.children || []

    // Convert each child to a card
    return children.map(entity => toCard(entity, []))
  } catch {
    return []
  }
}

// Search for properties/hotels by name for autocomplete
export async function searchProperties(query) {
  if (!query || query.length < 1) return []
  try {
    const r = await fetch(`${GCR_API}/entities?search=${encodeURIComponent(query)}&limit=10`)
    if (!r.ok) return []
    const d = await r.json()
    const entities = d.entities || []
    // Return basic info for autocomplete
    return entities.map(e => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      city: e.city || 'Gulf Coast',
      type: e.entity_subtype || e.entity_type || 'Property'
    }))
  } catch {
    return []
  }
}

// Save an item to tourist's favorites
export async function saveItem(entitySlug) {
  const token = localStorage.getItem('gcr_access_token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  try {
    const r = await fetch(`${API_BASE}/api/tourist/saves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ entity_slug: entitySlug })
    })

    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to save item')
    }

    return await r.json()
  } catch (err) {
    throw err
  }
}

// Remove a saved item
export async function unsaveItem(entitySlug) {
  const token = localStorage.getItem('gcr_access_token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  try {
    const r = await fetch(`${API_BASE}/api/tourist/saves/${encodeURIComponent(entitySlug)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to remove save')
    }

    return await r.json()
  } catch (err) {
    throw err
  }
}

export async function fetchHomeFeed() {
  try {
    const r = await fetch(`${GCR_API}/home-feed`);
    if (!r.ok) throw new Error('home-feed failed');
    return await r.json();
  } catch {
    return { events: [], specials: [], happyHours: [], liveMusic: [], thingsToDo: [] };
  }
}
