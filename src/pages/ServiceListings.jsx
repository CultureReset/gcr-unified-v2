/**
 * SERVICES PAGE  —  /services
 * Spa · Salon · Nail · Massage · Photographer · Car Rental · Fitness · Yoga · Health · Real Estate
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { API_BASE } from '../config'
import './ServiceListings.css'

const SERVICE_TABS = [
  { id: 'all',         label: 'All Services',    emoji: '🛠️', subtypes: null },
  { id: 'spa',         label: 'Spa & Massage',   emoji: '💆', subtypes: ['spa','massage','massage_spa','wellness_center'] },
  { id: 'salon',       label: 'Hair & Nails',    emoji: '💇', subtypes: ['hair_salon','nail_salon','beauty_salon','barber_shop','salon','beauty-salon','salon-spa'] },
  { id: 'photo',       label: 'Photographers',   emoji: '📸', subtypes: ['photographer'] },
  { id: 'fitness',     label: 'Fitness & Yoga',  emoji: '💪', subtypes: ['fitness_center','yoga_studio','gym','sports_club'] },
  { id: 'car',         label: 'Car Rental',      emoji: '🚗', subtypes: ['car_rental','car-rental'] },
  { id: 'transport',   label: 'Transportation',  emoji: '🚕', subtypes: ['transportation_service','taxi_service','chauffeur_service','airport_shuttle_service'] },
  { id: 'pet',         label: 'Pet Services',    emoji: '🐾', subtypes: ['veterinary_care','pet_care','pet_boarding_service'] },
  { id: 'health',      label: 'Health',          emoji: '🏥', subtypes: ['medical_clinic','medical_center','doctor','chiropractor','physiotherapist','dentist'] },
  { id: 'realestate',  label: 'Real Estate',     emoji: '🏠', subtypes: ['real_estate_agency','real-estate','real-estate-agent'] },
]

// Single source of truth for which subtypes count as a "service" — derived from
// SERVICE_TABS so the fetch filter can never drift out of sync with the tab bar again.
const ALL_SERVICE_SUBTYPES = new Set(SERVICE_TABS.flatMap(t => t.subtypes || []))

// The badge reflects where THIS business actually takes bookings — derived
// from its real booking_url, never assumed from the business type.
const PLATFORM_DOMAINS = {
  'vagaro.com': { label: 'Book on Vagaro', color: '#7c3aed' },
  'mindbodyonline.com': { label: 'Book on MindBody', color: '#059669' },
  'styleseat.com': { label: 'Book on StyleSeat', color: '#db2777' },
  'booksy.com': { label: 'Book on Booksy', color: '#1d4ed8' },
  'honeybook.com': { label: 'Book on HoneyBook', color: '#d97706' },
  'squareup.com': { label: 'Book Online', color: '#111827' },
  'square.site': { label: 'Book Online', color: '#111827' },
}
function bookingPlatform(entity) {
  const url = entity.booking_url || entity.reservation_url
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const match = Object.keys(PLATFORM_DOMAINS).find(d => host === d || host.endsWith('.' + d))
    return match ? PLATFORM_DOMAINS[match] : { label: 'Book Now', color: '#0f766e' }
  } catch (e) { return { label: 'Book Now', color: '#0f766e' } }
}

function ServiceCard({ entity, navigate }) {
  const [imgFailed, setImgFailed] = useState(false)
  const img = entity.hero_image_url
  const subtype = (entity.entity_subtype || '').toLowerCase()
  const platform = bookingPlatform(entity)
  const rating = entity.rating ? parseFloat(entity.rating).toFixed(1) : null

  const LABELS = {
    spa:'💆 Spa', massage:'💆 Massage', massage_spa:'💆 Spa & Massage',
    hair_salon:'💇 Hair Salon', nail_salon:'💅 Nail Salon', beauty_salon:'💄 Beauty Salon',
    barber_shop:'✂️ Barber', salon:'💇 Salon', fitness_center:'💪 Fitness',
    yoga_studio:'🧘 Yoga', photographer:'📸 Photographer', car_rental:'🚗 Car Rental',
    transportation_service:'🚕 Transportation', taxi_service:'🚕 Taxi',
    veterinary_care:'🐾 Vet', pet_care:'🐾 Pet Care', medical_clinic:'🏥 Medical',
    real_estate_agency:'🏠 Real Estate', wellness_center:'🌿 Wellness',
  }
  const typeLabel = LABELS[subtype] || '🛠️ Service'

  return (
    <article className="svc-card" onClick={() => navigate(`/business/${entity.slug}`)}>
      <div className="svc-card-img">
        {img && !imgFailed
          ? <img src={img} alt={entity.name} loading="lazy" onError={() => setImgFailed(true)} />
          : <div className="svc-card-placeholder">{typeLabel.split(' ')[0]}</div>
        }
        <div className="svc-type-badge">{typeLabel}</div>
        {platform && (
          <div className="svc-platform-badge" style={{ background: platform.color }}>
            {platform.label}
          </div>
        )}
      </div>
      <div className="svc-card-body">
        <div className="svc-card-name">{entity.name}</div>
        <div className="svc-card-city">{entity.city || 'Gulf Coast'}</div>
        {entity.description && (
          <p className="svc-card-desc">{entity.description.slice(0, 85)}...</p>
        )}
        {rating && (
          <div className="svc-card-rating">
            ⭐ {rating}
            {entity.review_count > 0 && <span>({entity.review_count.toLocaleString()})</span>}
          </div>
        )}
        {entity.price_from != null && (
          <div className="svc-card-price">
            💵 {entity.price_from === 0 || entity.price_from === '0' ? 'Free' : `From $${entity.price_from}${entity.price_unit ? `/${entity.price_unit}` : ''}`}
          </div>
        )}
        <button className="svc-view-btn">
          {platform ? platform.label : 'View →'}
        </button>
      </div>
    </article>
  )
}

export default function ServiceListings() {
  const navigate = useNavigate()
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        let all = [], offset = 0
        while (true) {
          const res = await fetch(`${API_BASE}/api/gcr/entities?limit=1000&offset=${offset}`)
          if (!res.ok) break
          const data = await res.json()
          const batch = data.entities || []
          all = all.concat(batch)
          if (batch.length < 1000) break
          offset += 1000
        }
        const svcs = all.filter(e => {
          if (e.parent_slug) return false // hub children belong in their parent's own directory
          const et = (e.entity_type || '').toLowerCase()
          const es = (e.entity_subtype || '').toLowerCase()
          if (et === 'service') return true
          if (ALL_SERVICE_SUBTYPES.has(es)) return true
          return false
        })
        // Dedup by name
        const seen = new Map()
        svcs.forEach(e => {
          const k = (e.name || '').trim().toLowerCase()
          if (!seen.has(k) || (e.hero_image_url && !seen.get(k).hero_image_url)) seen.set(k, e)
        })
        setEntities(Array.from(seen.values()))
      } catch(err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const tab = SERVICE_TABS.find(t => t.id === activeTab)
  let filtered = entities.filter(e => {
    if (tab?.subtypes) {
      const es = (e.entity_subtype || '').toLowerCase()
      return tab.subtypes.some(s => es.includes(s))
    }
    return true
  })

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(e =>
      (e.name||'').toLowerCase().includes(q) ||
      (e.city||'').toLowerCase().includes(q) ||
      (e.entity_subtype||'').toLowerCase().includes(q)
    )
  }

  // Sort: featured pinned first, then rated, then with images
  filtered = [...filtered].sort((a,b) =>
    (b.featured?1:0) - (a.featured?1:0) ||
    (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0) ||
    (b.hero_image_url?1:0) - (a.hero_image_url?1:0)
  )

  const counts = {}
  SERVICE_TABS.forEach(t => {
    if (!t.subtypes) { counts[t.id] = entities.length; return }
    counts[t.id] = entities.filter(e => {
      const es = (e.entity_subtype||'').toLowerCase()
      return t.subtypes.some(s => es.includes(s))
    }).length
  })

  return (
    <div className="services-page">
      <div className="services-hero">
        <div className="services-hero-inner">
          <h1>🛠️ Local Services</h1>
          <p>Spas, salons, photographers, fitness, transportation and more on the Gulf Coast</p>
        </div>
      </div>

      <div className="services-type-bar">
        {SERVICE_TABS.map(t => (
          <button
            key={t.id}
            className={`services-type-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.emoji} {t.label}
            {counts[t.id] > 0 && <span className="svc-count-badge">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <div className="services-controls">
        <div className="svc-search-wrap">
          <span>🔍</span>
          <input
            className="svc-search"
            placeholder={`Search ${tab?.label || 'services'}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}>✕</button>}
        </div>
        <span className="svc-result-count">{filtered.length} services</span>
      </div>

      <div className="services-content">
        {loading ? (
          <div className="svc-loading"><div className="svc-spinner"/><p>Loading services...</p></div>
        ) : filtered.length === 0 ? (
          <div className="svc-empty"><p>No services found{search ? ` for "${search}"` : ''}</p></div>
        ) : (
          <div className="svc-grid">
            {filtered.map(e => <ServiceCard key={e.id||e.slug} entity={e} navigate={navigate} />)}
          </div>
        )}
      </div>
    </div>
  )
}
