import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { searchProperties } from '../services/gcrApi'
import { API_BASE as API } from '../config'
import './Setup.css'

function ProgressBar({ step, total }) {
  return (
    <div className="setup-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`progress-dot ${i < step ? 'active' : ''}`} />
      ))}
    </div>
  )
}

export default function Setup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { saveTourist, tourist } = useApp()

  const stepSlug = location.pathname.replace(/^\/setup\/?/, '').split('/')[0] || ''

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState(() => ({
    name: tourist?.name || '',
    destination: tourist?.destination || '',
    arrival: tourist?.arrival || '',
    departure: tourist?.departure || '',
    group_type: tourist?.group_type || '',
    group_size: tourist?.group_size || '',
    budget: tourist?.budget || '',
    stay_status: tourist?.stay_status || '',
    hotel_name: tourist?.hotel_name || '',
    interests: Array.isArray(tourist?.interests) ? tourist.interests : [],
  }))

  useEffect(() => {
    fetch(`${API}/api/tourist/setup-questions`)
      .then(r => r.json())
      .then(d => {
        // Filter out destination question — app is Alabama Gulf Coast only
        const qs = (d.questions || []).filter(q => q.field_name !== 'destination')
        setQuestions(qs)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!questions.length || !stepSlug) return
    const i = questions.findIndex(q => q.field_name === stepSlug || q.key === stepSlug)
    if (i >= 0) setIdx(i)
    else if (stepSlug === 'destination' || stepSlug === 'arrival' || stepSlug === 'departure') {
      const j = questions.findIndex(q => q.input_type === 'daterange' || q.key === 'arrival')
      if (j >= 0) setIdx(j)
    }
  }, [questions, stepSlug])

  if (loading) return <div className="setup-page" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>Loading…</div>
  if (error)   return <div className="setup-page" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',padding:20,textAlign:'center'}}>{error}</div>
  if (!questions.length) return <div className="setup-page" style={{color:'#fff',padding:20}}>No setup questions configured.</div>

  const q = questions[idx]
  const total = questions.length
  const isLast = idx === total - 1

  function setAnswer(key, value) { setAnswers(prev => ({ ...prev, [key]: value })) }

  function canContinue() {
    if (!q.required) return true
    const v = getVal()
    if (q.input_type === 'daterange') return answers.arrival && answers.departure
    if (Array.isArray(v)) return v.length > 0
    return v !== '' && v !== null && v !== undefined
  }

  function getVal() {
    if (q.input_type === 'daterange') return { arrival: answers.arrival, departure: answers.departure }
    return answers[q.key]
  }

  async function next() {
    if (!canContinue()) return
    if (isLast) return finish()
    setIdx(idx + 1)
  }

  async function back() { if (idx > 0) setIdx(idx - 1); else navigate(tourist?.setupComplete ? '/profile' : '/') }

  async function finish() {
    // Compute derived fields
    let trip_days = null
    if (answers.arrival && answers.departure) {
      const a = new Date(answers.arrival), b = new Date(answers.departure)
      trip_days = Math.max(1, Math.round((b - a) / 86400000) + 1)
    }
    // Fixed fields vs custom
    const known = ['name','destination','arrival','departure','group_type','group_size','budget','stay_status','hotel_name','interests']
    const customAnswers = {}
    questions.forEach(qq => {
      if (!known.includes(qq.key)) customAnswers[qq.key] = answers[qq.key] ?? null
    })
    await saveTourist({
      name: answers.name,
      destination: 'Orange Beach, AL',
      arrival: answers.arrival || null,
      departure: answers.departure || null,
      trip_days,
      group_type: answers.group_type || null,
      group_size: answers.group_size ? parseInt(answers.group_size, 10) : null,
      budget: answers.budget || null,
      stay_status: answers.stay_status || null,
      hotel_name: answers.hotel_name || null,
      interests: Array.isArray(answers.interests) ? answers.interests : [],
      answers: customAnswers,
      setupComplete: true,
    })
    // If tourist is looking for accommodation, show them rental properties
    if (answers.stay_status === 'looking' || answers.stay_status === 'no') {
      navigate('/swipe/staying', { replace: true })
    } else {
      navigate('/home', { replace: true })
    }
  }

  return (
    <div className="setup-page">
      <ProgressBar step={idx + 1} total={total} />
      <div className="setup-content">
        <button onClick={back} className="back-btn" style={{position:'absolute',top:16,left:16}}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={20} height={20}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2>{q.label}{q.required && <span style={{color:'#f97316'}}> *</span>}</h2>
        {q.subtitle && <p>{q.subtitle}</p>}

        <QuestionInput q={q} answers={answers} setAnswer={setAnswer} />

        <button className="btn-primary" onClick={next} disabled={!canContinue()} style={{marginTop:24}}>
          {isLast ? 'Finish →' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

function AutocompleteInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  const handleInputChange = async (e) => {
    const text = e.target.value
    onChange(text)
    if (text.length > 0) {
      const results = await searchProperties(text)
      setSuggestions(results)
      setOpen(true)
    } else {
      setSuggestions([])
      setOpen(false)
    }
  }

  const selectSuggestion = (suggestion) => {
    onChange(suggestion.name)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="setup-input"
        type="text"
        placeholder={placeholder || ''}
        value={value || ''}
        onChange={handleInputChange}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        autoFocus
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'rgba(18,18,31,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          maxHeight: 200,
          overflowY: 'auto',
          zIndex: 10,
        }}>
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSuggestion(s)}
              style={{
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.target.style.background = 'rgba(124,106,247,0.1)'}
              onMouseLeave={e => e.target.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 500 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{s.type} · {s.city}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionInput({ q, answers, setAnswer }) {
  const val = answers[q.key]
  const opts = Array.isArray(q.options) ? q.options : []

  // Special handling for hotel_name field — autocomplete
  if (q.key === 'hotel_name') {
    return <AutocompleteInput value={val || ''} onChange={v => setAnswer(q.key, v)} placeholder={q.placeholder || 'Search hotels...'} />
  }

  switch (q.input_type) {
    case 'text':
    case 'email':
      return <input className="setup-input" type={q.input_type} placeholder={q.placeholder || ''} value={val || ''} onChange={e => setAnswer(q.key, e.target.value)} autoFocus />
    case 'number':
      return <input className="setup-input" type="number" placeholder={q.placeholder || ''} value={val || ''} onChange={e => setAnswer(q.key, e.target.value)} autoFocus />
    case 'date':
      return <input className="setup-input" type="date" value={val || ''} onChange={e => setAnswer(q.key, e.target.value)} />
    case 'daterange':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div>
            <label style={{display:'block',fontSize:13,color:'rgba(255,255,255,.6)',marginBottom:6}}>Arrival</label>
            <input className="setup-input" type="date" value={answers.arrival || ''} onChange={e => setAnswer('arrival', e.target.value)} />
          </div>
          <div>
            <label style={{display:'block',fontSize:13,color:'rgba(255,255,255,.6)',marginBottom:6}}>Departure</label>
            <input className="setup-input" type="date" value={answers.departure || ''} onChange={e => setAnswer('departure', e.target.value)} />
          </div>
        </div>
      )
    case 'textarea':
      return <textarea className="setup-input" rows="4" placeholder={q.placeholder || ''} value={val || ''} onChange={e => setAnswer(q.key, e.target.value)} />
    case 'select':
      return (
        <select className="setup-input" value={val || ''} onChange={e => setAnswer(q.key, e.target.value)}>
          <option value="">{q.placeholder || 'Choose…'}</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {opts.map(o => (
            <label key={o.value} style={{display:'flex',alignItems:'center',gap:10,padding:14,background:val===o.value?'rgba(124,106,247,.2)':'rgba(255,255,255,.04)',border:'1px solid '+(val===o.value?'rgba(124,106,247,.5)':'rgba(255,255,255,.1)'),borderRadius:12,cursor:'pointer',color:'#fff'}}>
              <input type="radio" name={q.key} checked={val === o.value} onChange={() => setAnswer(q.key, o.value)} />
              <span>{o.icon ? o.icon + ' ' : ''}{o.label || o.value}</span>
            </label>
          ))}
        </div>
      )
    case 'tags':
    case 'multi_select': {
      const arr = Array.isArray(val) ? val : []
      const toggle = v => setAnswer(q.key, arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
      return (
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {opts.map(o => (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              style={{
                padding:'10px 14px',
                borderRadius:999,
                border:'1px solid '+(arr.includes(o.value)?'rgba(124,106,247,.5)':'rgba(255,255,255,.15)'),
                background: arr.includes(o.value) ? 'rgba(124,106,247,.25)' : 'rgba(255,255,255,.04)',
                color:'#fff',
                cursor:'pointer',
                fontSize:14,
              }}
            >{o.label || o.value}</button>
          ))}
        </div>
      )
    }
    default:
      return <input className="setup-input" placeholder={q.placeholder || ''} value={val || ''} onChange={e => setAnswer(q.key, e.target.value)} />
  }
}
