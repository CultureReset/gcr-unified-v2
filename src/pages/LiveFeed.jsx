import { useEffect, useState, useRef } from 'react'
import { API_BASE } from '../config'
import './LiveFeed.css'

// Build the right embed URL per platform
function embedUrl(post) {
  const url = post.post_url || ''
  if (post.source === 'instagram' || url.includes('instagram.com')) {
    // Extract shortcode from /p/CODE/ or /reel/CODE/
    const m = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)
    if (m) return `https://www.instagram.com/${m[1]}/${m[2]}/embed/`
  }
  if (post.source === 'facebook' || url.includes('facebook.com')) {
    return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`
  }
  if (post.source === 'tiktok' || url.includes('tiktok.com')) {
    const m = url.match(/\/video\/(\d+)/)
    if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`
  }
  return null
}

function platformIcon(source) {
  return { instagram: '📸', facebook: '👥', tiktok: '🎵' }[source] || '📱'
}
function platformLabel(source) {
  return { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' }[source] || source
}

export default function LiveFeed() {
  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loaderRef = useRef(null)
  const LIMIT = 10

  async function loadPosts(offset = 0) {
    try {
      const res = await fetch(`${API_BASE}/api/gcr/social-posts/feed?limit=${LIMIT}&offset=${offset}`)
      if (!res.ok) return
      const d = await res.json()
      const incoming = d.posts || []
      setPosts(prev => offset === 0 ? incoming : [...prev, ...incoming])
      setHasMore(incoming.length === LIMIT)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadPosts(0) }, [])

  // Infinite scroll — load more when sentinel hits viewport
  useEffect(() => {
    if (!loaderRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const next = page + 1
        setPage(next)
        loadPosts(next * LIMIT)
      }
    }, { threshold: 0.1 })
    obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading, page])

  if (loading) return (
    <div className="live-feed-page">
      <div className="live-feed-header">
        <span className="live-feed-badge">📡 LIVE</span>
        <h1>Gulf Coast Feed</h1>
      </div>
      <div className="live-feed-loading">
        {[1,2,3].map(i => <div key={i} className="feed-skeleton" />)}
      </div>
    </div>
  )

  if (!posts.length) return (
    <div className="live-feed-page">
      <div className="live-feed-header">
        <span className="live-feed-badge">📡 LIVE</span>
        <h1>Gulf Coast Feed</h1>
        <p>Posts from Gulf Coast businesses will appear here.</p>
      </div>
      <div className="live-feed-empty">
        <div style={{ fontSize: 48 }}>📸</div>
        <p>No posts yet — check back soon.</p>
      </div>
    </div>
  )

  return (
    <div className="live-feed-page">
      <div className="live-feed-header">
        <span className="live-feed-badge">📡 LIVE</span>
        <h1>Gulf Coast Feed</h1>
        <p>What's happening right now on the coast</p>
      </div>

      <div className="feed-posts">
        {posts.map(post => {
          const embed = embedUrl(post)
          if (!embed) return null

          return (
            <div key={post.id} className="feed-post">
              {/* Source label */}
              <div className="feed-post-meta">
                <span className="feed-platform-badge">
                  {platformIcon(post.source)} {platformLabel(post.source)}
                </span>
                {post.entity_name && (
                  <span className="feed-biz-name">{post.entity_name}</span>
                )}
                {post.post_date && (
                  <span className="feed-date">
                    {new Date(post.post_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              {/* iFrame embed — no controls, no click needed, just the post */}
              <div className="feed-embed-wrap">
                <iframe
                  src={embed}
                  className="feed-embed"
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  loading="lazy"
                  title={post.caption || 'Social post'}
                />
              </div>

              {/* Caption if present */}
              {post.caption && (
                <div className="feed-caption">{post.caption.slice(0, 120)}{post.caption.length > 120 ? '…' : ''}</div>
              )}
            </div>
          )
        })}

        {/* Infinite scroll sentinel */}
        <div ref={loaderRef} style={{ height: 40 }} />
        {!hasMore && posts.length > 0 && (
          <div className="feed-end">You're all caught up 🌊</div>
        )}
      </div>
    </div>
  )
}
