import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../context/AppContext'
import './Group.css'

export default function Groups() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('mine') // 'mine' | 'create' | 'join'
  const [myGroups, setMyGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create form
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('Orange Beach, AL')
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')
  const [sharingMode, setSharingMode] = useState('trip_end') // 'trip_end' | 'custom_date' | 'ongoing'
  const [sharingUntil, setSharingUntil] = useState('')

  // Join form
  const [inviteCode, setInviteCode] = useState('')

  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await authFetch('/api/tourist/groups')
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not load'); return }
      setMyGroups(d.groups || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function createGroup() {
    if (!name.trim()) return
    if (sharingMode === 'custom_date' && !sharingUntil) { setError('Pick a date for custom sharing'); return }
    setBusy(true); setError('')
    try {
      const r = await authFetch('/api/tourist/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          destination: destination || null,
          arrival: arrival || null,
          departure: departure || null,
          sharing_mode: sharingMode,
          sharing_until: sharingMode === 'custom_date' ? sharingUntil : null,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Create failed'); return }
      navigate('/group/' + d.group.slug)
    } finally { setBusy(false) }
  }

  async function joinGroup() {
    if (!inviteCode.trim()) return
    setBusy(true); setError('')
    try {
      const r = await authFetch('/api/tourist/groups/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode.trim().toUpperCase() }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Join failed'); return }
      navigate('/group/' + d.group.slug)
    } finally { setBusy(false) }
  }

  return (
    <div className="group-page page safe-top safe-bottom">
      <div className="group-header">
        <button className="back-btn-sm" onClick={() => navigate('/home')}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={20} height={20}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 style={{margin:0}}>Group Trips</h2>
      </div>

      <div className="group-tabs" style={{marginTop:8}}>
        <button className={mode === 'mine' ? 'active' : ''} onClick={() => setMode('mine')}>My Trips</button>
        <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create</button>
        <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Join</button>
      </div>

      {error && (
        <div style={{margin:'12px 16px',padding:'10px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:12,color:'#fca5a5',fontSize:13}}>
          {error}
        </div>
      )}

      <div style={{padding:16}}>
        {mode === 'mine' && (
          loading ? <div style={{color:'rgba(255,255,255,.6)'}}>Loading…</div>
          : myGroups.length === 0 ? (
            <div style={{textAlign:'center',color:'rgba(255,255,255,.6)',padding:40}}>
              <div style={{fontSize:48,marginBottom:12}}>👥</div>
              <div>No group trips yet.</div>
              <div style={{marginTop:16,display:'flex',gap:8,justifyContent:'center'}}>
                <button className="btn-primary" onClick={() => setMode('create')} style={{padding:'10px 18px'}}>Create one</button>
                <button className="btn-primary" onClick={() => setMode('join')} style={{padding:'10px 18px',background:'rgba(255,255,255,.08)'}}>Join via code</button>
              </div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {myGroups.map(g => (
                <div key={g.id} className="group-overlap-card" onClick={() => navigate('/group/' + g.slug)}>
                  <div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#0ea5e9,#7c6af7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🧭</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,color:'#fff'}}>{g.name}</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.6)'}}>
                      {g.destination || 'Trip'}
                      {g.arrival && ` · ${new Date(g.arrival).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {mode === 'create' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <input className="setup-input" placeholder="Trip name (e.g. Beach trip June 2026)" value={name} onChange={e => setName(e.target.value)} />
            <input className="setup-input" placeholder="Destination (optional)" value={destination} onChange={e => setDestination(e.target.value)} />
            <input className="setup-input" type="date" value={arrival} onChange={e => setArrival(e.target.value)} placeholder="Arrival" />
            <input className="setup-input" type="date" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="Departure" />

            <div style={{marginTop:8}}>
              <div style={{fontSize:13,color:'rgba(255,255,255,.7)',marginBottom:8}}>How long should sharing last?</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <label style={{display:'flex',alignItems:'center',gap:10,padding:12,background:sharingMode==='trip_end'?'rgba(124,106,247,.2)':'rgba(255,255,255,.04)',border:'1px solid '+(sharingMode==='trip_end'?'rgba(124,106,247,.5)':'rgba(255,255,255,.1)'),borderRadius:10,cursor:'pointer'}}>
                  <input type="radio" checked={sharingMode==='trip_end'} onChange={() => setSharingMode('trip_end')} />
                  <div>
                    <div style={{fontWeight:600}}>Until the trip ends</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>Auto-disconnect the day after departure</div>
                  </div>
                </label>
                <label style={{display:'flex',alignItems:'center',gap:10,padding:12,background:sharingMode==='custom_date'?'rgba(124,106,247,.2)':'rgba(255,255,255,.04)',border:'1px solid '+(sharingMode==='custom_date'?'rgba(124,106,247,.5)':'rgba(255,255,255,.1)'),borderRadius:10,cursor:'pointer'}}>
                  <input type="radio" checked={sharingMode==='custom_date'} onChange={() => setSharingMode('custom_date')} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600}}>Until a specific date</div>
                    {sharingMode === 'custom_date' && (
                      <input className="setup-input" type="date" value={sharingUntil} onChange={e => setSharingUntil(e.target.value)} style={{marginTop:8,fontSize:14}} />
                    )}
                  </div>
                </label>
                <label style={{display:'flex',alignItems:'center',gap:10,padding:12,background:sharingMode==='ongoing'?'rgba(124,106,247,.2)':'rgba(255,255,255,.04)',border:'1px solid '+(sharingMode==='ongoing'?'rgba(124,106,247,.5)':'rgba(255,255,255,.1)'),borderRadius:10,cursor:'pointer'}}>
                  <input type="radio" checked={sharingMode==='ongoing'} onChange={() => setSharingMode('ongoing')} />
                  <div>
                    <div style={{fontWeight:600}}>Ongoing</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>For friend groups who travel together often</div>
                  </div>
                </label>
              </div>
            </div>

            <button className="btn-primary" onClick={createGroup} disabled={!name.trim() || busy} style={{marginTop:12}}>
              {busy ? 'Creating…' : 'Create group →'}
            </button>
            <p style={{color:'rgba(255,255,255,.5)',fontSize:12,margin:0}}>You'll get one-time invite links to share. Each link works for exactly one friend.</p>
          </div>
        )}

        {mode === 'join' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <input
              className="setup-input"
              placeholder="6-character invite code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
              style={{fontSize:22,letterSpacing:4,textAlign:'center',fontFamily:'monospace'}}
              maxLength={6}
            />
            <button className="btn-primary" onClick={joinGroup} disabled={inviteCode.length < 6 || busy}>
              {busy ? 'Joining…' : 'Join group →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
