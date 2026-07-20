import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API_BASE } from '../config'
import { authFetch } from '../context/AppContext'
import ReviewsSection from '../components/ReviewsSection'
import TeamSection from '../components/TeamSection'
import GallerySection from '../components/GallerySection'
import BlogSection from '../components/BlogSection'
import PoliciesSection from '../components/PoliciesSection'
import BookingCalendar from '../components/BookingCalendar'
import HubTemplate from '../components/HubTemplate'
import { fetchChildRentals, cachedFetchJson, fixUrl } from '../services/gcrApi'
import './BusinessDetail.css'
import '../components/MiniSiteComponents.css'

// Same mapping used in Deals.jsx — keeps the hero icon type-aware instead of
// defaulting every business without its own icon to the restaurant emoji.
const ENTITY_ICONS = {
  restaurant:       '🍽️',
  activity:         '🎯',
  fishing_charter:  '🎣',
  marina:           '⚓',
  condo:            '🏠',
  'vacation-rental':'🏖️',
  hotel:            '🏨',
  service:          '🛠️',
  photographer:     '📸',
  spa:              '💆',
  hair_salon:       '💇',
  nail_salon:       '💅',
  massage:          '💆',
  tour_agency:      '🚤',
  'Boat Rentals':   '🚤',
  'Dolphin Cruises & Tours': '🐬',
}

