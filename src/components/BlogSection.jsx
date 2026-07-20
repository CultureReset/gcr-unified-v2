import { useState, useEffect } from 'react'
import { API_BASE } from '../config'

export default function BlogSection({ slug }) {
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPage(1)
    setSelectedPost(null)
  }, [slug])

  useEffect(() => {
    loadPosts()
  }, [slug, page])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/blog/${slug}?page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch (err) {
      console.error('Error loading blog posts:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading blog...</div>
  if (posts.length === 0) return <p className="no-data">No blog posts available</p>

  if (selectedPost) {
    return (
      <section className="content-section blog-section blog-detail">
        <button onClick={() => setSelectedPost(null)} className="btn btn-back">
          ← Back to Posts
        </button>
        <article className="blog-post-detail">
          <h2>{selectedPost.title}</h2>
          {selectedPost.featured_image_url && (
            <img src={selectedPost.featured_image_url} alt={selectedPost.title} className="blog-featured-image" />
          )}
          <div className="blog-meta">
            <time>{new Date(selectedPost.published_at).toLocaleDateString()}</time>
          </div>
          <div className="blog-content">{selectedPost.content}</div>
        </article>
      </section>
    )
  }

  return (
    <section className="content-section blog-section">
      <h2>📰 Blog</h2>
      <div className="blog-list">
        {posts.map((post) => (
          <div key={post.id} className="blog-card">
            {post.featured_image_url && (
              <img src={post.featured_image_url} alt={post.title} className="blog-card-image" />
            )}
            <div className="blog-card-content">
              <h3>{post.title}</h3>
              <p className="blog-excerpt">{post.excerpt || post.content?.substring(0, 200)}</p>
              <div className="blog-footer">
                <time>{new Date(post.published_at).toLocaleDateString()}</time>
                <button
                  onClick={() => setSelectedPost(post)}
                  className="btn btn-small"
                >
                  Read More
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="blog-pagination">
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
