import { useState, useEffect } from 'react'
import { API_BASE } from '../config'

export default function GallerySection({ slug }) {
  const [photos, setPhotos] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  useEffect(() => {
    setSelectedCategory(null)
    setPage(1)
    setSelectedPhoto(null)
    loadCategories()
    loadPhotos()
  }, [slug])

  useEffect(() => {
    setPage(1)
    loadPhotos()
  }, [selectedCategory])

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/gallery/${slug}/categories`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadPhotos = async () => {
    try {
      setLoading(true)
      const query = new URLSearchParams()
      query.append('page', page)
      query.append('limit', 20)
      if (selectedCategory) query.append('category', selectedCategory)

      const res = await fetch(`${API_BASE}/api/gallery/${slug}?${query}`)
      if (res.ok) {
        const data = await res.json()
        setPhotos(data.photos || [])
      }
    } catch (err) {
      console.error('Error loading photos:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading && page === 1) return <div className="loading">Loading gallery...</div>
  if (photos.length === 0) return <p className="no-data">No photos available</p>

  return (
    <section className="content-section gallery-section">
      <h2>📸 Gallery</h2>

      {categories.length > 1 && (
        <div className="gallery-categories">
          <button
            className={`category-chip ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="gallery-grid">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="gallery-item"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img src={photo.photo_url} alt={photo.caption || 'Photo'} />
            {photo.caption && <div className="gallery-caption">{photo.caption}</div>}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox" onClick={() => setSelectedPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelectedPhoto(null)}>×</button>
            <img src={selectedPhoto.photo_url} alt={selectedPhoto.caption} />
            {selectedPhoto.caption && <p className="lightbox-caption">{selectedPhoto.caption}</p>}
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="gallery-pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="btn btn-small"
        >
          Previous
        </button>
        <span>{page}</span>
        <button
          onClick={() => setPage(page + 1)}
          className="btn btn-small"
        >
          Next
        </button>
      </div>
    </section>
  )
}