export default function RestaurantDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()

  // Log an outbound booking/order click tied to this tourist, then open the
  // destination with a gcr_ref so the conversion can be attributed back to them.
  async function trackAndOpen(e, url, type) {
    if (!url) return
    e.preventDefault()
    let ref = ''
    try {
      const r = await authFetch('/api/tourist/track-click', {
        method: 'POST',
        body: JSON.stringify({ entity_slug: slug, click_type: type, target_url: url }),
      })
      if (r.ok) { const d = await r.json().catch(() => ({})); ref = d.click_id || '' }
    } catch { /* never block the outbound link */ }
    const sep = url.includes('?') ? '&' : '?'
    window.open(ref ? `${url}${sep}gcr_ref=${encodeURIComponent(ref)}` : url, '_blank', 'noopener,noreferrer')
  }

  // Same click attribution as trackAndOpen, but for internal GCR pages (e.g.
  // the Reserve flow) — navigates in-app instead of opening a new tab, so we
  // know this session came specifically from the booking CTA, not a generic
  // page visit.
  async function trackAndNavigate(path, type) {
    let cid = ''
    try {
      const r = await authFetch('/api/tourist/track-click', {
        method: 'POST',
        body: JSON.stringify({ entity_slug: slug, click_type: type, target_url: path }),
      })
      if (r.ok) { const d = await r.json().catch(() => ({})); cid = d.click_id || '' }
    } catch { /* never block navigation */ }
    navigate(cid ? `${path}?cid=${encodeURIComponent(cid)}` : path)
  }

  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [activeTab, setActiveTab] = useState(null)
  const [activeSubSection, setActiveSubSection] = useState(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [galleryPage, setGalleryPage] = useState(0)
  const [reviewsPage, setReviewsPage] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [hasTeam, setHasTeam] = useState(false)
  const [hasBlog, setHasBlog] = useState(false)
  const [hasPolicies, setHasPolicies] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [availability, setAvailability] = useState(null)
  const [failedSlides, setFailedSlides] = useState({})
  const [siblings, setSiblings] = useState([])
  const subSectionRefs = useRef({})
  // Industry-first content flow: the DOM order of content sections follows
  // the industry tab order (rank map filled during render, applied after
  // paint via CSS flex order on the shared content-main container).
  const sectionOrderRef = useRef({})
  useEffect(() => {
    const orders = sectionOrderRef.current || {}
    const entries = Object.entries(sectionRefs.current).filter(([, el]) => el && el.isConnected)
    if (!entries.length) return
    const parent = entries[0][1].parentElement
    if (parent) {
      parent.style.display = 'flex'
      parent.style.flexDirection = 'column'
    }
    for (const [id, el] of entries) {
      el.style.order = orders[id] != null ? orders[id] : 500
    }
  })

  // Related profiles: same-property businesses (template: "Related profiles
  // — same-category businesses connected inside <parent>")
  useEffect(() => {
    const pSlug = business?.parent?.slug
    if (!pSlug) { setSiblings([]); return }
    let cancelled = false
    fetchChildRentals(pSlug).then(list => {
      if (!cancelled) setSiblings((list || []).filter(c => c.slug !== slug).slice(0, 4))
    })
    return () => { cancelled = true }
  }, [business?.parent?.slug, slug])
  const sectionRefs = useRef({})
  const observerRef = useRef(null)
  const detailHeaderRef = useRef(null)

  useEffect(() => {
    async function loadBusiness() {
      try {
        // Shares a cache entry with fetchBusinessBySlug (gcrApi.js) — if this
        // business was already fetched anywhere else (a card preview, etc.)
        // this returns instantly with no network round trip.
        const data = await cachedFetchJson(`${API_BASE}/api/gcr/entity/${encodeURIComponent(slug)}`, {
          ttlMs: 120000,
          errorMessage: 'Failed to load business',
        })
        if (!data || !data.slug) throw new Error('Business not found')
        setBusiness(data)
        const et = (data.entity_type || '').toLowerCase()
        const isFood = ['restaurant','coffee','dessert','bakery','bar'].includes(et)
        const rotating = data.rotating_sections || data.rotatingSections || []
        const hasMenuData = data.menu_sections?.length || rotating.some(r => r.type !== 'drinks') || data.areas?.some(a => a.menu_sections?.length)
        const hasDrinksData = data.drink_sections?.length || rotating.some(r => r.type === 'drinks') || data.areas?.some(a => a.drink_sections?.length)
        const hasSpecialsData = data.specials?.length || data.daily_features?.length || data.dailyFeatures?.length || data.sides?.length || data.areas?.some(a => a.specials?.length)
        const hasOfferingsData = (data.sections || []).some(s => (s.items || []).length > 0)
        const hasPricing = data.pricing?.length > 0
        const hasSchedules = data.schedules?.length > 0
        // Industry data presence — mirror the has-data flags used to build the tab row below
        const hasRoomsData = (data.room_types || []).length > 0
        const hasServicesData = (data.service_menu || []).length > 0 || (data.service_categories || []).length > 0 || (data.service_packages || []).length > 0 || (data.class_schedule || []).length > 0
        const hasProductsData = (data.products || []).length > 0
        const hasParkData = (data.facilities || []).length > 0 || (data.spot_rules || []).length > 0 || !!data.access_info
        // Default tab: open on the most relevant populated section for THIS entity type,
        // not always 'overview'. Order mirrors the tab row so a hotel opens on Rooms,
        // a shop on Products, a service on Services, a park on Park Info.
        // A restaurant opens on its MENU even when it also has offerings —
        // the industry's primary content wins over generic booking content.
        let defaultTab = 'overview'
        if (isFood && hasMenuData) defaultTab = 'menu'
        else if (hasRoomsData) defaultTab = 'rooms'
        else if (hasServicesData) defaultTab = 'services'
        else if (hasProductsData) defaultTab = 'products'
        else if (hasParkData) defaultTab = 'park-info'
        else if (hasOfferingsData) defaultTab = 'offerings'
        else if (hasPricing) defaultTab = 'pricing'
        else if (hasSchedules) defaultTab = 'schedule'
        setActiveTab(defaultTab)

        // Preload counts for conditional tabs
        Promise.all([
          fetch(`${API_BASE}/api/reviews/${encodeURIComponent(slug)}/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE}/api/team/${encodeURIComponent(slug)}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE}/api/blog/${encodeURIComponent(slug)}?page=1&limit=1`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE}/api/faqs/${encodeURIComponent(slug)}?category=cancellation`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE}/api/email-parser/availability/${encodeURIComponent(slug)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]).then(([reviewStats, teamData, blogData, policiesData, availData]) => {
          setReviewCount(reviewStats?.total || 0)
          setHasTeam((teamData?.team || []).length > 0)
          setHasBlog((blogData?.posts || []).length > 0)
          setHasPolicies((policiesData?.faqs || []).length > 0 || (data.policies || []).length > 0)
          setAvailability(availData?.availability?.length > 0 ? availData : null)
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadBusiness()
  }, [slug])

  useEffect(() => {
    if (!business?.photos?.length) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % business.photos.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [business?.photos?.length])

  // The global GCRHeader is hidden on this route (see App.jsx hideHeader list) — there's
  // nothing above .detail-header here, so it sticks at top:0 and .sticky-tabs stacks
  // directly beneath it using this measured height (not the global --gcr-header-h var,
  // which is stale/unset on this page and previously caused a blank gap + overlap).
  // Depends on `business` (not []) because .detail-header doesn't exist in the DOM yet
  // during the initial mount — this component early-returns a loading placeholder until
  // `business` resolves, so the ref is still null on a mount-only effect.
  useEffect(() => {
    const el = detailHeaderRef.current
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty('--detail-header-h', el.offsetHeight + 'px')
    }
    update()
    setTimeout(update, 100)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [business])

  // IntersectionObserver: highlight active sub-section chip as user scrolls
  useEffect(() => {
    observerRef.current?.disconnect()
    const els = Object.entries(subSectionRefs.current)
    if (!els.length) return
    const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--detail-header-h') || '48')
    observerRef.current = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length) setActiveSubSection(visible[0].target.dataset.secid)
      },
      { rootMargin: `-${headerH + 105}px 0px -60% 0px`, threshold: 0 }
    )
    els.forEach(([, el]) => el && observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [activeTab, business])

  const scrollToSubSection = useCallback((id) => {
    const el = subSectionRefs.current[id]
    if (!el) return
    const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--detail-header-h') || '48')
    const tabsH = 100
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - tabsH
    window.scrollTo({ top, behavior: 'smooth' })
    setActiveSubSection(id)
  }, [])

  if (loading) return <div className="detail-page"><div className="loading">Loading...</div></div>
  if (error) return <div className="detail-page"><div className="error">Error: {error}</div></div>
  if (!business) return <div className="detail-page"><div className="error">Business not found</div></div>

  if (business.is_hub) return <HubTemplate business={business} slug={slug} />

  const photos = business.photos || []
  const hours = (business.hours || []).sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0))


  // Format raw tag_name values (e.g. "craft-beer", "southern-comfort-food", "happy_hour")
  // into clean, human-readable chips (e.g. "Craft Beer", "Southern Comfort Food", "Happy Hour")
  const formatTag = (raw = '') => raw.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const GOOGLE_TYPE_NOISE = new Set([
    // Generic Google Places types that mean nothing to a tourist
    'establishment','point_of_interest','food','restaurant','bar','cafe','store',
    'premise','locality','political','sublocality','neighborhood',
    // Raw entity_subtype values that leaked into entity_tags — these belong
    // on the backend for filtering, not displayed as human-readable chips
    'seafood_restaurant','american_restaurant','family_restaurant','casual_dining',
    'catering_service','catering','food_delivery','meal_takeaway','meal_delivery',
    'fast_food_restaurant','pizza_restaurant','burger_restaurant','sandwich_shop',
    'bar_grill','bar_and_grill','hybrid_venue','diner','service','unknown',
    'point_of_interest','general_contractor','business_center','corporate_office',
    'association_or_organization','local_government_office','government',
    'insurance_agency','real_estate_agency','finance','financial',
  ])
  const seen = new Set()
  const GOOGLE_TYPE_CATS = new Set(['google_type','google_types','google_primary_type','google_secondary_type'])
  const isMachineSlug = (s = '') =>
    (/_/.test(s) && s === s.toLowerCase()) || (/^[a-z]+[A-Z]/.test(s) && !/\s/.test(s))
  const tags = (business.tags || []).filter(t => {
    const raw = t.tag_name || ''
    if (GOOGLE_TYPE_CATS.has(t.tag_category)) return false
    if (isMachineSlug(raw)) return false
    const name = raw.toLowerCase().replace(/[\s-]+/g, '_')
    if (GOOGLE_TYPE_NOISE.has(name)) return false
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })
  const events = business.events || []
  const pricing = business.pricing || []
  const whatsIncluded = business.whats_included || []
  const whatToBring = business.what_to_bring || []
  const activityDetails = business.activity_details || null
  const orderLinks = business.order_links || []
  const faqs = business.faqs || []
  const requirements = business.requirements || []
  const schedules = business.schedules || []
  // Flexible offerings (entity_sections) — used for rentals, charters, tours, etc.
  const flexSections = (business.sections || [])
    .filter(s => (s.items || []).length > 0)
    .map(s => ({ ...s, items: [...s.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }))
  const hasOfferings = flexSections.length > 0

  // Rich offerings come from real entity_sections (uuid string ids) and already
  // present each priced item in an organized, grouped way. Offerings synthesized
  // from the `offerings`/marina tables use negative numeric ids instead. When a
  // business has rich sections that already show its priced items, the separate
  // flat pricing_items list is a redundant duplicate (e.g. Coyote's 6 rental
  // sections vs its 11 identical pricing_items) -- so suppress the flat list.
  // A business whose only structured pricing IS the flat list (a charter's trip
  // tiers, etc.) keeps it.
  const hasRichOfferingSections = flexSections.some(s => typeof s.id === 'string' && (s.items || []).length > 0)
  const showFlatPricing = pricing.length > 0 && !hasRichOfferingSections

  // Rich menu data
  const rotating = business.rotating_sections || business.rotatingSections || []
  const foodRotating = rotating.filter(r => r.type !== 'drinks')
  const drinkRotating = rotating.filter(r => r.type === 'drinks')
  const allAreas = business.areas || []
  const flatMenuSections = [
    ...(business.menu_sections || []),
    ...allAreas.flatMap(a => a.menu_sections || [])
  ]
  const flatDrinkSections = [
    ...(business.drink_sections || []),
    ...allAreas.flatMap(a => a.drink_sections || [])
  ]
  const allSpecials = [
    ...(business.specials || []),
    ...allAreas.flatMap(a => a.specials || []),
  ]
  const sides = business.sides || []
  const dailyFeatures = business.daily_features || business.dailyFeatures || []

  const MEAL_ORDER = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night', 'All Day']

  const getMealPeriod = (sec) => {
    const n = (sec.section_name || sec.name || '').toLowerCase()
    if (n.includes('breakfast')) return 'Breakfast'
    if (n.includes('brunch')) return 'Brunch'
    if (n.includes('lunch')) return 'Lunch'
    if (n.includes('dinner') || n.includes('supper')) return 'Dinner'
    if (n.includes('late night') || n.includes('late-night')) return 'Late Night'
    const tr = sec.time_range || ''
    if (tr) {
      const startH = parseInt((tr.split('-')[0] || '').split(':')[0] || '0')
      if (startH < 10) return 'Breakfast'
      if (startH < 12) return 'Brunch'
      if (startH < 15) return 'Lunch'
      if (startH >= 17) return 'Dinner'
    }
    return 'All Day'
  }

  const groupByMealPeriod = (secs) => {
    const groups = {}
    secs.forEach(sec => {
      const p = getMealPeriod(sec)
      if (!groups[p]) groups[p] = []
      groups[p].push(sec)
    })
    return MEAL_ORDER.filter(p => groups[p]).map(p => ({ period: p, sections: groups[p] }))
  }

  const menuGroups = groupByMealPeriod(flatMenuSections)

  const renderMenuItem = (item, i) => {
    // entity_specials rows use a different shape (special_name / discount_*)
    // than menu/side/daily-feature items (item_name / price) — without this
    // fallback, every special rendered through this shared renderer showed a
    // blank name and no discount.
    const name = item.item_name || item.name || item.special_name
    const price = item.price != null ? item.price : null
    const discountStr = item.discount_text || (item.discount_value != null
      ? `${item.discount_value}${item.discount_type === 'percent' ? '% off' : item.discount_type === 'fixed' ? ' off' : ''}`
      : null)
    const priceStr = price != null
      ? (typeof price === 'string' ? price : (price % 1 === 0 ? `$${price}` : `$${parseFloat(price).toFixed(2)}`))
      : discountStr
    // image_url is returned flat from the API — item.images[] was the old shape, never matched
    const imgSrc = fixUrl(item.image_url || item.image_path || (item.images && item.images[0]?.url)) || null
    return (
      <div key={item.id || i} className="menu-item">
        {imgSrc && (
          <img src={imgSrc} alt={name} className="menu-item-img" loading="lazy" />
        )}
        <div className="item-body">
          <div className="item-header">
            <span className="item-name">{name}</span>
            {priceStr && <span className="item-price">{priceStr}</span>}
          </div>
          {item.description && <p className="item-desc">{item.description}</p>}
          {(item.available_days || item.days || item.day_of_week) && <p className="item-days">{item.available_days || item.days || item.day_of_week}</p>}
        </div>
      </div>
    )
  }
  // API returns photos with .url, normalize to .image_url for carousel
  const slides = photos.length > 0
    ? photos.map(p => ({ ...p, image_url: p.image_url || p.url }))
    : [{ image_url: business.hero_image_url }]

  const todayIdx = new Date().getDay()
  const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][todayIdx]

  const formatTime = (time) => {
    if (!time) return null
    if (time.includes('am') || time.includes('pm')) return time
    const [h, m] = time.split(':').map(Number)
    return `${(h % 12 || 12)}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
  }

  const timeAgo = (iso) => {
    if (!iso) return ''
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
  }

  // Open/closed status
  const todayHours = hours.find(h => h.day_of_week === todayIdx)
  const openStatus = (() => {
    if (!todayHours) return null
    if (todayHours.is_closed) return { open: false, label: 'Closed today' }
    const now = new Date()
    const toMins = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const openMins = toMins(todayHours.opens_at)
    const closeMins = toMins(todayHours.closes_at)
    if (openMins == null) return null
    if (nowMins < openMins) return { open: false, label: `Opens at ${formatTime(todayHours.opens_at)}` }
    if (closeMins && nowMins > closeMins) return { open: false, label: `Closed · Opens ${today}` }
    return { open: true, label: `Open · Closes ${formatTime(todayHours.closes_at) || 'late'}` }
  })()

  const entityType = (business.entity_type || '').toLowerCase()
  const isFood = ['restaurant','coffee','dessert','bakery','bar'].includes(entityType)
  const isStay = ['hotel','condo','vacation-rental'].includes(entityType)
  const isActivity = entityType === 'activity'
  const isService = entityType === 'service'
  const isShopping = entityType === 'shopping'
  const isPark = entityType === 'park'

  const hasActivityExtras = business.highlights?.length || business.known_for?.length || business.good_for?.length || business.what_makes_it_different

  const hasMenu = flatMenuSections.length > 0 || foodRotating.length > 0
  const hasDrinks = flatDrinkSections.length > 0 || drinkRotating.length > 0
  const hasSpecials = allSpecials.length > 0 || dailyFeatures.length > 0 || sides.length > 0
  const hasHH = !!(business.hh_days || business.hh_sections?.length || business.happy_hour_sections?.length)

  // Industry-specific data from API
  const roomTypes = business.room_types || []
  const amenities = business.amenities || []
  // Two-level amenities (booking-platform style): the unit's own amenities
  // (amenity tags + bookable_resources.amenities) and the complex's amenities
  const ownAmenities = [...new Set([
    ...(business.tags || []).filter(t => t.tag_category === 'amenity').map(t => t.tag_name),
    ...((business.bookable_resources?.[0]?.amenities || []).filter(a => typeof a === 'string')),
  ].filter(Boolean))]
  const complexAmenities = (business.parent_amenities || []).filter(a => !ownAmenities.some(o => o.toLowerCase() === a.toLowerCase()))
  const propertyFees = business.property_fees || []
  const stayLinks = business.stay_links || []
  const propertyDetails = business.property_details || null
  const serviceCategories = business.service_categories || []
  const serviceMenu = business.service_menu || []
  const servicePackages = business.service_packages || []
  const classSchedule = business.class_schedule || []
  const productCategories = business.product_categories || []
  const products = business.products || []
  const facilities = business.facilities || []
  const spotRules = business.spot_rules || []
  const accessInfo = business.access_info || null
  const meetingPoints = business.meeting_points || []
  const activityOptions = business.activity_options || []
  const fishSpecies = business.fish_species || []
  const loyaltyProgram = business.loyalty_program || null
  const announcements = business.announcements || []
  const socialPosts = business.social_posts || []
  const hasSocialPosts = socialPosts.length > 0
  const bookableResources = business.bookable_resources || []

  // Has-data flags for new tabs
  const hasRooms = roomTypes.length > 0
  const hasServices = serviceMenu.length > 0 || serviceCategories.length > 0 || servicePackages.length > 0 || classSchedule.length > 0
  const hasProducts = products.length > 0
  const hasParkInfo = facilities.length > 0 || spotRules.length > 0 || accessInfo
  const hasMeetingPoints = meetingPoints.length > 0
  const hasFishSpecies = fishSpecies.length > 0
  const hasActivityOptions = activityOptions.length > 0
  const hasAmenities = amenities.length > 0 || ownAmenities.length > 0 || complexAmenities.length > 0

  const sections = [
    // Data-driven — show if data exists regardless of type
    ...(hasOfferings                     ? [{ id: 'offerings',   label: 'Offerings',    icon: '🎟️' }] : []),
    ...((showFlatPricing || whatsIncluded.length || requirements.length || whatToBring.length) ? [{ id: 'pricing', label: showFlatPricing ? 'Pricing' : 'Details', icon: showFlatPricing ? '💰' : '📋' }] : []),
    ...(schedules.length                 ? [{ id: 'schedule',    label: 'Schedule',     icon: '🗓️' }] : []),
    // Food tabs
    ...((isFood || hasMenu)   ? (hasMenu    ? [{ id: 'menu',       label: 'Menu',        icon: '🍽️' }] : []) : []),
    ...((isFood || hasDrinks) ? (hasDrinks  ? [{ id: 'drinks',     label: 'Drinks',      icon: '🍷' }] : []) : []),
    ...((isFood || hasSpecials)? (hasSpecials?[{ id: 'specials',   label: 'Specials',    icon: '⭐' }] : []) : []),
    ...((isFood || hasHH)     ? (hasHH      ? [{ id: 'happy-hour', label: 'Happy Hour',  icon: '🍺' }] : []) : []),
    // Stay tabs
    ...(hasRooms      ? [{ id: 'rooms',     label: 'Rooms',        icon: '🛏️' }] : []),
    ...(hasAmenities  ? [{ id: 'amenities', label: 'Amenities',    icon: '✨' }] : []),
    ...(stayLinks.length ? [{ id: 'book-stay', label: 'Book / Links', icon: '🔗' }] : []),
    // Service tabs
    ...(hasServices   ? [{ id: 'services',  label: 'Services',     icon: '💆' }] : []),
    // Shop tabs
    ...(hasProducts   ? [{ id: 'products',  label: 'Products',     icon: '🛍️' }] : []),
    // Park tabs
    ...(hasParkInfo   ? [{ id: 'park-info', label: 'Park Info',    icon: '🌳' }] : []),
    // Activity extras
    ...(hasMeetingPoints  ? [{ id: 'meeting',  label: 'Meeting Point', icon: '📌' }] : []),
    ...(hasFishSpecies    ? [{ id: 'fish',     label: 'Fish Species',  icon: '🐟' }] : []),
    // Common
    ...(hours.length  ? [{ id: 'hours',     label: 'Hours',        icon: '🕐' }] : []),
    ...(events.length ? [{ id: 'events',    label: 'Events',       icon: '🎉' }] : []),
    { id: 'overview',   label: 'Overview',   icon: 'ℹ️' },
    ...(hasActivityExtras ? [{ id: 'experience', label: 'Experience', icon: '🎯' }] : []),
    ...(faqs.length   ? [{ id: 'faqs',      label: 'FAQs',         icon: '❓' }] : []),
    { id: 'reviews', label: reviewCount > 0 ? `Reviews (${reviewCount})` : 'Reviews', icon: '⭐' },
    ...(hasTeam     ? [{ id: 'team',     label: 'Team',     icon: '👥' }] : []),
    ...(hasBlog        ? [{ id: 'blog',     label: 'Blog',     icon: '📰' }] : []),
    ...(hasSocialPosts ? [{ id: 'social',   label: 'Social',   icon: '📱' }] : []),
    ...(hasPolicies ? [{ id: 'policies', label: 'Policies', icon: '📋' }] : []),
    { id: 'location', label: 'Location', icon: '📍' },
    ...(photos.length ? [{ id: 'gallery', label: `Photos (${photos.length})`, icon: '📸' }] : []),
  ]

  // Industry-specific tab order — each industry leads with what its visitors
  // came for: food → menu & specials, activities → trips & pricing, stays →
  // rooms & amenities, services → service list, shops → products, parks →
  // park info. Tabs not named in a priority list keep their relative order
  // after the prioritized ones.
  // Yelp-style top-down flow: lead with what the visitor came for, put the
  // "about" overview right after it (not buried at the bottom), then the
  // supporting detail, social proof (reviews), photos, and finally the
  // logistics (hours, location). 'overview' and 'location' are explicitly
  // placed so they no longer fall to the very end by default.
  const TAB_PRIORITY = isFood
    ? ['menu', 'specials', 'happy-hour', 'drinks', 'overview', 'offerings', 'pricing', 'events', 'reviews', 'gallery', 'hours', 'location']
    : isActivity
    ? ['offerings', 'pricing', 'overview', 'schedule', 'experience', 'fish', 'meeting', 'faqs', 'reviews', 'gallery', 'hours', 'location']
    : isStay
    ? ['rooms', 'amenities', 'overview', 'offerings', 'book-stay', 'policies', 'faqs', 'reviews', 'gallery', 'hours', 'location']
    : isService
    ? ['services', 'offerings', 'pricing', 'overview', 'team', 'faqs', 'reviews', 'hours', 'gallery', 'location']
    : isShopping
    ? ['products', 'offerings', 'specials', 'overview', 'hours', 'gallery', 'reviews', 'location']
    : isPark
    ? ['park-info', 'offerings', 'overview', 'events', 'gallery', 'hours', 'reviews', 'location']
    : ['overview', 'offerings', 'pricing', 'faqs', 'reviews', 'gallery', 'hours', 'location']
  const tabRank = (id, idx) => {
    const i = TAB_PRIORITY.indexOf(id)
    return i === -1 ? 1000 + idx : i
  }
  const orderedSections = sections
    .map((s, idx) => ({ s, r: tabRank(s.id, idx) }))
    .sort((a, b) => a.r - b.r)
    .map(x => x.s)
  sectionOrderRef.current = Object.fromEntries(orderedSections.map((s, i) => [s.id, i + 1]))

  // Sub-section chips — meal periods only for menu (Lunch / Dinner etc),
  // individual sections for drinks/happy-hour since they don't have period grouping
  // Sticky sub-nav: each meal period (Breakfast/Lunch/Dinner…) followed by its own
  // sub-categories, so you can jump straight to any section. Period chips are marked
  // isPeriod so they render as bold dividers; section labels drop the period prefix
  // (it's already shown by the period chip right before them).
  const PERIOD_PREFIXES = ['Breakfast ', 'Brunch ', 'Lunch ', 'Dinner ', 'Late Night ', 'All Day ']
  const stripPeriod = (name) => PERIOD_PREFIXES.reduce((n, p) => n.startsWith(p) ? n.slice(p.length) : n, name || '')
  const subSections = activeTab === 'menu'
    ? [
        ...(foodRotating.length ? [{ id: 'menu-rotating', label: "Today's Features", isPeriod: true }] : []),
        ...menuGroups.flatMap(({ period, sections: grpSections }) => [
          { id: `menu-period-${period}`, label: period, isPeriod: true },
          ...grpSections.map(section => ({
            id: `menu-sec-${section.id || section.section_name || section.name}`,
            label: stripPeriod(section.section_name || section.name) || (section.section_name || section.name)
          }))
        ])
      ]
    : activeTab === 'drinks'
    ? [
        ...(drinkRotating.length ? [{ id: 'drinks-rotating', label: 'On Tap / Featured', isPeriod: true }] : []),
        ...flatDrinkSections.map(s => ({ id: `drink-sec-${s.id || s.section_name || s.name}`, label: s.section_name || s.name }))
      ]
    : activeTab === 'happy-hour'
    ? (business.hh_sections || business.happy_hour_sections || []).map(s => ({ id: `hh-sec-${s.id || s.section_name}`, label: s.section_name || s.name }))
    : []

  const GALLERY_PER_PAGE = 10
  const REVIEWS_PER_PAGE = 10
  const galleryTotal = Math.ceil((photos?.length || 0) / GALLERY_PER_PAGE)
  const reviewsTotal = reviewCount

  const handleShareBusiness = () => {
    const businessUrl = `${window.location.origin}/business/${business.slug}`

    if (navigator.share) {
      navigator.share({
        title: business.name,
        text: `Check out ${business.name} on Gulf Coast Radar`,
        url: businessUrl
      }).catch(() => {})
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(businessUrl)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <div className="detail-page">
      {/* Header */}
      <div className="detail-header" ref={detailHeaderRef}>
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div style={{display:'flex',gap:8}}>
          <button className={`save-btn-detail ${saved ? 'saved' : ''}`} onClick={() => setSaved(s => !s)} title={saved ? 'Saved' : 'Save'}>
            {saved ? '❤️' : '🤍'}
          </button>
          <button className="share-btn" onClick={handleShareBusiness} title="Share this business">📤 Share</button>
        </div>
      </div>

      {/* Photo Carousel */}
      {(() => {
      const allFailed = slides.length > 0 && slides.every((p, idx) => failedSlides[idx] || !(p.image_url || p.url))
      const heroEmoji = business.icon || ENTITY_ICONS[business.entity_subtype] || ENTITY_ICONS[entityType] || '📍'
      return (
      <div className={`carousel-wrap${allFailed ? ' carousel-wrap-empty' : ''}`}>
        <div className="carousel">
          {slides.map((photo, idx) => {
            const src = fixUrl(photo.image_url || photo.url) || ''
            const broken = failedSlides[idx] || !src
            return (
            <div
              key={idx}
              className={`carousel-slide ${idx === currentSlide ? 'active' : ''}`}
            >
              {broken ? (
                <div className="carousel-fallback">
                  <span className="carousel-fallback-emoji">{heroEmoji}</span>
                  <span className="carousel-fallback-name">{business.name}</span>
                </div>
              ) : (
                <img
                  src={src}
                  alt=""
                  className="carousel-slide-img"
                  onError={() => setFailedSlides(prev => ({ ...prev, [idx]: true }))}
                  loading="lazy"
                />
              )}
            </div>
          )})}
          {!allFailed && <div className="carousel-overlay" />}

          {slides.length > 1 && !allFailed && (
            <>
              <button className="carousel-arrow carousel-prev" onClick={() => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length)}>
                &#8249;
              </button>
              <button className="carousel-arrow carousel-next" onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}>
                &#8250;
              </button>
              <div className="carousel-dots">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    className={`dot ${idx === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(idx)}
                  />
                ))}
              </div>
              <div className="carousel-count">{currentSlide + 1} / {slides.length}</div>
            </>
          )}

          {/* Image feature chips */}
          {!allFailed && (() => {
            const tagStrs = (business.tags || []).map(t => (typeof t === 'string' ? t : (t.tag_name || '')).toLowerCase().replace(/[\s-]+/g,'_'))
            const chips = [
              (business.live_music || tagStrs.some(t => t.includes('live_music'))) && { cls: 'chip-music', label: '🎸 Live Music' },
              (business.waterfront || tagStrs.includes('waterfront')) && { cls: 'chip-water', label: '🌊 Waterfront' },
              (business.outdoor_seating || tagStrs.includes('outdoor_seating')) && { cls: 'chip-outdoor', label: '🌿 Outdoor' },
              business.hh_days && { cls: 'chip-hh', label: '🍺 Happy Hour' },
            ].filter(Boolean)
            return chips.length ? (
              <div className="carousel-img-chips">
                {chips.map((c,i) => <span key={i} className={`carousel-img-chip ${c.cls}`}>{c.label}</span>)}
              </div>
            ) : null
          })()}

        </div>
      </div>
      )})()}

      {/* Permanently Closed Banner */}
      {business.business_status === 'CLOSED_PERMANENTLY' && (
        <div className="closed-permanently-banner">
          ⚠️ This business is permanently closed
        </div>
      )}

      {/* Announcement Banner */}
      {announcements.length > 0 && announcements.filter(a => a.active).map(a => (
        <div key={a.id} className={`announcement-banner announcement-${a.type || 'banner'}`}>
          {a.message}
        </div>
      ))}

      {/* Happy Hour Banner */}
      {business.hh_days && (
        <div className="hh-banner">
          🍺 <span className="hh-badge">Happy Hour</span> {business.hh_days}
        </div>
      )}

      {/* Header Section */}
      <div className="business-header">
        <h1>{business.name}</h1>
        {business.subtitle && <p className="subtitle">{business.subtitle}</p>}

        {/* Open/closed status + today's hours */}
        {openStatus && (
          <div className={`open-status ${openStatus.open ? 'open' : 'closed'}`}>
            <span className="open-dot" />
            {openStatus.label}
            {todayHours && !todayHours.is_closed && openStatus.open && todayHours.opens_at && (
              <span className="open-hours-today"> · {formatTime(todayHours.opens_at)}–{formatTime(todayHours.closes_at)}</span>
            )}
          </div>
        )}

        {business.city && <p className="meta">📍 {business.city}, {business.state}</p>}
        {business.rating && <p className="meta">⭐ {business.rating} ({business.review_count || 0} reviews)</p>}

        {/* Short lead description up top — the "what is this" a visitor needs
            before scrolling. The full copy still lives in the About section
            below; this is a trimmed teaser (falls back through the same
            source fields the About section uses). */}
        {(() => {
          const lead = (business.description || business.editorial_summary || business.ai_overview || '').trim()
          if (!lead) return null
          const MAX = 220
          const short = lead.length > MAX ? lead.slice(0, MAX).replace(/\s+\S*$/, '') + '…' : lead
          return <p className="lead-description">{short}</p>
        })()}

        {/* Live availability — only shows if the owner has it enabled (visible_on_profile) */}
        {business.availability_today && (
          <p className={`meta avail-badge-inline ${business.availability_today.remaining_spots <= 2 ? 'avail-critical' : ''}`}>
            {business.availability_today.last_minute_deal
              ? `⚡ ${business.availability_today.last_minute_deal}`
              : business.availability_today.remaining_spots != null
                ? `🎟️ ${business.availability_today.remaining_spots} left today`
                : `${business.availability_today.status === 'available' ? '✅ Available today' : business.availability_today.status === 'booked' ? '🔴 Fully booked today' : ''}`}
            {business.availability_today.last_updated && (
              <span className="avail-updated"> · updated {timeAgo(business.availability_today.last_updated)}</span>
            )}
          </p>
        )}

        {/* Connected parent — child profiles link back to their property hub */}
        {business.parent && (
          <button className="parent-link" onClick={() => navigate(`/business/${business.parent.slug}`)}>
            🏛 Part of <strong>{business.parent.name}</strong> →
          </button>
        )}

        {/* Quick facts (template: 📍 Location / ☎️ Phone / ✉️ Email card) */}
        {(business.address_line_1 || business.phone || business.email || business.website_url) && (
          <div className="quick-facts">
            {business.address_line_1 && (
              <div className="qf-item">
                <span className="qf-k">📍 Location</span>
                <span className="qf-v">{business.address_line_1}{business.city ? `, ${business.city}` : ''}</span>
              </div>
            )}
            {business.phone && (
              <div className="qf-item">
                <span className="qf-k">☎️ Phone</span>
                <a className="qf-v" href={`tel:${business.phone}`}>{business.phone}</a>
              </div>
            )}
            {business.email && (
              <div className="qf-item">
                <span className="qf-k">✉️ Email</span>
                <a className="qf-v" href={`mailto:${business.email}`}>{business.email}</a>
              </div>
            )}
            {business.website_url && (
              <div className="qf-item">
                <span className="qf-k">🌐 Website</span>
                <a className="qf-v" href={business.website_url} target="_blank" rel="noopener noreferrer">
                  {business.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="badge-row">
            {tags.slice(0, 6).map(tag => (
              <span key={tag.tag_name} className="badge">{formatTag(tag.tag_name)}</span>
            ))}
            {tags.length > 6 && <span className="badge badge-more">+{tags.length - 6} more</span>}
          </div>
        )}

        {/* Primary CTA — type-aware labels */}
        {(() => {
          const et = (business.entity_type || '').toLowerCase()
          const isFood = ['restaurant','coffee','dessert','bakery','bar'].includes(et)
          const isShopping = et === 'shopping'
          const isActivity = et === 'activity'
          const isStay = ['hotel','condo','vacation-rental'].includes(et)
          const isService = et === 'service'
          const reserveLabel = isFood ? '🍽️ Make a Reservation' : isStay ? '🛏️ Check Availability' : '📅 Reserve a Spot'
          const bookLabel = isActivity ? '🎟️ Book This Activity' : isService ? '📅 Schedule Service' : isShopping ? '🛍️ Shop Online' : '📅 Book Now'
          const hasExternalCta = business.reservation_url || business.order_url || business.booking_url
          const showGcrReserve = !hasExternalCta && (isFood || business.reservable)
          return (hasExternalCta || showGcrReserve || business.offers_transportation) ? (
            <div className="primary-cta">
              {business.reservation_url && (
                <a href={business.reservation_url} onClick={e => trackAndOpen(e, business.reservation_url, 'reserve')} target="_blank" rel="noopener noreferrer" className="btn-primary-cta">{reserveLabel}</a>
              )}
              {business.order_url && (
                <a href={business.order_url} onClick={e => trackAndOpen(e, business.order_url, 'order')} target="_blank" rel="noopener noreferrer" className="btn-primary-cta">
                  {isFood ? '🛵 Order Online' : '🛒 Order / Buy'}
                </a>
              )}
              {business.booking_url && !business.reservation_url && (
                <a href={business.booking_url} onClick={e => trackAndOpen(e, business.booking_url, 'book')} target="_blank" rel="noopener noreferrer" className="btn-primary-cta">{bookLabel}</a>
              )}
              {showGcrReserve && (
                <button onClick={() => trackAndNavigate(`/reserve/${business.slug}`, 'reserve')} className="btn-primary-cta">{reserveLabel}</button>
              )}
              {business.offers_transportation && (
                <button onClick={() => trackAndNavigate(`/transportation/${business.slug}`, 'transportation')} className="btn-primary-cta">🚗 Request Pickup</button>
              )}
            </div>
          ) : null
        })()}

        {/* Secondary Action Buttons */}
        <div className="action-buttons">
          {business.phone && (
            <a href={`tel:${business.phone}`} className="btn btn-call">📞 Call</a>
          )}
          {business.directions_url && (
            <a href={business.directions_url} target="_blank" rel="noopener noreferrer" className="btn btn-directions">
              📍 Directions
            </a>
          )}
          {business.menu_url && (
            <a href={business.menu_url} target="_blank" rel="noopener noreferrer" className="btn btn-menu">
              📄 Menu
            </a>
          )}
          {business.website_url && (
            <a href={business.website_url} target="_blank" rel="noopener noreferrer" className="btn btn-website">
              🌐 Website
            </a>
          )}
          {loyaltyProgram && (
            <a
              href={`sms:${loyaltyProgram.sms_number}?body=Text%20${loyaltyProgram.keyword}%20to%20join`}
              className="btn btn-loyalty"
            >
              🎁 Join Loyalty
            </a>
          )}
        </div>

        {/* Social Links */}
        {(business.social_instagram || business.social_facebook || business.social_tiktok) && (
          <div className="social-links">
            {business.social_instagram && (
              <a href={business.social_instagram.startsWith('http') ? business.social_instagram : `https://instagram.com/${business.social_instagram}`} target="_blank" rel="noopener noreferrer" className="social-btn social-instagram">
                Instagram
              </a>
            )}
            {business.social_facebook && (
              <a href={business.social_facebook} target="_blank" rel="noopener noreferrer" className="social-btn social-facebook">
                Facebook
              </a>
            )}
            {business.social_tiktok && (
              <a href={business.social_tiktok.startsWith('http') ? business.social_tiktok : `https://tiktok.com/@${business.social_tiktok}`} target="_blank" rel="noopener noreferrer" className="social-btn social-tiktok">
                TikTok
              </a>
            )}
          </div>
        )}
      </div>

      {/* Sticky Tabs */}
      <div className="sticky-tabs">
        <div className="tabs-scroll">
          {orderedSections.map(sec => (
            <button
              key={sec.id}
              className={`bd-tab ${activeTab === sec.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(sec.id)
                setActiveSubSection(null)
                const el = sectionRefs.current[sec.id]
                if (el) {
                  const top = el.getBoundingClientRect().top + window.scrollY - 130
                  window.scrollTo({ top, behavior: 'smooth' })
                }
              }}
            >
              {sec.icon} {sec.label}
            </button>
          ))}
        </div>
        {subSections.length > 0 && (
          <div className="subsection-chips-row">
            {subSections.map(ss => (
              <button
                key={ss.id}
                className={`subsection-chip ${ss.isPeriod ? 'period' : ''} ${activeSubSection === ss.id ? 'active' : ''}`}
                onClick={() => scrollToSubSection(ss.id)}
              >
                {ss.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Layout */}
      <div className="content-layout">
        <main className="content-main">
          {/* Overview */}
                      <section className="content-section" ref={el => { sectionRefs.current["overview"] = el }} id="section-overview">
              <h2>About</h2>
              {business.description && <p>{business.description}</p>}
              {!business.description && business.editorial_summary && <p>{business.editorial_summary}</p>}
              {business.ai_overview && (
                <div className="ai-summary">
                  <p>{business.ai_overview}</p>
                </div>
              )}
              {business.ai_review_summary && (
                <div className="ai-review-summary">
                  <h3>What Visitors Say</h3>
                  <p>{business.ai_review_summary}</p>
                </div>
              )}

              {/* Structured facts — served from entity_attributes */}
              {(business.structured_attributes || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3>Good to Know</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 16px', fontSize: 14 }}>
                    {(business.structured_attributes || []).slice(0, 24).map((a, i) => (
                      <div key={a.id || i}>
                        <span style={{ opacity: .65 }}>{a.label || a.key}: </span>
                        <strong>{String(a.value)}{a.unit ? ` ${a.unit}` : ''}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proximity — served from entity_nearby_landmarks */}
              {(business.nearby_landmarks || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3>📍 What's Nearby</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(business.nearby_landmarks || []).slice(0, 10).map((l, i) => (
                      <span key={l.id || i} style={{ fontSize: 13, padding: '4px 12px', borderRadius: 999, background: 'rgba(13,125,116,.1)' }}>
                        {l.name}
                        {l.travel_distance_meters != null && (
                          <span style={{ opacity: .6 }}> · {l.travel_distance_meters >= 1000 ? (l.travel_distance_meters / 1609).toFixed(1) + ' mi' : l.travel_distance_meters + ' m'}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── LIVE AVAILABILITY WIDGET ── */}
              {availability && availability.availability?.length > 0 && (() => {
                const today = new Date().toISOString().slice(0,10)
                const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10)
                const slots = availability.availability.filter(s =>
                  s.availability_date === today || s.availability_date === tomorrow
                )
                if (!slots.length) return null
                return (
                  <div className="avail-widget">
                    <div className="avail-widget-head">
                      <span className="avail-pulse" />
                      <span className="avail-title">Live Availability</span>
                      <span className="avail-updated">Updated in real-time</span>
                    </div>
                    <div className="avail-slots">
                      {slots.map((slot, i) => {
                        const isToday = slot.availability_date === today
                        const label = isToday ? 'Today' : 'Tomorrow'
                        const time = slot.time_slot ? slot.time_slot.slice(0,5) : null
                        const fmt = t => {
                          if (!t) return ''
                          const [h, m] = t.split(':').map(Number)
                          return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
                        }
                        return (
                          <div key={i} className={`avail-slot avail-slot--${slot.status}`}>
                            <div className="avail-slot-when">
                              <span className="avail-slot-day">{label}</span>
                              {time && <span className="avail-slot-time">{fmt(time)}</span>}
                            </div>
                            <div className="avail-slot-status">
                              {slot.status === 'full' && <span className="avail-tag avail-tag--full">🔴 Full</span>}
                              {slot.status === 'limited' && (
                                <span className="avail-tag avail-tag--limited">
                                  🟡 {slot.remaining_spots} spot{slot.remaining_spots !== 1 ? 's' : ''} left
                                </span>
                              )}
                              {slot.status === 'available' && (
                                <span className="avail-tag avail-tag--open">
                                  🟢 {slot.remaining_spots != null ? `${slot.remaining_spots} open` : 'Available'}
                                </span>
                              )}
                              {slot.status === 'unknown' && (
                                <span className="avail-tag avail-tag--unknown">📊 Tracking</span>
                              )}
                            </div>
                            {slot.total_capacity && slot.remaining_spots != null && (
                              <div className="avail-bar-wrap">
                                <div
                                  className="avail-bar-fill"
                                  style={{ width: `${Math.min(100, ((slot.total_capacity - slot.remaining_spots) / slot.total_capacity) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {business.booking_url && (
                      <a href={business.booking_url} onClick={e => trackAndOpen(e, business.booking_url, 'book')} target="_blank" rel="noopener noreferrer" className="avail-book-btn">
                        📅 Book Now — Before It's Gone
                      </a>
                    )}
                  </div>
                )
              })()}

              {/* Type-aware features/amenities */}
              {(() => {
                const et = (business.entity_type || '').toLowerCase()
                const isFood = ['restaurant','coffee','dessert','bakery','bar'].includes(et)
                const isActivity = et === 'activity'
                const isStay = ['hotel','condo','vacation-rental'].includes(et)
                const isShopping = et === 'shopping'
                const isPark = et === 'park'

                // Activity / charter / tour quick-facts
                if (isActivity) {
                  const facts = [
                    business.duration_text       && { icon: '⏱', label: business.duration_text },
                    business.price_from != null   && { icon: '💵', label: `From $${business.price_from}${business.price_unit ? ' / ' + business.price_unit : ''}` },
                    business.good_for_groups     && { icon: '👥', label: 'Good for Groups' },
                    business.good_for_children   && { icon: '👶', label: 'Kid Friendly' },
                    business.allows_dogs         && { icon: '🐕', label: 'Dog Friendly' },
                    business.outdoor_seating     && { icon: '🌊', label: 'Outdoors' },
                    business.reservable          && { icon: '📅', label: 'Reservations Available' },
                    business.wheelchair_accessible_entrance && { icon: '♿', label: 'Accessible' },
                  ].filter(Boolean)
                  if (!facts.length) return null
                  return (
                    <div className="amenities-section">
                      <h3>Quick Facts</h3>
                      <div className="amenities-grid">
                        {facts.map((a, i) => <div key={i} className="amenity-item">{a.icon} {a.label}</div>)}
                      </div>
                    </div>
                  )
                }

                // Stay quick-facts
                if (isStay) {
                  const facts = [
                    business.bedrooms  && { icon: '🛏️', label: `${business.bedrooms} Bedroom${business.bedrooms !== 1 ? 's' : ''}` },
                    business.bathrooms && { icon: '🚿', label: `${business.bathrooms} Bathroom${business.bathrooms !== 1 ? 's' : ''}` },
                    business.sqft      && { icon: '📐', label: `${business.sqft.toLocaleString()} sqft` },
                    business.good_for_groups     && { icon: '👥', label: 'Good for Groups' },
                    business.good_for_children   && { icon: '👶', label: 'Kid Friendly' },
                    business.allows_dogs         && { icon: '🐕', label: 'Pet Friendly' },
                    business.outdoor_seating     && { icon: '🌊', label: 'Waterfront' },
                    business.reservable          && { icon: '📅', label: 'Bookable Online' },
                    business.wheelchair_accessible_entrance && { icon: '♿', label: 'Accessible' },
                  ].filter(Boolean)
                  if (!facts.length) return null
                  return (
                    <div className="amenities-section">
                      <h3>Property Details</h3>
                      <div className="amenities-grid">
                        {facts.map((a, i) => <div key={i} className="amenity-item">{a.icon} {a.label}</div>)}
                      </div>
                    </div>
                  )
                }

                // Shopping / park / service — generic features only
                if (isShopping || isPark || et === 'service') {
                  const facts = [
                    business.outdoor_seating   && { icon: '🌿', label: 'Outdoor' },
                    business.good_for_groups   && { icon: '👥', label: 'Good for Groups' },
                    business.good_for_children && { icon: '👶', label: 'Kid Friendly' },
                    business.allows_dogs       && { icon: '🐕', label: 'Dog Friendly' },
                    business.reservable        && { icon: '📅', label: 'Appointments Available' },
                    business.wheelchair_accessible_entrance && { icon: '♿', label: 'Accessible Entrance' },
                  ].filter(Boolean)
                  if (!facts.length) return null
                  return (
                    <div className="amenities-section">
                      <h3>Features</h3>
                      <div className="amenities-grid">
                        {facts.map((a, i) => <div key={i} className="amenity-item">{a.icon} {a.label}</div>)}
                      </div>
                    </div>
                  )
                }

                // Food types — full restaurant amenities
                if (isFood) {
                  const amenities = [
                    business.dine_in           && { icon: '🍽️', label: 'Dine-in' },
                    business.takeout           && { icon: '🥡', label: 'Takeout' },
                    business.delivery          && { icon: '🛵', label: 'Delivery' },
                    business.curbside_pickup   && { icon: '🚗', label: 'Curbside Pickup' },
                    business.reservable        && { icon: '📅', label: 'Reservations' },
                    business.outdoor_seating   && { icon: '🌿', label: 'Outdoor Seating' },
                    business.live_music        && { icon: '🎸', label: 'Live Music' },
                    business.good_for_groups   && { icon: '👥', label: 'Good for Groups' },
                    business.good_for_children && { icon: '👶', label: 'Kid Friendly' },
                    business.allows_dogs       && { icon: '🐕', label: 'Dog Friendly' },
                    business.good_for_watching_sports && { icon: '📺', label: 'Sports Bar' },
                    business.serves_breakfast  && { icon: '🍳', label: 'Breakfast' },
                    business.serves_brunch     && { icon: '🥂', label: 'Brunch' },
                    business.serves_lunch      && { icon: '🥗', label: 'Lunch' },
                    business.serves_dinner     && { icon: '🍷', label: 'Dinner' },
                    business.serves_beer       && { icon: '🍺', label: 'Beer' },
                    business.serves_wine       && { icon: '🍷', label: 'Wine' },
                    business.serves_cocktails  && { icon: '🍹', label: 'Cocktails' },
                    business.serves_coffee     && { icon: '☕', label: 'Coffee' },
                    business.serves_dessert    && { icon: '🍰', label: 'Dessert' },
                    business.serves_vegetarian && { icon: '🥦', label: 'Vegetarian Options' },
                    business.wheelchair_accessible_entrance && { icon: '♿', label: 'Accessible Entrance' },
                    business.wheelchair_accessible_parking  && { icon: '♿', label: 'Accessible Parking' },
                    business.wheelchair_accessible_restroom && { icon: '♿', label: 'Accessible Restroom' },
                  ].filter(Boolean)
                  if (!amenities.length) return null
                  return (
                    <div className="amenities-section">
                      <h3>Amenities & Features</h3>
                      <div className="amenities-grid">
                        {amenities.map((a, i) => <div key={i} className="amenity-item">{a.icon} {a.label}</div>)}
                      </div>
                    </div>
                  )
                }

                // Fallback — generic
                const facts = [
                  business.good_for_groups   && { icon: '👥', label: 'Good for Groups' },
                  business.good_for_children && { icon: '👶', label: 'Kid Friendly' },
                  business.allows_dogs       && { icon: '🐕', label: 'Dog Friendly' },
                  business.outdoor_seating   && { icon: '🌿', label: 'Outdoor' },
                  business.reservable        && { icon: '📅', label: 'Reservations' },
                  business.wheelchair_accessible_entrance && { icon: '♿', label: 'Accessible' },
                ].filter(Boolean)
                if (!facts.length) return null
                return (
                  <div className="amenities-section">
                    <h3>Features</h3>
                    <div className="amenities-grid">
                      {facts.map((a, i) => <div key={i} className="amenity-item">{a.icon} {a.label}</div>)}
                    </div>
                  </div>
                )
              })()}

              {business.price_level && (
                <div className="price-level-row">
                  <h3>Price Level</h3>
                  <span>{'💰'.repeat(Math.min(business.price_level, 4))}</span>
                  {business.price_range_low && business.price_range_high && (
                    <span className="price-range-text"> (${business.price_range_low}–${business.price_range_high})</span>
                  )}
                </div>
              )}

              {(() => {
                const hasPropertyDetails = business.bedrooms || business.bathrooms || business.sqft;
                if (!hasPropertyDetails) return null;
                return (
                  <div className="property-details-row">
                    <h3>Property Details</h3>
                    <div className="property-specs">
                      {business.bedrooms && <span className="spec">🛏️ {business.bedrooms} bed{business.bedrooms !== 1 ? 's' : ''}</span>}
                      {business.bathrooms && <span className="spec">🚿 {business.bathrooms} bath{business.bathrooms !== 1 ? 's' : ''}</span>}
                      {business.sqft && <span className="spec">📐 {business.sqft.toLocaleString()} sqft</span>}
                    </div>
                  </div>
                );
              })()}

              {business.google_maps_uri && (
                <a href={business.google_maps_uri} target="_blank" rel="noopener noreferrer" className="google-maps-link" onClick={e => e.stopPropagation()}>
                  🗺️ View on Google Maps
                </a>
              )}

              {tags.length > 0 && (
                <div>
                  <h3>Categories</h3>
                  <div className="tag-row">
                    {(showAllTags ? tags : tags.slice(0, 10)).map(tag => (
                      <span key={tag.tag_name} className="tag">{formatTag(tag.tag_name)}</span>
                    ))}
                  </div>
                  {tags.length > 10 && (
                    <button className="see-more-btn" onClick={() => setShowAllTags(s => !s)}>
                      {showAllTags ? 'See less' : `See all ${tags.length}`}
                    </button>
                  )}
                </div>
              )}
            </section>

          {/* Experience */}
          {hasActivityExtras && (
                      <section className="content-section" ref={el => { sectionRefs.current["experience"] = el }} id="section-experience">
              {business.what_makes_it_different && (
                <div className="exp-block">
                  <h2>What Makes It Different</h2>
                  <p>{business.what_makes_it_different}</p>
                </div>
              )}
              {business.highlights?.length > 0 && (
                <div className="exp-block">
                  <h2>What You'll See</h2>
                  <ul className="exp-list">
                    {business.highlights.map((h, i) => <li key={i}>✓ {h}</li>)}
                  </ul>
                </div>
              )}
              {business.known_for?.length > 0 && (
                <div className="exp-block">
                  <h2>Known For</h2>
                  <div className="tag-row">
                    {business.known_for.map((k, i) => <span key={i} className="tag">{k}</span>)}
                  </div>
                </div>
              )}
              {business.good_for?.length > 0 && (
                <div className="exp-block">
                  <h2>Good For</h2>
                  <div className="tag-row">
                    {business.good_for.map((g, i) => <span key={i} className="tag">{g}</span>)}
                  </div>
                </div>
              )}
              {(business.duration_text || business.price_from != null) && (
                <div className="exp-block">
                  <h2>Trip Details</h2>
                  {business.duration_text && <p>⏱ Duration: {business.duration_text}</p>}
                  {business.price_from != null && (
                    <p>💵 From ${business.price_from}{business.price_unit ? ` / ${business.price_unit}` : ''}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Happy Hour */}
          {hasHH && (
                      <section className="content-section" ref={el => { sectionRefs.current["happy-hour"] = el }} id="section-happy-hour">
              <h2>🍺 Happy Hour</h2>
              {business.hh_days && (
                <p className="hh-schedule">
                  {business.hh_days}
                  {business.hh_start && ` · ${formatTime(business.hh_start)}`}
                  {business.hh_end && ` – ${formatTime(business.hh_end)}`}
                </p>
              )}
              {business.hh_description && <p>{business.hh_description}</p>}
              {(business.hh_sections || business.happy_hour_sections || []).map(sec => (
                <div key={sec.id} className="menu-section" style={{marginTop: 20}}>
                  <h3>{sec.section_name || sec.name}</h3>
                  <div className="menu-items">
                    {(sec.items || sec.happy_hour_items || []).map(item => (
                      <div key={item.id} className="menu-item">
                        <div className="item-header">
                          <span className="item-name">{item.item_name || item.name}</span>
                          {(item.hh_price ?? item.price) != null && (
                            <span className="item-price hh-price">${(item.hh_price ?? item.price)}</span>
                          )}
                        </div>
                        {item.description && <p className="item-desc">{item.description}</p>}
                        {item.original_price != null && (
                          <p className="item-original-price">Was ${item.original_price}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Pricing */}
          {hasOfferings && (
                      <section className="content-section" ref={el => { sectionRefs.current["offerings"] = el }} id="section-offerings">
              {flexSections.map((sec) => (
                <div key={sec.id} className="offering-section">
                  <h2>{sec.section_name}</h2>
                  {sec.subtitle && <p className="section-subtitle">{sec.subtitle}</p>}
                  {sec.image_url && (
                    <div className="section-banner">
                      <img src={sec.image_url} alt={sec.section_name} loading="lazy" />
                    </div>
                  )}
                  <div className="offering-grid">
                    {sec.items.map((item) => {
                      const m = item.metadata || {}
                      const priceText = item.price_from != null
                        ? (item.price_to != null
                            ? `$${item.price_from}–$${item.price_to}`
                            : `$${item.price_from}`)
                        : (item.price_label || 'Ask Us')
                      const includes = Array.isArray(m.includes) ? m.includes : []
                      const features = Array.isArray(m.features) ? m.features : []
                      return (
                        <div key={item.id} className="offering-card">
                          {item.image_url && (
                            <div className="offering-image">
                              <img src={item.image_url} alt={item.item_name} loading="lazy" />
                            </div>
                          )}
                          <div className="offering-head">
                            <span className="offering-icon">{item.icon || '•'}</span>
                            <span className="offering-name">{item.item_name}</span>
                            <span className="offering-price">{priceText}</span>
                          </div>
                          {(item.price_label || item.duration) && (
                            <div className="offering-meta">
                              {item.price_label && item.price_from != null && <span className="offering-label">{item.price_label}</span>}
                              {item.duration && <span className="offering-duration">⏱ {item.duration}</span>}
                            </div>
                          )}
                          {item.description && <p className="offering-desc">{item.description}</p>}
                          {includes.length > 0 && (
                            <div className="offering-includes">
                              {includes.map((inc, k) => <span key={k} className="offering-chip">✓ {inc}</span>)}
                            </div>
                          )}
                          {features.length > 0 && (
                            <div className="offering-includes">
                              {features.map((f, k) => <span key={k} className="offering-chip feature">★ {f}</span>)}
                            </div>
                          )}
                          {(m.requires || m.deposit || m.ages || m.note) && (
                            <div className="offering-notes">
                              {m.ages && <span>👥 {m.ages}</span>}
                              {m.requires && <span>🪪 {m.requires}</span>}
                              {m.deposit && <span>💵 Deposit {m.deposit}</span>}
                              {m.note && <span>ℹ️ {m.note}</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {(showFlatPricing || whatsIncluded.length > 0 || requirements.length > 0 || whatToBring.length > 0 || activityDetails) && (
                      <section className="content-section" ref={el => { sectionRefs.current["pricing"] = el }} id="section-pricing">
              <h2>{showFlatPricing ? '💰 Pricing' : '📋 Details'}</h2>
              {showFlatPricing && (
                <div className="pricing-list">
                  {pricing.map((item, i) => {
                    // Support both real DB schema (item_name, price) and extended schema (tier_name, price_from/to)
                    const name = item.tier_name || item.item_name
                    const priceVal = item.price_from ?? item.price
                    const priceDisplay = priceVal != null
                      ? (item.price_to != null && item.price_to !== priceVal
                          ? `$${priceVal}–$${item.price_to}`
                          : `$${priceVal}`)
                      : 'Call for pricing'
                    const isFree = priceVal === 0
                    return (
                      <div key={item.id || i} className="pricing-row">
                        <div className="pricing-name">
                          {name}
                          {item.minimum_age != null && priceVal === 0 && (
                            <span className="pricing-age-note"> (under {item.minimum_age} free)</span>
                          )}
                          {item.minimum_age != null && priceVal !== 0 && (
                            <span className="pricing-age-note"> (ages {item.minimum_age}+)</span>
                          )}
                        </div>
                        <div className="pricing-right">
                          <span className={`pricing-price${isFree ? ' pricing-free' : ''}`}>
                            {isFree ? 'FREE' : priceDisplay}
                          </span>
                          {item.price_label && !isFree && (
                            <span className="pricing-label"> {item.price_label}</span>
                          )}
                          {item.duration && (
                            <div className="pricing-duration">⏱ {item.duration}</div>
                          )}
                          {item.description && <div className="pricing-desc">{item.description}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {whatsIncluded.length > 0 && (
                <div className="whats-included">
                  <h3>✅ What's Included</h3>
                  <ul>
                    {whatsIncluded.map((item, i) => (
                      <li key={item.id || i}>
                        {item.icon && <span>{item.icon} </span>}
                        {item.included_item || item.item_name}
                        {item.description && <span className="included-desc"> — {item.description}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(business.whats_excluded || []).length > 0 && (
                <div className="whats-included">
                  <h3>🚫 Not Included</h3>
                  <ul>
                    {(business.whats_excluded || []).map((item, i) => (
                      <li key={item.id || i}>{item.excluded_item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {requirements.length > 0 && (
                <div className="requirements-list">
                  <h3>📋 Requirements</h3>
                  <ul>
                    {requirements.map((item, i) => (
                      <li key={item.id || i}>
                        {item.requirement_text || item.requirement_name}
                        {item.description && <span className="req-desc"> — {item.description}</span>}
                        {item.applies_to && item.applies_to !== 'all' && (
                          <span className="req-applies"> ({item.applies_to})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What to Bring */}
              {whatToBring.length > 0 && (
                <div className="what-to-bring">
                  <h3>🎒 What to Bring</h3>
                  <ul>
                    {whatToBring.map((item, i) => (
                      <li key={item.id || i}>{item.item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activity Details — duration, difficulty, trip notes */}
              {activityDetails && (
                <div className="activity-details-block">
                  {activityDetails.duration_hours && (
                    <div className="act-detail-row">⏱ <strong>Duration:</strong> {activityDetails.duration_hours} hours</div>
                  )}
                  {activityDetails.difficulty && (
                    <div className="act-detail-row">📊 <strong>Difficulty:</strong> {activityDetails.difficulty}</div>
                  )}
                  {activityDetails.min_age && (
                    <div className="act-detail-row">👤 <strong>Min Age:</strong> {activityDetails.min_age}+</div>
                  )}
                  {activityDetails.group_size_max && (
                    <div className="act-detail-row">👥 <strong>Max Group:</strong> {activityDetails.group_size_max} people</div>
                  )}
                  {activityDetails.notes && (
                    <div className="act-detail-row act-notes">{activityDetails.notes}</div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
                      <section className="content-section" ref={el => { sectionRefs.current["faqs"] = el }} id="section-faqs">
              <h2>❓ Frequently Asked Questions</h2>
                <div className="faqs-list">
                  {faqs.map((faq, i) => (
                    <div key={faq.id || i} className="faq-row">
                      <div className="faq-question">{faq.question}</div>
                      <div className="faq-answer">{faq.answer}</div>
                    </div>
                  ))}
                </div>
            </section>
          )}

          {/* Events */}
          {events.length > 0 && (
                      <section className="content-section" ref={el => { sectionRefs.current["events"] = el }} id="section-events">
              <h2>🎉 Events</h2>
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0]
                  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
                  // Dated events first (chronological), then recurring / undated
                  const dated = events.filter(ev => ev.event_date).sort((a, b) => a.event_date.localeCompare(b.event_date))
                  const undated = events.filter(ev => !ev.event_date)
                  const ordered = [...dated, ...undated]
                  const whenLabel = ev => {
                    if (ev.event_date) {
                      const base = ev.event_date === todayStr ? 'Today'
                        : ev.event_date === tomorrowStr ? 'Tomorrow'
                        : new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      const t = ev.start_time ? formatTime(ev.start_time) : ''
                      const e = ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''
                      return `${base}${t ? ` · ${t}` : ''}${e}`
                    }
                    if (ev.recurring && ev.day_of_week) {
                      const t = ev.start_time ? ` · ${formatTime(ev.start_time)}` : ''
                      return `Every ${ev.day_of_week}${t}`
                    }
                    return ev.start_time ? formatTime(ev.start_time) : ''
                  }
                  return (
                    <div className="bd-events-scroller">
                      {ordered.map((ev, i) => (
                        <div key={ev.id || i} className="bd-event-card">
                          <div
                            className={`bd-event-img${ev.image_url ? '' : ' no-img'}`}
                            style={ev.image_url ? { backgroundImage: `url(${ev.image_url})` } : undefined}
                          >
                            {!ev.image_url && <span className="bd-event-img-emoji">🎶</span>}
                            {whenLabel(ev) && <div className="bd-event-when">{whenLabel(ev)}</div>}
                          </div>
                          <div className="bd-event-body">
                            <div className="bd-event-name">{ev.event_name || ev.name}</div>
                            {ev.artist_name && (
                              ev.artist_slug
                                ? <div className="bd-event-artist link" onClick={(e) => { e.stopPropagation(); navigate('/artist/' + ev.artist_slug) }}>🎤 {ev.artist_name} →</div>
                                : <div className="bd-event-artist">🎤 {ev.artist_name}</div>
                            )}
                            {ev.description && <div className="bd-event-desc">{ev.description}</div>}
                            {ev.cover_charge != null && (
                              <div className="bd-event-cover">
                                💵 {Number(ev.cover_charge) > 0 ? `$${ev.cover_charge} cover` : 'Free admission'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
            </section>
          )}

          {/* Schedule (activity departure times / tour schedules) */}
          {schedules.length > 0 && (
            <section className="content-section" ref={el => { sectionRefs.current["schedule"] = el }} id="section-schedule">
              <h2>🗓️ Schedule & Departures</h2>
              {(() => {
                const grouped = schedules.reduce((acc, s) => {
                  const key = s.schedule_type || s.label || 'Schedule'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(s)
                  return acc
                }, {})
                return Object.entries(grouped).map(([type, items]) => (
                  <div key={type} className="schedule-group">
                    {Object.keys(grouped).length > 1 && (
                      <h3 className="schedule-type">{type.replace(/_/g, ' ')}</h3>
                    )}
                    <div className="schedule-list">
                      {items.map((s, i) => (
                        <div key={s.id || i} className="schedule-row">
                          <div className="schedule-label">{s.label || s.name || s.schedule_name}</div>
                          <div className="schedule-time">
                            {s.time_start && formatTime(s.time_start)}
                            {s.time_end && ` – ${formatTime(s.time_end)}`}
                          </div>
                          {s.days_of_week && (
                            <div className="schedule-days">{s.days_of_week}</div>
                          )}
                          {s.duration && (
                            <div className="schedule-duration">⏱ {s.duration}</div>
                          )}
                          {s.notes && <div className="schedule-notes">{s.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </section>
          )}

          {/* Hours */}
          {hours.length > 0 && (
            <section className="content-section" ref={el => { sectionRefs.current["hours"] = el }} id="section-hours">
              <h2>Hours</h2>
              <ul className="hours-list">
                {hours.map((hr, idx) => (
                  <li key={idx} className={hr.day_of_week === new Date().getDay() ? 'today' : ''}>
                    <span className="day">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hr.day_of_week || 0]}
                    </span>
                    <span className="time">
                      {hr.is_closed
                        ? 'Closed'
                        : `${formatTime(hr.opens_at) || '—'} – ${formatTime(hr.closes_at) || '—'}`}
                    </span>
                  </li>
                ))}
              </ul>
              {business.secondary_hours?.length > 0 && (() => {
                const grouped = (business.secondary_hours || []).reduce((acc, h) => {
                  const key = h.hours_type || 'Other'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(h)
                  return acc
                }, {})
                const typeLabels = {
                  delivery: '🛵 Delivery Hours',
                  tour_departures: '⛵ Tour Departures',
                  pickups: '🚗 Pickup Hours',
                  kitchen_hours: '🍳 Kitchen Hours',
                }
                return Object.entries(grouped).map(([type, hrs]) => (
                  <div key={type} className="secondary-hours-group">
                    <h3>{typeLabels[type] || type.replace(/_/g, ' ')}</h3>
                    <ul className="hours-list">
                      {hrs.filter(h => h.is_active !== false).map((hr, idx) => (
                        <li key={idx}>
                          <span className="day">
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hr.day_of_week || 0]}
                          </span>
                          <span className="time">
                            {hr.is_closed
                              ? 'Closed'
                              : `${formatTime(hr.opens_at) || '—'} – ${formatTime(hr.closes_at) || '—'}`}
                          </span>
                          {hr.description && <span className="hours-note">{hr.description}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              })()}
            </section>
          )}

          {/* Location */}
                      <section className="content-section" ref={el => { sectionRefs.current["location"] = el }} id="section-location">
              <h2>Location</h2>
              <p className="address">
                📍 {business.address_line_1}<br />
                {[business.city, business.state, business.zip].filter(Boolean).join(', ')}
              </p>
              {business.directions_url && (
                <a href={business.directions_url} target="_blank" rel="noopener noreferrer" className="btn btn-directions">
                  📍 Get Directions
                </a>
              )}
            </section>

          {/* Gallery */}
          {photos.length > 0 && (
                      <section className="content-section" ref={el => { sectionRefs.current["gallery"] = el }} id="section-gallery">
              <h2>Photos ({photos.length})</h2>
              <div className="gallery-grid-preview">
                {photos.slice(galleryPage * GALLERY_PER_PAGE, (galleryPage + 1) * GALLERY_PER_PAGE).map((photo, idx) => (
                  <img
                    key={idx}
                    src={fixUrl(photo.image_url || photo.url)}
                    alt={photo.caption || business.name}
                    className="gallery-preview-img"
                    onClick={() => { setGalleryOpen(true); setGalleryPage(Math.floor((galleryPage * GALLERY_PER_PAGE + idx) / GALLERY_PER_PAGE)) }}
                  />
                ))}
              </div>
              {galleryTotal > 1 && (
                <div className="gallery-pagination">
                  <button disabled={galleryPage === 0} onClick={() => setGalleryPage(p => p - 1)}>← Prev</button>
                  <span>{galleryPage + 1} / {galleryTotal}</span>
                  <button disabled={galleryPage >= galleryTotal - 1} onClick={() => setGalleryPage(p => p + 1)}>Next →</button>
                </div>
              )}
            </section>
          )}

          {/* Reviews */}
          <div ref={el => { sectionRefs.current["reviews"] = el }} id="section-reviews"><ReviewsSection slug={slug} googleRating={business.rating} googleReviewCount={business.review_count} /></div>

          {/* Team / Blog / Policies — only render when there's actually
              something to show. These flags are already computed from the
              same fetches that gate the tab nav, so an empty business no
              longer shows "No team members listed" placeholder blocks. */}
          {hasTeam && (
            <div ref={el => { sectionRefs.current["team"] = el }} id="section-team"><TeamSection slug={slug} /></div>
          )}

          {hasBlog && (
            <div ref={el => { sectionRefs.current["blog"] = el }} id="section-blog"><BlogSection slug={slug} /></div>
          )}

          {hasPolicies && (
            <div ref={el => { sectionRefs.current["policies"] = el }} id="section-policies"><PoliciesSection slug={slug} policies={business.policies} /></div>
          )}

          {/* Menu */}
          {hasMenu && (
                      <section className="content-section" ref={el => { sectionRefs.current["menu"] = el }} id="section-menu">
              <h2>🍽️ Menu</h2>

              {/* Today's Features — rotating food sections (Catch of the Day, Daily Special, etc.) */}
              {foodRotating.length > 0 && (
                <div
                  className="menu-period-group"
                  data-secid="menu-rotating"
                  ref={el => { subSectionRefs.current['menu-rotating'] = el }}
                >
                  <div className="meal-period-header">
                    <span className="meal-period-label">⭐ Today's Features</span>
                  </div>
                  {foodRotating.map(rot => (
                    <div key={rot.id} className="menu-section">
                      <h3>{rot.name}</h3>
                      <div className="menu-items">
                        {(rot.items || []).filter(it => it.active !== false).map((item, i) => renderMenuItem(item, i))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Meal period groups */}
              {menuGroups.length > 0 ? menuGroups.map(({ period, sections: grpSections }) => {
                const periodId = `menu-period-${period}`
                return (
                  <div
                    key={period}
                    className="menu-period-group"
                    data-secid={periodId}
                    ref={el => { subSectionRefs.current[periodId] = el }}
                  >
                    <div className="meal-period-header">
                      <span className="meal-period-label">
                        {{ Breakfast: '🍳', Brunch: '🥂', Lunch: '🥗', Dinner: '🍷', 'Late Night': '🌙', 'All Day': '🍽️' }[period] || '🍽️'} {period}
                      </span>
                    </div>
                    {grpSections.map(section => {
                      const secId = `menu-sec-${section.id || section.section_name || section.name}`
                      const timeRange = section.time_range
                      const days = section.available_days
                      // Strip the meal-period prefix from the section name when it's already
                      // shown as the group header — "Lunch Desserts" → "Desserts" under 🥗 Lunch
                      const rawName = section.section_name || section.name || ''
                      const periodPrefixes = ['Breakfast ', 'Brunch ', 'Lunch ', 'Dinner ', 'Late Night ', 'All Day ']
                      const displayName = periodPrefixes.reduce((n, p) => n.startsWith(p) ? n.slice(p.length) : n, rawName)
                      return (
                        <div
                          key={secId}
                          className="menu-section menu-section-anchor"
                          data-secid={secId}
                          ref={el => { subSectionRefs.current[secId] = el }}
                        >
                          <div className="section-header-row">
                            <h3>{displayName}</h3>
                            {(timeRange || days) && (
                              <span className="section-meta">
                                {timeRange && `${formatTime(timeRange.split('-')[0])}–${formatTime(timeRange.split('-')[1])}`}
                                {days && ` · ${days}`}
                              </span>
                            )}
                          </div>
                          <div className="menu-items">
                            {(section.items || []).map((item, i) => renderMenuItem(item, i))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }) : !foodRotating.length && (
                <p className="no-data">No menu available</p>
              )}
            </section>
          )}

          {/* Drinks */}
          {hasDrinks && (
                      <section className="content-section" ref={el => { sectionRefs.current["drinks"] = el }} id="section-drinks">
              <h2>🍷 Drinks</h2>

              {/* On tap / featured rotating drinks (Beer on Tap, etc.) */}
              {drinkRotating.length > 0 && (
                <div
                  className="menu-period-group"
                  data-secid="drinks-rotating"
                  ref={el => { subSectionRefs.current['drinks-rotating'] = el }}
                >
                  <div className="meal-period-header">
                    <span className="meal-period-label">🍺 On Tap &amp; Featured</span>
                  </div>
                  {drinkRotating.map(rot => (
                    <div key={rot.id} className="menu-section">
                      <h3>{rot.name}</h3>
                      <div className="menu-items">
                        {(rot.items || []).filter(it => it.active !== false).map((item, i) => renderMenuItem(item, i))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {flatDrinkSections.length > 0 ? flatDrinkSections.map(section => {
                const secId = `drink-sec-${section.id || section.section_name || section.name}`
                const timeRange = section.time_range
                const days = section.available_days
                return (
                  <div
                    key={secId}
                    className="menu-period-group menu-section-anchor"
                    data-secid={secId}
                    ref={el => { subSectionRefs.current[secId] = el }}
                  >
                    <div className="meal-period-header">
                      <span className="meal-period-label">
                        {section.section_name || section.name}
                      </span>
                      {(timeRange || days) && (
                        <span className="section-meta" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginLeft: 10 }}>
                          {timeRange && `${formatTime(timeRange.split('-')[0])}–${formatTime(timeRange.split('-')[1])}`}
                          {days && ` · ${days}`}
                        </span>
                      )}
                    </div>
                    <div className="menu-items">
                      {(section.items || []).map((item, i) => renderMenuItem(item, i))}
                    </div>
                  </div>
                )
              }) : !drinkRotating.length && (
                <p className="no-data">No drink menu available</p>
              )}
              {/* Order Links — DoorDash, UberEats, direct online order */}
              {orderLinks.length > 0 && (
                <div className="order-links-section">
                  <h3>🛵 Order Online</h3>
                  <div className="order-links-grid">
                    {orderLinks.map((link, i) => (
                      <a
                        key={link.id || i}
                        href={link.url}
                        onClick={e => trackAndOpen(e, link.url, 'order')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="order-link-btn"
                      >
                        {link.label || link.type || 'Order Now'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Specials */}
          {hasSpecials && (
                      <section className="content-section" ref={el => { sectionRefs.current["specials"] = el }} id="section-specials">
              <h2>⭐ Specials</h2>

              {dailyFeatures.length > 0 && (
                <div className="menu-section" style={{marginBottom: 24}}>
                  <h3>Daily Features</h3>
                  <div className="menu-items">
                    {dailyFeatures.map((item, i) => renderMenuItem(item, i))}
                  </div>
                </div>
              )}

              {allSpecials.length > 0 && (
                <div className="menu-section" style={{marginBottom: 24}}>
                  <h3>Today's Specials</h3>
                  <div className="menu-items">
                    {allSpecials.map((item, i) => renderMenuItem(item, i))}
                  </div>
                </div>
              )}

              {sides.length > 0 && (
                <div className="menu-section">
                  <h3>Sides &amp; Add-Ons</h3>
                  <div className="menu-items">
                    {sides.map((item, i) => renderMenuItem(item, i))}
                  </div>
                </div>
              )}

              {!dailyFeatures.length && !allSpecials.length && !sides.length && (
                <p className="no-data">No specials right now</p>
              )}
            </section>
          )}

          {/* SOCIAL FEED */}
          {hasSocialPosts && (
                      <section className="content-section" ref={el => { sectionRefs.current["social"] = el }} id="section-social">
              <h2>📱 Social Feed</h2>
              <div className="social-feed-grid">
                {socialPosts.map(post => (
                  <a
                    key={post.id}
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-feed-card"
                  >
                    {post.image_url
                      ? <img src={post.image_url} alt={post.card_title || 'Post'} className="social-feed-img" />
                      : <div className="social-feed-placeholder">
                          {post.source === 'instagram' ? '📸' : '📘'}
                        </div>
                    }
                    <div className="social-feed-body">
                      <span className="social-feed-source">
                        {post.source === 'instagram' ? '📸 Instagram' : post.source === 'facebook' ? '📘 Facebook' : '📱 Social'}
                      </span>
                      {post.caption && <p className="social-feed-caption">{post.caption.slice(0, 120)}{post.caption.length > 120 ? '…' : ''}</p>}
                      <span className="social-feed-link">View post →</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ROOMS — Hotel / Condo / Vacation Rental */}
          {hasRooms && (
                      <section className="content-section" ref={el => { sectionRefs.current["rooms"] = el }} id="section-rooms">
              <h2>🛏️ Rooms & Units</h2>
              {propertyDetails && (
                <div className="property-meta-row">
                  {propertyDetails.check_in_time && <span>Check-in: {propertyDetails.check_in_time}</span>}
                  {propertyDetails.check_out_time && <span>Check-out: {propertyDetails.check_out_time}</span>}
                  {propertyDetails.total_rooms && <span>{propertyDetails.total_rooms} rooms</span>}
                  {propertyDetails.star_rating && <span>{'⭐'.repeat(Math.round(propertyDetails.star_rating))}</span>}
                </div>
              )}
              {roomTypes.length === 0 ? (
                <p className="no-data">No room types listed yet</p>
              ) : (
                <div className="room-list">
                  {roomTypes.map((room, i) => (
                    <div key={room.id || i} className="room-card">
                      <div className="room-head">
                        <span className="room-name">{room.name}</span>
                        {room.price_per_night != null && (
                          <span className="room-price">${room.price_per_night}<span className="room-unit">/night</span></span>
                        )}
                      </div>
                      <div className="room-specs">
                        {room.beds && <span>🛏️ {room.beds}</span>}
                        {room.sleeps && <span>👥 Sleeps {room.sleeps}</span>}
                        {room.bedrooms && <span>🚪 {room.bedrooms} bed{room.bedrooms !== 1 ? 's' : ''}</span>}
                        {room.bathrooms && <span>🚿 {room.bathrooms} bath</span>}
                        {room.sqft && <span>📐 {room.sqft.toLocaleString()} sqft</span>}
                        {room.view && <span>🌊 {room.view}</span>}
                        {room.floor && <span>🏢 {room.floor}</span>}
                      </div>
                      {room.description && <p className="room-desc">{room.description}</p>}
                    </div>
                  ))}
                </div>
              )}
              {propertyFees.length > 0 && (
                <div className="fees-section">
                  <h3>Fees</h3>
                  {propertyFees.map((fee, i) => (
                    <div key={fee.id || i} className="fee-row">
                      <span>{fee.name}{!fee.mandatory && ' (optional)'}</span>
                      <span>${fee.amount} {fee.type?.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* AMENITIES — Hotel / Stay */}
          {hasAmenities && (
                      <section className="content-section" ref={el => { sectionRefs.current["amenities"] = el }} id="section-amenities">
              <h2>✨ Amenities</h2>
              {/* Unit's own amenities + inherited complex amenities */}
              {ownAmenities.length > 0 && (
                <div className="amenity-group">
                  {(complexAmenities.length > 0 || business.parent) && <h3>🚪 {business.parent ? 'In this unit' : 'On site'}</h3>}
                  <div className="amenities-grid">
                    {ownAmenities.map((a, i) => (
                      <div key={`own-${i}`} className="amenity-item">✓ {String(a).replace(/_/g, ' ')}</div>
                    ))}
                  </div>
                </div>
              )}
              {complexAmenities.length > 0 && business.parent && (
                <div className="amenity-group">
                  <h3>🏛 At {business.parent.name}</h3>
                  <div className="amenities-grid">
                    {complexAmenities.map((a, i) => (
                      <div key={`cx-${i}`} className="amenity-item">✓ {String(a).replace(/_/g, ' ')}</div>
                    ))}
                  </div>
                </div>
              )}
              {amenities.length === 0 ? (
                ownAmenities.length === 0 && complexAmenities.length === 0 ? <p className="no-data">No amenities listed yet</p> : null
              ) : (
                <>
                  {/* Group by category */}
                  {(() => {
                    const grouped = amenities.reduce((acc, a) => {
                      const cat = a.category || 'General'
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push(a)
                      return acc
                    }, {})
                    return Object.entries(grouped).map(([cat, items]) => (
                      <div key={cat} className="amenity-group">
                        {Object.keys(grouped).length > 1 && <h3>{cat}</h3>}
                        <div className="amenities-grid">
                          {items.map((a, i) => (
                            <div key={a.id || i} className="amenity-item">
                              {a.icon && <span>{a.icon} </span>}
                              {a.name}
                              {a.is_shared === false && <span className="amenity-badge">In-unit</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </>
              )}
            </section>
          )}

          {/* BOOK / STAY LINKS */}
          {stayLinks.length > 0 && (
                      <section className="content-section" ref={el => { sectionRefs.current["book-stay"] = el }} id="section-book-stay">
              <h2>🔗 Book This Property</h2>
              <div className="stay-links-list">
                {stayLinks.map((link, i) => (
                  <a key={link.id || i} href={link.url} target="_blank" rel="noopener noreferrer" className="stay-link-btn">
                    {link.label} →
                  </a>
                ))}
              </div>
              {bookableResources.length > 0 && (
                <div style={{marginTop:20}}>
                  <h3>Available Units</h3>
                  {bookableResources.map((r, i) => (
                    <div key={r.id || i} className="bookable-row">
                      <span>{r.name}</span>
                      {r.capacity && <span>👥 {r.capacity}</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SERVICES — Salon / Spa / Gym / Service */}
          {hasServices && (
                      <section className="content-section" ref={el => { sectionRefs.current["services"] = el }} id="section-services">
              <h2>💆 Services</h2>
              {servicePackages.length > 0 && (
                <div className="packages-section">
                  <h3>Packages</h3>
                  <div className="package-list">
                    {servicePackages.map((pkg, i) => (
                      <div key={pkg.id || i} className="package-card">
                        <div className="package-head">
                          <span className="package-name">{pkg.name}</span>
                          {pkg.price != null && <span className="package-price">${pkg.price}</span>}
                        </div>
                        {pkg.description && <p className="package-desc">{pkg.description}</p>}
                        {pkg.includes?.length > 0 && (
                          <ul className="package-includes">
                            {pkg.includes.map((inc, j) => <li key={j}>✓ {inc}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {serviceCategories.length > 0 ? (
                serviceCategories.map(cat => {
                  const catServices = serviceMenu.filter(s => s.category_id === cat.id)
                  return catServices.length ? (
                    <div key={cat.id} className="service-category">
                      <h3>{cat.name}</h3>
                      <div className="service-list">
                        {catServices.map((svc, i) => (
                          <div key={svc.id || i} className="service-row">
                            <div className="service-info">
                              <span className="service-name">{svc.name}</span>
                              {svc.duration_minutes && <span className="service-duration">⏱ {svc.duration_minutes}min</span>}
                              {svc.description && <p className="service-desc">{svc.description}</p>}
                            </div>
                            {svc.price != null && <span className="service-price">${svc.price}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })
              ) : serviceMenu.length > 0 ? (
                <div className="service-list">
                  {serviceMenu.map((svc, i) => (
                    <div key={svc.id || i} className="service-row">
                      <div className="service-info">
                        <span className="service-name">{svc.name}</span>
                        {svc.duration_minutes && <span className="service-duration">⏱ {svc.duration_minutes}min</span>}
                        {svc.description && <p className="service-desc">{svc.description}</p>}
                      </div>
                      {svc.price != null && <span className="service-price">${svc.price}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No services listed yet</p>
              )}
              {classSchedule.length > 0 && (
                <div className="class-schedule-section">
                  <h3>Class Schedule</h3>
                  {classSchedule.map((cls, i) => (
                    <div key={cls.id || i} className="class-row">
                      <div>
                        <span className="class-name">{cls.class_name}</span>
                        {cls.start_time && <span className="class-time"> · {cls.start_time}</span>}
                        {cls.duration_minutes && <span className="class-duration"> · {cls.duration_minutes}min</span>}
                        {cls.capacity && <span className="class-cap"> · {cls.capacity} spots</span>}
                      </div>
                      <span className="class-day">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][cls.day_of_week] || cls.day_of_week}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* PRODUCTS — Shopping */}
          {hasProducts && (
                      <section className="content-section" ref={el => { sectionRefs.current["products"] = el }} id="section-products">
              <h2>🛍️ Products</h2>
              {productCategories.length > 0 ? (
                productCategories.map(cat => {
                  const catProducts = products.filter(p => p.category_id === cat.id)
                  return catProducts.length ? (
                    <div key={cat.id} className="product-category">
                      <h3>{cat.name}</h3>
                      <div className="product-grid">
                        {catProducts.map((prod, i) => (
                          <div key={prod.id || i} className="product-card">
                            <div className="product-head">
                              <span className="product-name">{prod.name}</span>
                              <span className="product-price">${prod.price}</span>
                            </div>
                            {prod.description && <p className="product-desc">{prod.description}</p>}
                            {!prod.in_stock && <span className="out-of-stock">Out of stock</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })
              ) : products.length > 0 ? (
                <div className="product-grid">
                  {products.map((prod, i) => (
                    <div key={prod.id || i} className="product-card">
                      <div className="product-head">
                        <span className="product-name">{prod.name}</span>
                        <span className="product-price">${prod.price}</span>
                      </div>
                      {prod.description && <p className="product-desc">{prod.description}</p>}
                      {!prod.in_stock && <span className="out-of-stock">Out of stock</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-data">No products listed yet</p>
              )}
            </section>
          )}

          {/* PARK INFO */}
          {hasParkInfo && (
                      <section className="content-section" ref={el => { sectionRefs.current["park-info"] = el }} id="section-park-info">
              <h2>🌳 Park Information</h2>
              {accessInfo && (
                <div className="access-info">
                  {accessInfo.entry_point && <p>🚗 <strong>Entry:</strong> {accessInfo.entry_point}</p>}
                  {accessInfo.parking_note && <p>🅿️ <strong>Parking:</strong> {accessInfo.parking_note}</p>}
                  {accessInfo.fee != null && accessInfo.fee > 0 && <p>💵 <strong>Entry fee:</strong> ${accessInfo.fee}</p>}
                  {accessInfo.fee === 0 && <p>✅ <strong>Free entry</strong></p>}
                </div>
              )}
              {facilities.length > 0 && (
                <div className="facilities-section">
                  <h3>Facilities</h3>
                  <div className="amenities-grid">
                    {facilities.map((f, i) => (
                      <div key={f.id || i} className={`amenity-item ${f.available === false ? 'unavailable' : ''}`}>
                        {f.available === false ? '❌' : '✅'} {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {spotRules.length > 0 && (
                <div className="rules-section">
                  <h3>Rules</h3>
                  <ul className="rules-list">
                    {spotRules.map((r, i) => (
                      <li key={r.id || i}>{r.rule}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* MEETING POINT — Activity / Charter */}
          {hasMeetingPoints && (
                      <section className="content-section" ref={el => { sectionRefs.current["meeting"] = el }} id="section-meeting">
              <h2>📌 Meeting Point</h2>
              {meetingPoints.map((mp, i) => (
                <div key={mp.id || i} className="meeting-point-card">
                  <h3>{mp.name}</h3>
                  {mp.address && <p>📍 {mp.address}</p>}
                  {mp.instructions && <p>{mp.instructions}</p>}
                  {mp.parking_note && <p>🅿️ {mp.parking_note}</p>}
                  {mp.lat && mp.lng && (
                    <a href={`https://maps.google.com/?q=${mp.lat},${mp.lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-directions">
                      📍 Get Directions
                    </a>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* FISH SPECIES — Charter / Fishing */}
          {hasFishSpecies && (
                      <section className="content-section" ref={el => { sectionRefs.current["fish"] = el }} id="section-fish">
              <h2>🐟 Fish Species</h2>
              <div className="fish-grid">
                {fishSpecies.map((f, i) => (
                  <div key={f.id || i} className="fish-card">
                    <span className="fish-name">{f.species}</span>
                    {f.season && <span className="fish-season">Season: {f.season}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

        </main>

        {/* Sidebar */}
        <aside className="content-sidebar">
          {/* Quick Actions */}
          <div className="sidebar-card">
            <h3 className="sidebar-title">Quick Actions</h3>
            {business.phone && (
              <a href={`tel:${business.phone}`} className="sidebar-btn">📞 Call Now</a>
            )}
            {business.directions_url && (
              <a href={business.directions_url} target="_blank" rel="noopener noreferrer" className="sidebar-btn">
                📍 Directions
              </a>
            )}
            {business.menu_url && (
              <a href={business.menu_url} target="_blank" rel="noopener noreferrer" className="sidebar-btn">
                📄 Menu
              </a>
            )}
            {business.reservation_url && (
              <a href={business.reservation_url} onClick={e => trackAndOpen(e, business.reservation_url, 'reserve')} target="_blank" rel="noopener noreferrer" className="sidebar-btn">
                🍽️ Reserve
              </a>
            )}
            {business.order_url && (
              <a href={business.order_url} onClick={e => trackAndOpen(e, business.order_url, 'order')} target="_blank" rel="noopener noreferrer" className="sidebar-btn">
                🛵 Order
              </a>
            )}
            {orderLinks.length > 0 && orderLinks.map((link, i) => (
              <a
                key={link.id || i}
                href={link.url}
                onClick={e => trackAndOpen(e, link.url, 'order')}
                target="_blank"
                rel="noopener noreferrer"
                className="sidebar-btn"
              >
                🛵 {link.label || link.type || 'Order Online'}
              </a>
            ))}
            {business.website_url && (
              <a href={business.website_url} target="_blank" rel="noopener noreferrer" className="sidebar-btn">
                🌐 Website
              </a>
            )}
          </div>

          {/* Happy Hour Sidebar */}
          {business.hh_days && (
            <div className="sidebar-card hh-card">
              <h3 className="sidebar-title">🍺 Happy Hour</h3>
              <p>{business.hh_days}</p>
            </div>
          )}

          {/* Related profiles — same-property businesses */}
          {business.parent && siblings.length > 0 && (
            <div className="sidebar-card">
              <h3 className="sidebar-title">More at {business.parent.name}</h3>
              {siblings.map(sib => (
                <button key={sib.slug} className="sidebar-btn related-btn" onClick={() => navigate(`/business/${sib.slug}`)}>
                  <span className="related-name">{sib.name}</span>
                  {sib.type && <span className="related-sub">{String(sib.type).replace(/_/g, ' ')}</span>}
                </button>
              ))}
              <button className="sidebar-btn" onClick={() => navigate(`/business/${business.parent.slug}`)}>
                🏛 View all at {business.parent.name}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Gallery Modal */}
      {galleryOpen && (
        <div className="modal-overlay" onClick={() => setGalleryOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setGalleryOpen(false)}>✕</button>
            <h2>📸 Photos</h2>
            <div className="gallery-grid">
              {photos.slice(galleryPage * GALLERY_PER_PAGE, (galleryPage + 1) * GALLERY_PER_PAGE).map((photo, idx) => (
                <img key={idx} src={fixUrl(photo.image_url || photo.url)} alt="" className="gallery-img" />
              ))}
            </div>
            {galleryTotal > 1 && (
              <div className="modal-pagination">
                <button disabled={galleryPage === 0} onClick={() => setGalleryPage(p => p - 1)}>← Prev</button>
                <span>Page {galleryPage + 1} of {galleryTotal}</span>
                <button disabled={galleryPage >= galleryTotal - 1} onClick={() => setGalleryPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
