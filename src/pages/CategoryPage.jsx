import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import GCRCard from '../components/GCRCard'
import { API_BASE } from '../config'
import { subtypeToCategory, formatSubtypeLabel } from '../categoryMap'
import './CategoryPage.css'

const CATEGORY_CONFIG = {
  restaurants:    { label: 'Restaurants',     emoji: '🍽️' },
  coffee:         { label: 'Coffee & Sweets', emoji: '☕' },
  'happy-hours':  { label: 'Happy Hours',     emoji: '🍻' },
  'things-to-do': { label: 'Things To Do',    emoji: '🎯' },
  services:       { label: 'Services',         emoji: '🛠️' },
  'public-spots': { label: 'Public Spots',     emoji: '✨' },
  shopping:       { label: 'Shopping',          emoji: '🛍️' },
  staying:        { label: 'Staying',           emoji: '🏨' },
  feed:           { label: 'Live Feed',         emoji: '📡' },
  nightlife:      { label: 'Bars & Nightlife',  emoji: '🍸' },
  wellness:       { label: 'Health & Wellness', emoji: '💆' },
  marinas:        { label: 'Marinas',           emoji: '⚓' },
}


// Solid CSS gradients instead of hotlinked photos — the previous Unsplash
// URLs had no fallback, so a single blocked/dead link showed as a blank
// gray hero banner across every category.
const HERO_GRADIENTS = {
  restaurants: 'linear-gradient(135deg, #c2410c, #7c2d12)',
  coffee: 'linear-gradient(135deg, #92400e, #451a03)',
  'happy-hours': 'linear-gradient(135deg, #b45309, #78350f)',
  events: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
  'things-to-do': 'linear-gradient(135deg, #0e7490, #164e63)',
  services: 'linear-gradient(135deg, #334155, #1e293b)',
  'public-spots': 'linear-gradient(135deg, #15803d, #14532d)',
  feed:         'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
  nightlife:    'linear-gradient(135deg, #7e22ce, #3b0764)',
  wellness:     'linear-gradient(135deg, #0d9488, #134e4a)',
  shopping: 'linear-gradient(135deg, #be185d, #831843)',
  staying: 'linear-gradient(135deg, #0369a1, #0c4a6e)',
  marinas: 'linear-gradient(135deg, #0c4a6e, #0891b2)',
}

export default function CategoryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { savedPlaces, addSavedPlace, removeSavedPlace } = useApp()
  const category = location.pathname.slice(1) // Remove leading slash
  const [entities, setEntities] = useState([])
  const [allTags, setAllTags] = useState([])
  const [selectedTag, setSelectedTag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const savedSlugs = new Set((savedPlaces || []).map(p => p.slug))

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

  const config = CATEGORY_CONFIG[category]
  const heroGradient = HERO_GRADIENTS[category] || 'linear-gradient(135deg, #334155, #1e293b)'

  const PAGE_SIZE = 10

  useEffect(() => {
    if (!config) {
      setError('Category not found')
      setLoading(false)
      return
    }

    async function loadEntities() {
      try {
        setLoading(true)
        setError(null)
        // A tag selected on one category page (e.g. Restaurants) doesn't apply
        // to another (e.g. Happy Hours) -- reset it on every category change so
        // it can't silently filter out results that should show.
        setSelectedTag(null)

        let ents = []

        if (category === 'happy-hours') {
          const res = await fetch(`${API_BASE}/api/gcr/happy-hours`)
          if (!res.ok) throw new Error('Failed to load happy hours')
          const data = await res.json()
          ents = data.happyHours || data.businesses || []
        } else {
          // Fetch all entities in batches of 1000 to bypass API hard limit
          let all = []
          let offset = 0
          const BATCH = 1000
          while (true) {
            const res = await fetch(`${API_BASE}/api/gcr/entities?limit=${BATCH}&offset=${offset}`)
            if (!res.ok) break
            const data = await res.json()
            const batch = data.entities || []
            all = all.concat(batch)
            if (batch.length < BATCH) break
            offset += BATCH
          }
          // feed = show everything; otherwise filter by subtype. Hub children
          // (entity.parent_slug set — e.g. a marina's individual charter
          // boats, a complex's individual restaurants) are meant to be found
          // by drilling into their parent hub, not as their own standalone
          // card on the main category grid — without this they'd show twice.
          ents = category === 'feed'
            ? all
            : all.filter(e => subtypeToCategory(e) === category && !e.parent_slug)
        }

        // Deduplicate: same name → keep the one with a proper subtype / no hash slug
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
        setHasMore(false)

        // Extract unique curated tags for filter chips (skip raw Google Place
        // types and machine slugs). Dedup on a normalized key (lowercase,
        // alphanumeric only) so trivial variants collapse into one chip —
        // "1950s themed" / "1950s-themed" become a single chip, "American" /
        // "American " don't both show. First spelling seen wins as the label.
        const SKIP_CATEGORIES = new Set(['google_type', 'google_primary_type', 'google_secondary_type', 'google_types'])
        const isMachineSlug = (s) => (/_/.test(s) && s === s.toLowerCase()) || (/^[a-z]+[A-Z]/.test(s) && !/\s/.test(s))
        const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
        const chipByKey = new Map()
        const addTag = (tag) => {
          if (!tag || isMachineSlug(tag)) return
          const k = norm(tag)
          if (k && !chipByKey.has(k)) chipByKey.set(k, tag)
        }
        ents.forEach(e => {
          if (e.entity_subtype) addTag(formatSubtypeLabel(e.entity_subtype))
          ;(Array.isArray(e.tags) ? e.tags : []).forEach(t => {
            const cat = typeof t === 'object' ? (t.tag_category || '') : ''
            if (SKIP_CATEGORIES.has(cat)) return
            addTag(typeof t === 'string' ? t : (t.tag_name || t.tag || ''))
          })
        })
        setAllTags(['All', ...Array.from(chipByKey.values()).sort()])
      } catch (err) {
        console.error('Error loading entities:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadEntities()
  }, [category])

  const SKIP_CATS = new Set(['google_type', 'google_primary_type', 'google_secondary_type'])
  const filtered = !selectedTag || selectedTag === 'All'
    ? entities
    : entities.filter(e => {
        if (formatSubtypeLabel(e.entity_subtype) === selectedTag) return true
        const tags = Array.isArray(e.tags) ? e.tags : []
        return tags.some(t => {
          const cat = typeof t === 'object' ? (t.tag_category || '') : ''
          if (SKIP_CATS.has(cat)) return false
          const tag = typeof t === 'string' ? t : (t.tag_name || t.tag || '')
          return tag === selectedTag
        })
      })

  const handleLoadMore = () => {
    // All entities loaded upfront — no pagination needed
  }

  if (error && !config) {
    return (
      <div className="category-error">
        <h2>Category not found</h2>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    )
  }

  return (
    <div className="category-page">

      {/* Hero Section */}
      <div
        className="category-hero"
        style={{ background: heroGradient }}
      >
        <div className="hero-content">
          <h1 className="hero-title">{config?.label || 'Browse'}</h1>
          <p className="hero-sub">Discover what's waiting for you</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="category-toolbar">
        <h2 className="results-title">{filtered.length} results</h2>
        <div className="filter-chips">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`chip ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="listings-stack">
        {loading && !entities.length ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No results found</div>
        ) : (
          filtered.map(entity => (
            <GCRCard
              key={entity.id || entity.slug}
              entity={entity}
              category={category}
              onSave={handleSave}
              savedSlugs={savedSlugs}
            />
          ))
        )}
      </div>
    </div>
  )
}
