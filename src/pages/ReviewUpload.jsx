import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../config'

export default function ReviewUpload() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const category = searchParams.get('cat') || 'general'

  const [name, setName] = useState('')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!imageUrl.trim()) { setError('Please enter a photo URL'); return }
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch(`${API_BASE}/api/tourist/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_slug: slug,
          image_url: imageUrl.trim(),
          caption: caption.trim() || null,
          uploader_name: name.trim() || null,
          category,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Submission failed')
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const s = {
    page: { minHeight:'100dvh', background:'#0a0a14', padding:'40px 20px', color:'white', display:'flex', flexDirection:'column', alignItems:'center' },
    card: { width:'100%', maxWidth:460, display:'flex', flexDirection:'column', gap:20 },
    label: { display:'flex', flexDirection:'column', gap:6 },
    labelText: { fontSize:13, fontWeight:600, color:'rgba(255,255,255,.65)' },
    input: { background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:'12px 14px', color:'white', fontSize:15, fontFamily:'inherit', outline:'none' },
    btn: { background:'linear-gradient(135deg,#7c6af7,#5b4de0)', color:'white', padding:16, borderRadius:50, fontSize:16, fontWeight:700, border:'none', cursor:'pointer' },
  }

  if (done) return (
    <div style={{...s.page, justifyContent:'center', textAlign:'center'}}>
      <div style={{fontSize:64, marginBottom:16}}>🎉</div>
      <h2 style={{fontSize:22, fontWeight:800, margin:'0 0 8px'}}>Photo Submitted!</h2>
      <p style={{color:'rgba(255,255,255,.6)', fontSize:15, margin:0}}>
        Your photo is under review. Once approved it'll appear on the business profile.
      </p>
      <p style={{color:'rgba(255,255,255,.4)', fontSize:13, marginTop:16}}>
        Thanks for sharing your experience!
      </p>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{textAlign:'center', marginBottom:8}}>
          <div style={{fontSize:40}}>📸</div>
          <h2 style={{fontSize:22, fontWeight:800, margin:'10px 0 4px'}}>Share Your Photo</h2>
          <p style={{color:'rgba(255,255,255,.55)', fontSize:14, margin:0}}>
            Show others what this experience is really like
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
          <label style={s.label}>
            <span style={s.labelText}>Photo URL *</span>
            <input
              style={s.input}
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Paste your photo link here"
              type="url"
            />
          </label>

          {imageUrl && (
            <img
              src={imageUrl}
              alt="preview"
              style={{width:'100%', maxHeight:240, objectFit:'cover', borderRadius:14, border:'1px solid rgba(255,255,255,.1)'}}
              onError={e => { e.target.style.display = 'none' }}
            />
          )}

          <label style={s.label}>
            <span style={s.labelText}>Your Name (optional)</span>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="First name" />
          </label>

          <label style={s.label}>
            <span style={s.labelText}>Caption (optional)</span>
            <textarea
              style={{...s.input, resize:'none'}}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's in this photo?"
              rows={3}
            />
          </label>

          {error && <p style={{color:'#fca5a5', fontSize:14, margin:0, textAlign:'center'}}>{error}</p>}

          <button type="submit" style={{...s.btn, opacity: submitting ? 0.6 : 1}} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Photo'}
          </button>
        </form>
      </div>
    </div>
  )
}
