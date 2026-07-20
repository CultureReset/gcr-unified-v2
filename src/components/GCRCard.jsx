import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subtypeToCategory } from '../categoryMap'
import './GCRCard.css'

// ── Map API tag_category → display section ────────────────────────────────────
const API_CAT_MAP = {
  cuisine: 'food', dietary: 'food',
  drink: 'drink', beverage: 'drink',
  vibe: 'vibe', atmosphere: 'vibe', activity: 'vibe', experience: 'vibe',
  feature: 'service', audience: 'service', amenity: 'service',
}


export const TAG_EMOJI = {
  seafood:'🦐', fresh_seafood:'🦐', raw_bar:'🦪', fish_tacos:'🌮', burgers:'🍔',
  pizza:'🍕', sushi:'🍣', wings:'🍗', steaks:'🥩', bbq:'🔥', breakfast:'🍳',
  brunch:'🥞', sunday_brunch:'🥂', dessert:'🍰', ice_cream:'🍦', vegan:'🥗',
  gluten_free:'✓', gluten_free_menu:'✓', happy_hour_food:'🏷️', catch_of_the_day:'🐟',
  beer:'🍺', wine:'🍷', cocktails:'🍸', coffee:'☕', full_bar:'🍹',
  tiki_cocktails:'🌺', frozen_drinks:'🧃', craft_beer:'🍺', great_wine_list:'🍷',
  great_coffee:'☕', bar_onsite:'🍹',
  waterfront:'🌊', waterfront_dining:'🌊', beachfront:'🏖️', dockside:'⚓',
  outdoor_seating:'🌿', patio:'🌿', rooftop:'🌆', live_music:'🎸', live_dj:'🎧',
  karaoke:'🎤', trivia:'🧠', sports_tv:'📺', pet_friendly:'🐾', dogs_allowed:'🐾',
  romantic:'❤️', family_friendly:'👨‍👩‍👧', casual:'😎', upscale:'✨', trendy:'🔥',
  marina_view:'⛵', sunset_view:'🌅', sunset_views:'🌅', sunset_cruise:'🌅',
  ocean_view:'🌊', bay_view:'🌅', gulf_view:'🌊',
  dolphin_cruise:'🐬', glass_bottom_boat:'🚢', boat_tours:'⛵',
  wildlife_tours:'🦜', water_activities:'🌊', unique_experience:'⭐',
  delivery:'🛵', takeout:'🥡', dine_in:'🍽️', wheelchair_accessible:'♿',
  good_for_kids:'👶', good_for_groups:'👥', parking:'🅿️', free_parking:'🅿️',
  boat_slips:'⛵', boat_access:'⚓', catering_available:'🍽️',
  private_dining_room:'🚪', wi_fi:'📶', high_chairs:'👶',
}

