import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE as API } from '../config'
import { authFetch } from '../context/AppContext'

export default function Invite() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('t') || ''

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setError('Missing invite token'); setLoading(false); return }
    fetch(`${API}/api/tourist/groups/invite/${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) setError(d.error || 'Invite not found')
        else setPreview(d)
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    if (!localStorage.getItem('gcr_access_token')) {
      sessionStorage.setItem('gcr_pending_invite', token)
      navigate(`/auth?invite=${encodeURIComponent(token)}`)
      return
    }
    setBusy(true); setError('')
    try {
      const r = await authFetch(`/api/tourist/groups/invite/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not accept invite'); return }
      navigate('/group/' + d.group.slug, { replace: true })
    } catch(e) { setError('Network error') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="page safe-top" style={{padding:20,color:'#fff'}}>Loading invite…</div>

  return (
    <div className="auth-page page">
      <div className="auth-bg">
        <img src="https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=800&q=80" alt="" />
        <div className="auth-overlay" />
      </div>
      <div className="auth-content">
        <div className="auth-logo">🌊 Gulf Coast Radar</div>
        <div className="auth-form animate-fade-up">
          {error ? (
            <>
              <h2>Can't use this invite</h2>
              <p style={{color:'#fca5a5'}}>{error}</p>
              <button className="btn-primary" onClick={() => navigate('/')} style={{marginTop:16}}>Open Gulf Coast Radar</button>
            </>
          ) : preview?.status === 'used' ? (
            <>
              <h2>Invite already used</h2>
              <p>This one-time link has already been redeemed. Ask your friend to send you a new one.</p>
              <button className="btn-primary" onClick={() => navigate('/')} style={{marginTop:16}}>Open Gulf Coast Radar</button>
            </>
          ) : preview?.status === 'expired' ? (
            <>
              <h2>Invite expired</h2>
              <p>This invite has expired. Ask your friend to send a fresh one.</p>
              <button className="btn-primary" onClick={() => navigate('/')} style={{marginTop:16}}>Open Gulf Coast Radar</button>
            </>
          ) : (
            <>
              <h2>You're invited! 🎉</h2>
              <p>Join <strong style={{color:'#fff'}}>{preview?.group?.name || 'this trip'}</strong>
                {preview?.group?.destination ? ` to ${preview.group.destination}` : ''}.
              </p>
              <p style={{color:'rgba(255,255,255,.6)',fontSize:13}}>
                Swipe places you want to do. Everyone's saves merge together so you can see what overlaps.
              </p>
              <button className="btn-primary" onClick={accept} disabled={busy} style={{marginTop:16}}>
                {busy ? 'Joining…' : 'Accept invite →'}
              </button>
              <p className="auth-legal" style={{marginTop:20}}>This is a one-time link — accepting uses it up.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
