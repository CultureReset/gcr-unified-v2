import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import GCRCard from '../components/GCRCard'
import { API_BASE } from '../config'
import { subtypeToCategory, formatSubtypeLabel } from '../categoryMap'
import { useApp } from '../context/AppContext'
import './CategoryListings.css'

const CATEGORY_META = {
  restaurants:     { label: 'Restaurants',     emoji: '🍽️', desc: 'Dining, bars & local eats' },
  'coffee-sweets': { label: 'Coffee & Sweets', emoji: '☕', desc: 'Coffee shops, bakeries & ice cream' },
  'happy-hours':   { label: 'Happy Hours',     emoji: '🍻', desc: 'Deals on drinks & bites' },
  'things-to-do':  { label: 'Things To Do',    emoji: '🎯', desc: 'Activities, tours & attractions' },
  services:        { label: 'Services',         emoji: '🛠️', desc: 'Local service providers' },
  'public-spots':  { label: 'Public Spots',     emoji: '✨', desc: 'Parks, beaches & public spaces' },
  shopping:        { label: 'Shopping',          emoji: '🛍️', desc: 'Retail, boutiques & souvenirs' },
  staying:         { label: 'Staying',           emoji: '🏨', desc: 'Hotels, condos & vacation rentals' },
  nightlife:       { label: 'Nightlife',         emoji: '🌙', desc: 'Bars, clubs & late-night spots' },
}

const TYPE_MAP = {
  restaurants: 'restaurant',
  'coffee-sweets': 'coffee',
  'happy-hours': 'restaurant',
  'things-to-do': 'activity',
  services: 'service',
  'public-spots': 'public_spot',
  shopping: 'shopping',
  staying: 'hotel',
  nightlife: 'nightlife',
}

