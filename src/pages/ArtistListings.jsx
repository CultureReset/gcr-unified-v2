import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ArtistListings.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'

export default function ArtistListings() {
  const navigate = useNavigate()
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredArtists, setFilteredArtists] = useState([])
  const [visibleCount, setVisibleCount] = useState(24)

  useEffect(() => {
    async function loadArtists() {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/api/artists`)
        if (!res.ok) throw new Error('Failed to load artists')
        const data = await res.json()
        const artistList = Array.isArray(data) ? data : data.artists || []
        setArtists(artistList)
        setFilteredArtists(artistList)
      } catch (err) {
        console.error('Error loading artists:', err)
        setArtists([])
        setFilteredArtists([])
      } finally {
        setLoading(false)
      }
    }
    loadArtists()
  }, [])

  useEffect(() => {
    const filtered = artists.filter(artist =>
      artist.artist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      artist.bio?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredArtists(filtered)
    setVisibleCount(24) // reset the window whenever the search changes
  }, [searchTerm, artists])

  if (loading) return <div className="artist-listings-loading">Loading artists...</div>

  return (
    <div className="artist-listings">
      <div className="artist-listings-hero">
        <h1>🎸 Live Music Artists</h1>
        <p>Book local musicians for your venue or event</p>
      </div>

      <div className="artist-listings-container">
        <div className="artist-search">
          <input
            type="text"
            placeholder="Search artists by name or style..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {filteredArtists.length === 0 ? (
          <div className="no-artists">No artists found</div>
        ) : (
          <div className="artists-grid">
            {filteredArtists.slice(0, visibleCount).map((artist) => (
              <div key={artist.id} className="artist-card">
                {artist.photo_url && (
                  <img src={artist.photo_url} alt={artist.artist_name} className="artist-image" />
                )}
                <div className="artist-info">
                  <h3>{artist.artist_name}</h3>
                  {artist.bio && <p className="artist-bio">{artist.bio}</p>}

                  <div className="artist-meta">
                    {artist.default_min_request_amount && (
                      <span className="price">From ${artist.default_min_request_amount}</span>
                    )}
                  </div>

                  <div className="artist-links">
                    {artist.instagram_url && (
                      <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="link-btn">
                        📸
                      </a>
                    )}
                    {artist.spotify_url && (
                      <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" className="link-btn">
                        🎵
                      </a>
                    )}
                    {artist.youtube_url && (
                      <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className="link-btn">
                        ▶️
                      </a>
                    )}
                  </div>

                  <button
                    className="view-btn"
                    onClick={() => navigate(`/artist/${artist.slug}`)}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
            {filteredArtists.length > visibleCount && (
              <div className="artist-loadmore-wrap">
                <button className="artist-loadmore" onClick={() => setVisibleCount(c => c + 24)}>
                  Show more artists ({filteredArtists.length - visibleCount} more)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
