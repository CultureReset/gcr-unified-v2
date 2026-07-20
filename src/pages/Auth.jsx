import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { useApp, anonymousVisitorId } from '../context/AppContext'
import { API_BASE as API, SMS_NUMBER } from '../config'
// Firebase phone auth disabled - use email/password only
// import { sendFirebaseOTP, confirmFirebaseOTP, resetRecaptcha, setupRecaptcha } from '../services/firebaseAuth'
import './Auth.css'

export default function Auth() {
  const [authMethod, setAuthMethod] = useState('phone') // 'phone' | 'email'
  const [mode, setMode] = useState('signup') // 'signup' | 'signin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('input') // 'input' | 'verify-code'
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [focusedIdx, setFocusedIdx] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const inputRefs = useRef([])
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { setSessionFromLogin } = useApp()
  const returnTo = location.state?.from || null


  useEffect(() => {
    if (step === 'verify-code') {
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    }
  }, [step])

  // WebOTP: auto-fill the code straight from the incoming SMS — no typing,
  // no switching apps. Android Chrome only; other browsers fall back to
  // autoComplete="one-time-code" (iOS/Chrome keyboard suggestion) or manual entry.
  useEffect(() => {
    if (step !== 'verify-code' || authMethod !== 'phone') return
    if (!('OTPCredential' in window)) return
    const ac = new AbortController()
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then(otp => {
        const code = (otp?.code || '').replace(/\D/g, '').slice(0, 6)
        if (code.length === 6) setDigits(code.split(''))
      })
      .catch(() => {})
    return () => ac.abort()
  }, [step, authMethod])

  // Auto-submit the instant all 6 digits are present — from autofill or manual entry —
  // so there's nothing left to tap.
  useEffect(() => {
    if (step === 'verify-code' && digits.join('').length === 6 && !loading) {
      authMethod === 'phone' ? verifyPhoneCode() : verifyCode()
    }
  }, [digits])


  // Pre-fill phone from ?phone= param (set by inbound SMS link)
  useEffect(() => {
    const p = searchParams.get('phone')
    if (p) {
      setPhone(p.replace(/^\+1/, ''))
      setAuthMethod('phone')
    }
  }, [])

  // Tap-to-sign-in link — for texts sent from off-platform ("text BEACH to
  // this number from anywhere"). Verifies the one-time token and signs in
  // automatically; no form, nothing to type.
  useEffect(() => {
    const magicToken = searchParams.get('token')
    if (!magicToken) return
    ;(async () => {
      setLoading(true); setError(''); setInfo('')
      try {
        const r = await fetch(`${API}/api/tourist-auth/phone-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: magicToken, anonymous_visitor_id: anonymousVisitorId() }),
        })
        const d = await r.json()
        if (!r.ok) { setError(d.error || 'This sign-in link is invalid or expired.'); return }
        const session = d.session || (d.access_token ? { access_token: d.access_token } : null)
        if (session?.access_token) {
          localStorage.setItem('gcr_access_token', session.access_token)
          if (session.refresh_token) localStorage.setItem('gcr_refresh_token', session.refresh_token)
          if (session.expires_at)    localStorage.setItem('gcr_expires_at', String(session.expires_at))
        }
        const uid = d.user?.id || d.tourist?.user_id
        if (uid) localStorage.setItem('gcr_user_id', uid)
        if (d.user?.email) localStorage.setItem('gcr_user_email', d.user.email)
        if (d.user?.phone) localStorage.setItem('gcr_user_phone', d.user.phone)

        const pending = sessionStorage.getItem('gcr_pending_invite')
        if (pending) {
          sessionStorage.removeItem('gcr_pending_invite')
          navigate('/join?t=' + encodeURIComponent(pending), { replace: true })
          return
        }
        const profile = await setSessionFromLogin?.(d)
        const complete = profile?.setupComplete || profile?.setup_complete || d.tourist?.setup_complete
        navigate(complete ? (returnTo || '/home') : '/setup/name', { replace: true })
      } catch {
        setError('Network error — try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const verified = searchParams.get('verified')
    const inviteToken = searchParams.get('invite')

    if (verified === '1') {
      setMode('signin')
      setInfo('Email confirmed! Sign in to continue.')
    } else if (verified === '0') {
      setError('Could not verify — try signing up again.')
    }

    if (inviteToken) {
      sessionStorage.setItem('gcr_pending_invite', inviteToken)
      setMode('signup')
    }
  }, [searchParams])

  function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
  function canSubmit() { return isValidEmail(email) && password.length >= 6 }

  async function signUp() {
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Sign up failed'); return }
      setDigits(['', '', '', '', '', ''])
      setStep('verify-code')
    } catch { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  async function signIn() {
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, anonymous_visitor_id: anonymousVisitorId() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Sign in failed'); return }
      localStorage.setItem('gcr_access_token',  d.session.access_token)
      localStorage.setItem('gcr_refresh_token', d.session.refresh_token)
      localStorage.setItem('gcr_expires_at',    String(d.session.expires_at || ''))
      localStorage.setItem('gcr_user_id',       d.user.id)
      localStorage.setItem('gcr_user_email',    d.user.email)
      const pending = sessionStorage.getItem('gcr_pending_invite')
      if (pending) {
        sessionStorage.removeItem('gcr_pending_invite')
        navigate('/join?t=' + encodeURIComponent(pending), { replace: true })
        return
      }
      const profile = await setSessionFromLogin?.(d)
      const complete = profile?.setupComplete || profile?.setup_complete
      if (!complete) { navigate('/setup/name', { replace: true }); return }
      navigate(returnTo || '/home', { replace: true })
    } catch { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  async function forgotPassword() {
    if (!isValidEmail(email)) { setError('Enter your email first, then tap Forgot.'); return }
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Request failed'); return }
      setInfo(d.message || 'Password reset email sent.')
    } catch { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, '')
    return digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : `+${digits}`
  }

  async function sendPhoneOTP() {
    const normalized = normalizePhone(phone)
    if (normalized.length < 10) { setError('Enter a valid US phone number'); return }
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not send code — try again.'); return }
      setDigits(['', '', '', '', '', ''])
      setStep('verify-code')
    } catch {
      setError('Network error — try again.')
    }
    finally { setLoading(false) }
  }

  async function verifyPhoneCode() {
    const code = digits.join('')
    if (code.length < 6) return
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/phone-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone), code, anonymous_visitor_id: anonymousVisitorId() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Invalid code — try again.'); return }
      const session = d.session || (d.access_token ? { access_token: d.access_token } : null)
      if (session?.access_token) {
        localStorage.setItem('gcr_access_token', session.access_token)
        if (session.refresh_token) localStorage.setItem('gcr_refresh_token', session.refresh_token)
        if (session.expires_at)    localStorage.setItem('gcr_expires_at', String(session.expires_at))
      }
      const uid = d.user?.id || d.tourist?.user_id
      if (uid) localStorage.setItem('gcr_user_id', uid)
      if (d.user?.email) localStorage.setItem('gcr_user_email', d.user.email)
      localStorage.setItem('gcr_user_phone', normalizePhone(phone))

      const pending = sessionStorage.getItem('gcr_pending_invite')
      if (pending) {
        sessionStorage.removeItem('gcr_pending_invite')
        navigate('/join?t=' + encodeURIComponent(pending), { replace: true })
        return
      }
      const profile = await setSessionFromLogin?.(d)
      const complete = profile?.setupComplete || profile?.setup_complete || d.tourist?.setup_complete
      navigate(complete ? (returnTo || '/home') : '/setup/name', { replace: true })
    } catch {
      setError('Network error — try again.')
    }
    finally { setLoading(false) }
  }

  async function resendPhoneOTP() {
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Failed to resend'); return }
      setInfo('New code sent.')
    } catch { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  async function resendCode() {
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Failed to resend'); return }
      setInfo(d.message || 'New code sent.')
    } catch { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  function handleDigit(i, val) {
    const cleaned = val.replace(/\D/g, '')
    // Keyboard-suggestion autofill (iOS/Android "from Messages") drops the
    // whole code into one box at once — treat that like a paste.
    if (cleaned.length > 1) {
      const d = Array(6).fill('').map((_, idx) => cleaned[idx] || '')
      setDigits(d)
      inputRefs.current[Math.min(cleaned.length, 5)]?.focus()
      return
    }
    const d = [...digits]
    d[i] = cleaned.slice(-1)
    setDigits(d)
    if (d[i] && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const d = Array(6).fill('').map((_, i) => pasted[i] || '')
    setDigits(d)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  async function verifyCode() {
    const code = digits.join('')
    if (code.length < 6) return
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${API}/api/tourist-auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, anonymous_visitor_id: anonymousVisitorId() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Invalid code — check and try again.'); return }
      await signIn()
    } catch { setError('Network error — try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page page">
      <div className="auth-bg">
        <img src="https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=800&q=80" alt="" />
        <div className="auth-overlay" />
      </div>

      <div className="auth-content">
        <button className="auth-back-btn" onClick={() => step === 'verify-code' ? setStep('input') : navigate('/')}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={20} height={20}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="auth-logo">🌊 Gulf Coast Radar</div>

        {searchParams.get('token') && !error ? (
          <div className="auth-form animate-fade-up" style={{ textAlign: 'center' }}>
            <h2>Signing you in… 🌊</h2>
            <p>Tap complete — just a second.</p>
          </div>
        ) : step === 'input' ? (
          <div className="auth-form animate-fade-up">
            <h2>{authMethod === 'phone' ? 'Get a text to sign in' : mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
            <p>{authMethod === 'phone' ? "We'll text you a code — no password needed." : mode === 'signup' ? 'Save your trip across devices with an email + password.' : 'Sign in to see your saved places & itinerary.'}</p>

            {/* One-tap SMS signup */}
            <a
              href={`sms:${SMS_NUMBER}?body=BEACH`}
              className="btn-sms-signup"
            >
              📱 Text BEACH to Sign Up / Sign In
            </a>
            <p className="auth-sms-hint">Tap above — opens your messages app, just hit send</p>
            <div className="auth-divider"><span>or sign in with phone number</span></div>

            {/* Method toggle */}
            <div className="auth-mode-toggle">
              <button
                className={`mode-btn ${authMethod === 'phone' ? 'active' : ''}`}
                onClick={() => { setAuthMethod('phone'); setError(''); setInfo('') }}
              >
                📱 Phone
              </button>
              <button
                className={`mode-btn ${authMethod === 'email' ? 'active' : ''}`}
                onClick={() => { setAuthMethod('email'); setError(''); setInfo('') }}
              >
                ✉️ Email
              </button>
            </div>

            {authMethod === 'phone' ? (
              <>
                <div className="input-group">
                  <span className="input-flag">🇺🇸 +1</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d\s\-().]/g, ''))}
                    className="phone-input"
                    autoFocus
                    autoComplete="tel"
                  />
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5' }}>
                    {error}
                  </div>
                )}

                <div id="recaptcha-container"></div>

                <button
                  id="send-code-btn"
                  className="btn-primary"
                  onClick={sendPhoneOTP}
                  disabled={phone.replace(/\D/g, '').length < 10 || loading}
                  style={{ marginTop: 4 }}
                >
                  {loading ? 'Sending…' : 'Send Code →'}
                </button>

                <p className="auth-legal">
                  By continuing, you agree to receive SMS and agree to our{' '}
                  <Link to="/terms" style={{ color: '#7c6af7' }}>Terms</Link> and{' '}
                  <Link to="/privacy" style={{ color: '#7c6af7' }}>Privacy Policy</Link>.
                </p>
              </>
            ) : (
              <>
                <div className="auth-mode-toggle" style={{ marginTop: 0 }}>
                  <button className={`mode-btn ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>
                    Sign Up
                  </button>
                  <button className={`mode-btn ${mode === 'signin' ? 'active' : ''}`} onClick={() => { setMode('signin'); setError(''); setInfo('') }}>
                    Sign In
                  </button>
                </div>

                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="setup-input"
                  style={{ fontSize: '17px' }}
                  autoFocus
                  autoComplete="email"
                />

                <input
                  type="password"
                  placeholder="Password (6+ characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="setup-input"
                  style={{ fontSize: '17px', marginTop: 12 }}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />

                {error && (
                  <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginTop: 12 }}>
                    {error}
                  </div>
                )}
                {info && (
                  <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#86efac', marginTop: 12 }}>
                    {info}
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={mode === 'signup' ? signUp : signIn}
                  disabled={!canSubmit() || loading}
                  style={{ marginTop: 16 }}
                >
                  {loading ? 'Working…' : mode === 'signup' ? 'Create Account →' : 'Sign In →'}
                </button>

                {mode === 'signin' && (
                  <button className="resend-btn" onClick={forgotPassword} disabled={loading}>
                    Forgot password?
                  </button>
                )}

                <p className="auth-legal">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" style={{ color: '#7c6af7' }}>Terms</Link> and{' '}
                  <Link to="/privacy" style={{ color: '#7c6af7' }}>Privacy Policy</Link>.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="auth-form animate-fade-up">
            <h2>{authMethod === 'phone' ? 'Check your texts 📱' : 'Check your email 📬'}</h2>
            <p>We sent a 6-digit code to <strong style={{ color: 'white' }}>{authMethod === 'phone' ? normalizePhone(phone) : email}</strong>.</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 6 }}>
              Enter it below — no need to leave this page.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 28 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  onFocus={() => setFocusedIdx(i)}
                  onBlur={() => setFocusedIdx(null)}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  style={{
                    width: 44, height: 54, textAlign: 'center', fontSize: 26, fontWeight: 700,
                    background: 'rgba(255,255,255,0.12)',
                    border: `2px solid ${focusedIdx === i ? '#0ea5e9' : 'rgba(255,255,255,0.25)'}`,
                    borderRadius: 10, color: 'white', outline: 'none', caretColor: 'transparent',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginTop: 16 }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#86efac', marginTop: 16 }}>
                {info}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={authMethod === 'phone' ? verifyPhoneCode : verifyCode}
              disabled={digits.join('').length < 6 || loading}
              style={{ marginTop: 20 }}
            >
              {loading ? 'Verifying…' : 'Verify & Continue →'}
            </button>

            <button className="resend-btn" onClick={authMethod === 'phone' ? resendPhoneOTP : resendCode} disabled={loading}>
              Resend code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