const FOOD_CATEGORIES = new Set(['restaurants','coffee-sweets','coffee','nightlife','happy-hours'])

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2,'0')}${ap}` : `${h12}${ap}`
}

function getTodayHours(hours) {
  if (!hours || !hours.length) return null
  const todayIdx = new Date().getDay() // 0=Sun, 1=Mon...
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const todayName = DAYS[todayIdx]
  return hours.find(h => {
    // day_of_week can be a number (0-6) or a string ("monday")
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

function computeHoursLine(hours) {
  const h = getTodayHours(hours)
  if (!h) return ''
  if (h.is_closed) return 'Closed Today'
  const o = h.open_time  || h.opens_at  || h.open  || ''
  const c = h.close_time || h.closes_at || h.close || ''
  if (!o || !c) return ''
  return `${fmt12(o)} – ${fmt12(c)}`
}

const STATUS_LABELS = { open: 'Open Now', opening: 'Opening Soon', closing: 'Closing Soon', closed: 'Closed' }

function fmtDist(miles) {
  if (miles == null) return null
  if (miles < 0.1) return 'Here'
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

export default function GCRCard({ entity, category, onSave, savedSlugs }) {
  const navigate = useNavigate()
  const [showHH, setShowHH] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  if (!entity) return null

  const distLabel = fmtDist(entity.distance_miles)
  const slug = entity.slug || entity.subdomain || entity.id || ''
  const name = entity.name || 'Business'
  const icon = entity.icon || entity.emoji || '📍'
  const sub = entity.subtitle || ''
  const rawSubtype = (entity.entity_subtype || entity.entity_type || entity.type || '').toLowerCase()
  const subtypeKey = rawSubtype.replace(/-/g, '_')
  const subtype = rawSubtype.replace(/_/g, ' ')
  const city = entity.city || ''
  const state = entity.state || ''
  const location = [city, state].filter(Boolean).join(', ')
  const addr = entity.address_line_1 || entity.address || ''
  const fullAddr = [addr, city, state].filter(Boolean).join(', ')

  // Find best photo: prefer cover photo, then first photo, then hero/cover fields
  const coverPhoto = entity.photos?.find(p => p.is_cover) || entity.photos?.[0]
  const hero = entity.hero_image_url || entity.cover_url ||
    coverPhoto?.url || coverPhoto?.image_url ||
    null

  const phone = entity.phone || ''
  const dir = entity.directions_url || ''
  const bookingUrl = entity.booking_url || ''
  const reservationUrl = entity.reservation_url || ''
  const orderUrl = entity.order_url || ''
  const menuUrl = entity.menu_url || ''
  const websiteUrl = entity.website_url || ''
  const desc = entity.description || ''
  const rating = entity.rating
  const reviews = entity.review_count || 0

  const hhDays = entity.hh_days || ''
  const hhStart = entity.hh_start || ''
  const hhEnd = entity.hh_end || ''
  const hhDesc = entity.hh_description || ''

  // Single source of truth for "is this a things-to-do entity" — categoryMap.js
  // already classifies every subtype we route to /things-to-do; a separately
  // maintained list here drifts out of sync as new subtypes get added there.
  const isActivity = subtypeToCategory(entity) === 'things-to-do'
  const isSaved = savedSlugs?.has(slug)
  const entityTypeMain = (entity.entity_type || '').toLowerCase()
  const isFoodPage = FOOD_CATEGORIES.has(category)
  const isFood = entityTypeMain === 'food' || isFoodPage ||
    ['restaurant','bar','cafe','coffee','bakery','food','nightlife','pizza','seafood','grill','bistro','diner','bbq'].some(w => rawSubtype.includes(w))

  // Status badge
  const status = computeStatus(entity.hours || [])

  // Hours line
  const hoursLine = computeHoursLine(entity.hours || [])

  // Tags — fully dynamic: display whatever is in the DB, use tag_category from API.
  // Skip the raw Google Places taxonomy categories (machine tokens, not
  // consumer copy) and any label that's still a machine slug (snake_case
  // like point_of_interest, or camelCase like wheelchairAccessibleParking).
  const SKIP_CATS = new Set(['location', 'google_type', 'google_types', 'google_primary_type', 'google_secondary_type'])
  const isMachineSlug = (s) =>
    (/_/.test(s) && s === s.toLowerCase()) ||   // snake_case: point_of_interest
    (/^[a-z]+[A-Z]/.test(s) && !/\s/.test(s))    // camelCase: acceptsDebitCards
  const sections = { food: [], drink: [], vibe: [], service: [], other: [] }
  const seenLabels = new Set()

  const addChip = (label, cat, emojiOverride) => {
    const section = cat && sections[cat] ? cat : 'other'
    if (sections[section].length >= 10) return
    if (seenLabels.has(label.toLowerCase())) return
    seenLabels.add(label.toLowerCase())
    const key = label.toLowerCase().replace(/[\s\-\/]+/g, '_').replace(/[^a-z0-9_]/g, '')
    const emoji = emojiOverride || TAG_EMOJI[key] || ''
    sections[section].push({ emoji, label, cat: section })
  }

  ;(entity.tags || []).forEach(t => {
    const label = (typeof t === 'string' ? t : (t.tag_name || t.tag || '')).trim()
    if (!label) return
    const apiCat = typeof t === 'object' ? (t.tag_category || '') : ''
    if (SKIP_CATS.has(apiCat)) return
    if (isMachineSlug(label)) return
    const cat = API_CAT_MAP[apiCat] || null
    addChip(label, cat)
  })

  // Boolean field fallbacks
  if (entity.waterfront)                        addChip('Waterfront',        'vibe',    '🌊')
  if (entity.live_music)                        addChip('Live Music',        'vibe',    '🎸')
  if (entity.outdoor_seating)                   addChip('Outdoor Seating',   'vibe',    '🌿')
  if (entity.good_for_watching_sports)          addChip('Sports Bar',        'vibe',    '📺')
  if (entity.allows_dogs)                       addChip('Dog Friendly',      'vibe',    '🐕')
  // Universal chips (any business type)
  if (entity.wheelchair_accessible_entrance || entity.wheelchair_accessible) addChip('Accessible', 'service', '♿')
  if (entity.good_for_children)                 addChip('Kid Friendly',      'service', '👶')
  if (entity.good_for_groups)                   addChip('Good for Groups',   'service', '👥')
  // Food-only chips — only show for restaurants/bars/cafes
  if (isFood) {
    if (entity.delivery)                        addChip('Delivery',          'service', '🛵')
    if (entity.takeout)                         addChip('Takeout',           'service', '🥡')
    if (entity.dine_in)                         addChip('Dine-in',           'service', '🍽️')
    if (entity.curbside_pickup)                 addChip('Curbside',          'service', '🚗')
    if (entity.reservable)                      addChip('Reservations',      'service', '📅')
    if (entity.serves_breakfast)                addChip('Breakfast',         'food',    '🍳')
    if (entity.serves_brunch)                   addChip('Brunch',            'food',    '🥂')
    if (entity.serves_lunch)                    addChip('Lunch',             'food',    '🥗')
    if (entity.serves_dinner)                   addChip('Dinner',            'food',    '🍷')
    if (entity.serves_vegetarian)               addChip('Vegetarian',        'food',    '🥦')
    if (entity.serves_dessert)                  addChip('Dessert',           'food',    '🍰')
    if (entity.serves_coffee)                   addChip('Coffee',            'drink',   '☕')
    if (entity.serves_beer)                     addChip('Beer',              'drink',   '🍺')
    if (entity.serves_wine)                     addChip('Wine',              'drink',   '🍷')
    if (entity.serves_cocktails)                addChip('Cocktails',         'drink',   '🍹')
  }

  // rawTags kept for live_music detection & image badges
  const rawTags = (entity.tags || [])
    .map(t => (typeof t === 'string' ? t : (t.tag_name || t.tag || '')).trim().toLowerCase().replace(/[\s\-\/]+/g, '_').replace(/[^a-z0-9_]/g, ''))
    .filter(Boolean)

  const SECTION_LABELS = { food: 'Food', drink: 'Drinks', vibe: 'Vibe', service: 'Features', other: 'More' }
  const hasAnySections = Object.values(sections).some(a => a.length > 0)

  // Live music detection
  const hasLiveMusic = rawTags.some(t => t.includes('live_music') || t.includes('live music')) || entity.live_music

  // Image badges
  const imgBadges = [
    hasLiveMusic ? '🎸 Live Music' : null,
    (entity.waterfront || rawTags.includes('waterfront')) ? '🌊 Waterfront' : null,
    (entity.outdoor_seating || rawTags.includes('outdoor_seating')) ? '🌿 Outdoor' : null,
  ].filter(Boolean)

  // Price
  const pFrom = entity.price_from
  const pUnit = entity.price_unit || ''
  const priceRange = entity.price_range || ''
  const priceLevel = entity.price_level ? '💰'.repeat(Math.min(entity.price_level, 4)) : null

  // All entity table records go to /business/:slug — reads from entity table via /api/gcr/entity/:slug
  // /rental/:slug and /service/:slug are for bookable_resources (separate booking system)
  const profileUrl = `/business/${slug}`

  // Dedupe action URLs
  const usedUrls = new Set()
  const dedupeUrl = (url) => {
    if (!url) return null
    const key = url.replace(/https?:\/\//, '').replace(/\/$/, '').split('?')[0]
    if (usedUrls.has(key)) return null
    usedUrls.add(key)
    return url
  }

  const dedupedBook = dedupeUrl(bookingUrl)
  const dedupedReserve = dedupeUrl(reservationUrl)
  const dedupedOrder = dedupeUrl(orderUrl)
  const dedupedDir = dedupeUrl(dir)

  return (
    <div className="gcr-card" onClick={() => navigate(profileUrl)}>
      {/* Image */}
      <div className="gcr-card-img">
        {hero && !imgFailed ? (
          <img
            src={hero}
            alt=""
            className="gcr-card-img-bg"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          // No photo, or the photo URL is dead — a remote fallback image can
          // itself go dead, so this placeholder is CSS-only with no network
          // dependency, rather than looping back to another external URL.
          <div className="gcr-card-img-placeholder">
            <span>{icon}</span>
          </div>
        )}
        <div className="gcr-card-badge">{icon} {subtype}</div>

        {/* Live availability badge — today/tomorrow only */}
        {entity.spots_remaining != null && entity.spots_remaining <= 5 && (
          <div className={`gcr-avail-badge ${entity.spots_remaining === 0 ? 'avail-full' : entity.spots_remaining <= 2 ? 'avail-critical' : 'avail-low'}`}>
            {entity.spots_remaining === 0
              ? '🔴 Full'
              : entity.spots_remaining === 1
              ? '🔴 Last spot!'
              : `🟡 ${entity.spots_remaining} left`}
          </div>
        )}

        {status && (
          <div className={`gcr-badge-status status-${status.cls}`}>
            {status.label}
          </div>
        )}

        <button
          className={`gcr-save-btn ${isSaved ? 'saved' : ''}`}
          onClick={e => { e.stopPropagation(); onSave?.({ ...entity, category }) }}
        >
          {isSaved ? '❤️' : '🤍'}
        </button>

        {imgBadges.length > 0 && (
          <div className="gcr-img-badges">
            {imgBadges.map((b, i) => (
              <span key={i} className="img-badge">{b}</span>
            ))}
          </div>
        )}

        {priceRange && <div className="gcr-badge-price">{priceRange}</div>}
        {distLabel && <div className="gcr-badge-dist">📍 {distLabel}</div>}
      </div>

      {/* Body */}
      <div className="gcr-card-body">
        <div className="gcr-card-name">{name}</div>
        {(sub || location) && (
          <div className="gcr-card-sub">{[sub, location].filter(Boolean).join(' · ')}</div>
        )}

        {desc && <div className="gcr-card-desc">{desc}</div>}

        {(rating || priceLevel) && (
          <div className="gcr-card-rating">
            {rating && <>⭐ {Number(rating).toFixed(1)}{reviews > 0 && <span className="review-count">({reviews})</span>}</>}
            {rating && priceLevel && <span className="rating-sep"> · </span>}
            {priceLevel && <span className="price-level">{priceLevel}</span>}
          </div>
        )}

        {/* Tag Sections */}
        {hasAnySections ? (
          <div className="gcr-tag-sections">
            {Object.entries(sections).filter(([, chips]) => chips.length > 0).map(([cat, chips]) => (
              <div key={cat} className="gcr-tag-row">
                <div className="gcr-tag-row-label">{SECTION_LABELS[cat]}</div>
                <div className="gcr-tag-scroll">
                  {chips.map((chip, i) => (
                    <span key={i} className={`gcr-chip ${cat}`}>
                      {chip.emoji ? `${chip.emoji} ` : ''}{chip.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Activity Info */}
        {isActivity && (
          <div className="gcr-activity-info">
            {entity.duration_text && <div className="activity-row">⏱ {entity.duration_text}</div>}
            {entity.capacity_max && <div className="activity-row">👥 Up to {entity.capacity_max} people</div>}
            {pFrom != null && (
              <div className="activity-price">
                {pFrom === 0 || pFrom === '0' ? '✓ Free' : `From $${pFrom}${pUnit ? `/${pUnit}` : ''}`}
              </div>
            )}
          </div>
        )}

        {/* Price for non-activity */}
        {!isActivity && pFrom != null && (
          <div className="gcr-price-info">
            💵 {pFrom === 0 || pFrom === '0' ? 'Free' : `From $${pFrom}${pUnit ? `/${pUnit}` : ''}`}
          </div>
        )}
      </div>

      {/* Info Rows */}
      {!isActivity && (hoursLine || hhDays || hasLiveMusic) && (
        <div className="gcr-info-rows">
          {hoursLine && <div className="gcr-info-row gcr-hours">🕐 {hoursLine}</div>}
          {hhDays && (
            <div className="gcr-info-row gcr-hh">
              🍺 Happy Hour {hhDays}{hhStart ? ` · ${fmt12(hhStart)}` : ''}{hhEnd ? `–${fmt12(hhEnd)}` : ''}
            </div>
          )}
          {hasLiveMusic && <div className="gcr-info-row gcr-music">🎸 Live Music</div>}
        </div>
      )}

      {/* Bottom */}
      <div className="gcr-card-bottom">
        {(fullAddr || location || distLabel) && (
          <div className="gcr-card-addr">
            📍 {fullAddr || location}{distLabel ? ` · ${distLabel} away` : ''}
          </div>
        )}
        <div className="gcr-card-actions" onClick={e => e.stopPropagation()}>
          {isActivity ? (
            <>
              {dedupedBook
                ? <a href={dedupedBook} target="_blank" rel="noopener" className="gcr-btn primary">📅 Book Now</a>
                : <a href={profileUrl} className="gcr-btn primary" onClick={e => { e.preventDefault(); navigate(profileUrl) }}>View Profile</a>
              }
              {dedupedDir && <a href={dedupedDir} target="_blank" rel="noopener" className="gcr-btn">📍 Directions</a>}
              {phone && <a href={`tel:${phone.replace(/\D/g,'')}`} className="gcr-btn">📞 Call</a>}
            </>
          ) : (
            <>
              <a href={profileUrl} className="gcr-btn primary" onClick={e => { e.preventDefault(); navigate(profileUrl) }}>View Profile</a>
              {isFoodPage && (
                menuUrl
                  ? <a href={menuUrl} target="_blank" rel="noopener" className="gcr-btn">🍽️ Menu</a>
                  : <a href={profileUrl} className="gcr-btn" onClick={e => { e.preventDefault(); navigate(profileUrl) }}>🍽️ Menu</a>
              )}
              {(hhDays || entity.hh_sections?.length > 0) && (
                <button className="gcr-btn hh" onClick={e => { e.stopPropagation(); setShowHH(!showHH) }}>
                  🍺 Happy Hour
                </button>
              )}
              {dedupedBook && <a href={dedupedBook} target="_blank" rel="noopener" className="gcr-btn">📅 Book</a>}
              {dedupedReserve && <a href={dedupedReserve} target="_blank" rel="noopener" className="gcr-btn">🍽️ Reserve</a>}
              {dedupedOrder && <a href={dedupedOrder} target="_blank" rel="noopener" className="gcr-btn">🛵 Order</a>}
              {dedupedDir && <a href={dedupedDir} target="_blank" rel="noopener" className="gcr-btn">📍 Directions</a>}
              {phone && <a href={`tel:${phone.replace(/\D/g,'')}`} className="gcr-btn">📞 Call</a>}
            </>
          )}
        </div>
      </div>

      {/* Happy Hour Panel */}
      {showHH && (hhDays || entity.hh_sections?.length) && (
        <div className="gcr-hh-panel" onClick={e => e.stopPropagation()}>
          <div className="hh-title">🍺 Happy Hour</div>
          {hhDays && <div className="hh-time">{hhDays}{hhStart ? ` · ${fmt12(hhStart)}` : ''}{hhEnd ? ` – ${fmt12(hhEnd)}` : ''}</div>}
          {hhDesc && <div className="hh-desc">{hhDesc}</div>}
          {(() => {
            const sections = (entity.hh_sections || []).concat(entity.happy_hour_sections || [])
            const items = []
            sections.forEach(sec => {
              (sec.items || sec.happy_hour_items || []).forEach(item => {
                items.push({ section: sec.section_name || sec.name || '', ...item })
              })
            })
            if (!items.length) return null
            return (
              <div className="hh-items">
                {items.map((item, i) => {
                  const n = item.item_name || item.name || ''
                  if (!n) return null
                  const rawPrice = item.hh_price ?? item.price
                  const priceStr = item.price_text || (rawPrice != null ? `$${Number(rawPrice).toFixed(2).replace(/\.00$/, '')}` : '')
                  return (
                    <div key={i} className="hh-item">
                      <div className="hh-item-info">
                        <div className="hh-item-name">{n}</div>
                        {item.description && <div className="hh-item-desc">{item.description}</div>}
                      </div>
                      {priceStr && <div className="hh-item-price">{priceStr}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
