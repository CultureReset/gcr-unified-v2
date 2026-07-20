import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE as API } from '../config'
import './Auth.css'

export default function Reset() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const email = params.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const valid = password.length >= 6 && password === confirm
  const linkOk = token && email

  async function submit() {
    if (!valid) return
    setLoading(true); setError('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Reset failed'); return }
      setDone(true)
      setTimeout(() => navigate('/auth', { replace: true }), 1800)
    } catch(e) { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page page">
      <div className="auth-bg">
        <img src="https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=800&q=80" alt="" />
        <div className="auth-overlay" />
      </div>
      <div className="auth-content">
        <div className="auth-logo">🌊 Gulf Coast Radar</div>
        <div className="auth-form animate-fade-up">
          <h2>Set a new password</h2>
          {!linkOk ? (
            <>
              <p>This reset link is invalid or incomplete.</p>
              <button className="btn-primary" onClick={() => navigate('/auth')} style={{marginTop:16}}>Back to sign in</button>
            </>
          ) : done ? (
            <>
              <p>Password updated. Redirecting to sign in…</p>
            </>
          ) : (
            <>
              <p>for <strong style={{color:'#fff'}}>{email}</strong></p>
              <input
                type="password"
                placeholder="New password (6+ characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="setup-input"
                autoFocus
                style={{fontSize:17}}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="setup-input"
                style={{fontSize:17, marginTop:12}}
              />
              {password && confirm && password !== confirm && (
                <div style={{color:'#fca5a5',fontSize:13,marginTop:8}}>Passwords don't match</div>
              )}
              {error && (
                <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:12,padding:'10px 14px',fontSize:13,color:'#fca5a5',marginTop:12}}>
                  {error}
                </div>
              )}
              <button className="btn-primary" onClick={submit} disabled={!valid || loading} style={{marginTop:16}}>
                {loading ? 'Updating…' : 'Update password →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