export default function CategoryListings() {
  const { category } = useParams()
  const navigate = useNavigate()
  const { userLocation, requestLocation, savedPlaces, addSavedPlace, removeSavedPlace, userId } = useApp()
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const savedSlugs = new Set((savedPlaces || []).map(p => p.slug))
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeSort, setActiveSort] = useState('default')
  const [activeTag, setActiveTag] = useState('All')
  const [allTags, setAllTags] = useState(['All'])
  const gridRef = useRef(null)

  const meta = CATEGORY_META[category] || { label: category, emoji: '📍', desc: '' }
  const apiType = TYPE_MAP[category] || category

  useEffect(() => {
    async function loadEntities() {
      setLoading(true)
      setError(null)
      try {
        let ents = []
        const locParams = userLocation ? `&lat=${userLocation.lat}&lng=${userLocation.lng}` : ''
        const userParams = userId ? `&user_id=${encodeURIComponent(userId)}` : ''
        if (category === 'happy-hours') {
          const res = await fetch(`${API_BASE}/api/gcr/happy-hours`)
          if (!res.ok) throw new Error('Failed to load')
          const data = await res.json()
          ents = data.happyHours || data.businesses || []
        } else {
          let all = []
          let offset = 0
          while (true) {
            const res = await fetch(`${API_BASE}/api/gcr/entities?limit=1000&offset=${offset}${locParams}${userParams}`)
            if (!res.ok) break
            const data = await res.json()
            const batch = data.entities || []
            all = all.concat(batch)
            if (batch.length < 1000) break
            offset += 1000
          }
          // Hub children (e.g. a marina's individual charter boats) belong
          // inside their parent hub's own directory, not as a duplicate
          // standalone card here — same fix as CategoryPage.jsx.
          ents = all.filter(e => subtypeToCategory(e) === category && !e.parent_slug)
        }

        // Deduplicate: same name → keep the one with a proper subtype / no hash slug
        // (same rule as CategoryPage.jsx — kept identical so the two pages agree
        // on which of a duplicate pair "wins")
        const seen = new Map()
        const hasHashSlug = s => /[-_][A-Za-z0-9]{6,}$/.test(s || '') || /[-]\d+$/.test(s || '')
        for (const e of ents) {
          const key = (e.name || '').trim().toLowerCase()
          if (!seen.has(key)) { seen.set(key, e); continue }
          const prev = seen.get(key)
          const prevHash = hasHashSlug(prev.slug)
          const curHash = hasHashSlug(e.slug)
          if (prevHash && !curHash) seen.set(key, e)
          else if (!prevHash && curHash) { /* keep prev */ }
          else if (e.entity_subtype && !prev.entity_subtype) seen.set(key, e)
        }
        ents = Array.from(seen.values())

        setEntities(ents)
        const SKIP_CATEGORIES = new Set(['google_type', 'google_primary_type', 'google_secondary_type'])
        const tagsSet = new Set()
        ents.forEach(e => {
          if (e.entity_subtype) tagsSet.add(formatSubtypeLabel(e.entity_subtype))
          ;(Array.isArray(e.tags) ? e.tags : []).forEach(t => {
            const cat = typeof t === 'object' ? (t.tag_category || '') : ''
            if (SKIP_CATEGORIES.has(cat)) return
            const tag = typeof t === 'string' ? t : (t.tag_name || t.tag || '')
            if (tag) tagsSet.add(tag)
          })
        })
        setAllTags(['All', ...Array.from(tagsSet).sort()])
      } catch (err) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadEntities()
  }, [category, userLocation, userId])

  const handleSave = async (entity) => {
    const slug = entity.slug || entity.id
    const isSaved = savedSlugs.has(slug)
    try {
      if (isSaved) {
        const item = savedPlaces.find(p => p.slug === slug)
        if (item) await removeSavedPlace(item.id)
      } else {
        await addSavedPlace(entity)
      }
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  const searchLower = search.toLowerCase()
  const filtered = entities
    .filter(e => {
      const matchSearch = !search ||
        (e.name || '').toLowerCase().includes(searchLower) ||
        (e.description || '').toLowerCase().includes(searchLower) ||
        (e.city || '').toLowerCase().includes(searchLower)
      const matchFilter =
        activeFilter === 'all' ? true :
        activeFilter === 'hh' ? !!e.hh_days :
        activeFilter === 'music' ? !!e.live_music :
        true
      const matchTag = activeTag === 'All' ? true :
        formatSubtypeLabel(e.entity_subtype) === activeTag ||
        (Array.isArray(e.tags) ? e.tags : []).some(t => {
          const cat = typeof t === 'object' ? (t.tag_category || '') : ''
          if (['google_type','google_primary_type','google_secondary_type'].includes(cat)) return false
          const name = typeof t === 'string' ? t : (t.tag_name || t.tag || '')
          return name === activeTag
        })
      return matchSearch && matchFilter && matchTag
    })
    .sort((a, b) => {
      if (activeSort === 'distance') return (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999)
      if (activeSort === 'rating') return (b.rating || 0) - (a.rating || 0)
      return 0
    })

  return (
    <div className="category-listings">
      {/* Hero */}
      <div className="listings-hero">
        <button className="cl-back-btn" onClick={() => navigate(-1)}>←</button>
        <div className="hero-text">
          <h1>{meta.emoji} {meta.label}</h1>
          <p>{meta.desc} · <strong>{entities.length}</strong> spots</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="listings-toolbar">
        <input
          className="listings-search"
          type="text"
          placeholder={`Search ${meta.label.toLowerCase()}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="listings-filters">
          {['all', 'hh', 'music'].map(f => (
            <button
              key={f}
              className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'hh' ? '🍺 Happy Hour' : '🎸 Live Music'}
            </button>
          ))}
          <div className="sort-divider" />
          <button
            className={`filter-btn ${activeSort === 'distance' ? 'active' : ''}`}
            onClick={async () => {
              if (activeSort === 'distance') { setActiveSort('default'); return }
              if (!userLocation) await requestLocation()
              setActiveSort('distance')
            }}
          >
            📍 Nearest
          </button>
          <button
            className={`filter-btn ${activeSort === 'rating' ? 'active' : ''}`}
            onClick={() => setActiveSort(s => s === 'rating' ? 'default' : 'rating')}
          >
            ⭐ Top Rated
          </button>
        </div>
        {allTags.length > 1 && (
          <div className="listings-tags">
            {allTags.map(tag => (
              <button
                key={tag}
                className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="listings-loading">
          <div className="skeleton-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton-card" />)}
          </div>
        </div>
      ) : error ? (
        <div className="listings-error">⚠️ {error}</div>
      ) : filtered.length === 0 ? (
        <div className="listings-empty">
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>{meta.emoji}</div>
          <div style={{ fontWeight: 700 }}>No results found</div>
          {search && <div style={{ fontSize: 13, color: '#66788a', marginTop: 8 }}>Try a different search</div>}
        </div>
      ) : (
        <div className="listings-grid" ref={gridRef}>
          {filtered.map(entity => (
            <GCRCard
              key={entity.slug || entity.id}
              entity={entity}
              category={category}
              onSave={handleSave}
              savedSlugs={savedSlugs}
            />
          ))}
        </div>
      )}
    </div>
  )
}
