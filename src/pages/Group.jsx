import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authFetch } from '../context/AppContext'
import Toast from '../components/Toast'
import './Group.css'

export default function Group() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overlaps')
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await authFetch(`/api/tourist/groups/${encodeURIComponent(slug)}`)
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Could not load group'); return }
      setData(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [slug])

  if (loading) return <div className="page safe-top" style={{padding:20,color:'#fff'}}>Loading group…</div>
  if (error)   return <div className="page safe-top" style={{padding:20,color:'#fff'}}>
    <p>{error}</p>
    <button className="btn-primary" onClick={() => navigate('/home')} style={{marginTop:16}}>Back to home</button>
  </div>
  if (!data)   return null

  const { group, members, overlaps } = data
  const memberCount = members.length
  const mustDoThreshold = Math.max(2, Math.ceil(memberCount / 2))
  const mustDo = overlaps.filter(o => o.count >= mustDoThreshold)

  const shareTitle = `Join my ${group.destination || 'Gulf Coast'} trip`

  async function freshInvite() {
    const r = await authFetch(`/api/tourist/groups/${encodeURIComponent(group.slug)}/create-invite`, {
      method: 'POST',
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'Could not create invite')
    return d
  }

  async function withInvite(action) {
    try {
      setGenerating(true)
      const invite = await freshInvite()
      const text = `Join my ${group.destination || group.name} trip on Gulf Coast Radar. This one-time link expires in 48 hours: ${invite.url}`
      await action({ url: invite.url, text })
    } catch (e) {
      setToast({ message: e.message || 'Failed to create invite link', type: 'error' })
    } finally { setGenerating(false) }
  }

  async function nativeShare()   { await withInvite(async ({ url, text }) => {
    if (navigator.share) { try { await navigator.share({ title: shareTitle, text, url }) } catch(e) {} }
    else { navigator.clipboard.writeText(text); setToast({ message: 'Invite copied — paste it anywhere', type: 'success' }) }
  })}
  async function copyInvite()    { await withInvite(async ({ text })   => { navigator.clipboard.writeText(text); setToast({ message: 'One-time invite copied', type: 'success' }) })}
  async function shareSMS()      { await withInvite(async ({ text })   => { window.location.href = `sms:?&body=${encodeURIComponent(text)}` })}
  async function shareWhatsApp() { await withInvite(async ({ text })   => { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank') })}
  async function shareEmail()    { await withInvite(async ({ text })   => { window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(text)}` })}
  async function shareTwitter()  { await withInvite(async ({ text })   => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank') })}

  return (
    <div className="group-page page safe-top safe-bottom">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="group-header">
        <button className="back-btn-sm" onClick={() => navigate('/home')}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={20} height={20}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{flex:1,minWidth:0}}>
          <h2 style={{margin:0}}>{group.name}</h2>
          <div style={{fontSize:13,color:'rgba(255,255,255,.6)'}}>
            {group.destination || 'Trip'}
            {group.arrival && ` · ${new Date(group.arrival).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
            {group.departure && `–${new Date(group.departure).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
          </div>
        </div>
      </div>

      {group.sharing_expired && (
        <div className="trip-expired-banner">
          🔒 Sharing has ended. You can still see your own saves but no longer see what others saved.
        </div>
      )}
      {!group.sharing_expired && group.sharing_ends_on && (
        <div style={{margin:'8px 16px',fontSize:12,color:'rgba(255,255,255,.5)',textAlign:'center'}}>
          Sharing ends {new Date(group.sharing_ends_on).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
        </div>
      )}
      {!group.sharing_expired && !group.sharing_ends_on && (
        <div style={{margin:'8px 16px',fontSize:12,color:'rgba(255,255,255,.5)',textAlign:'center'}}>
          ♾️ Ongoing sharing
        </div>
      )}

      <div className="group-code-card">
        <div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:1}}>Invite code</div>
          <div style={{fontSize:26,fontWeight:800,letterSpacing:4,color:'#fff'}}>{group.invite_code}</div>
        </div>
        <button className="btn-primary" onClick={nativeShare} style={{padding:'10px 16px'}}>↗️ Share</button>
      </div>

      <div className="share-row">
        <button className="share-pill" onClick={shareSMS}      title="Text it">📱 Text</button>
        <button className="share-pill" onClick={shareWhatsApp} title="WhatsApp">💬 WhatsApp</button>
        <button className="share-pill" onClick={shareEmail}    title="Email">📧 Email</button>
        <button className="share-pill" onClick={shareTwitter}  title="Share on X">🐦 X</button>
        <button className="share-pill" onClick={copyInvite}    title="Copy link">📋 Copy</button>
      </div>

      <div className="group-members-row">
        {members.map(m => (
          <div key={m.user_id} className="group-avatar" title={m.display_name || m.email}>
            {(m.display_name || m.email || '?')[0]?.toUpperCase()}
          </div>
        ))}
        <div style={{fontSize:13,color:'rgba(255,255,255,.6)'}}>{memberCount} member{memberCount !== 1 ? 's' : ''}</div>
      </div>

      <div className="group-tabs">
        <button className={tab === 'overlaps' ? 'active' : ''} onClick={() => setTab('overlaps')}>All saves</button>
        <button className={tab === 'mustdo' ? 'active' : ''} onClick={() => setTab('mustdo')}>Must-do ({mustDo.length})</button>
      </div>

      <div style={{padding:'12px 16px'}}>
        {(tab === 'mustdo' ? mustDo : overlaps).length === 0 ? (
          <div style={{textAlign:'center',color:'rgba(255,255,255,.6)',padding:40}}>
            {tab === 'mustdo'
              ? `Nothing yet — once ${mustDoThreshold}+ people save the same place, it'll show here.`
              : 'No saves yet. Have everyone start swiping!'}
            <div style={{marginTop:16}}>
              <button className="btn-primary" onClick={() => navigate('/home')} style={{padding:'10px 20px'}}>Start swiping</button>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {(tab === 'mustdo' ? mustDo : overlaps).map(o => (
              <div key={o.entity_slug} className="group-overlap-card" onClick={() => navigate('/business/' + o.entity_slug)}>
                {o.hero_image_url && <img src={o.hero_image_url} alt="" />}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{o.business_name}</div>
                  {o.subtitle && <div style={{fontSize:12,color:'rgba(255,255,255,.6)'}}>{o.subtitle}</div>}
                  <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginTop:4}}>
                    Saved by {o.savers.map(s => s.display_name).join(', ')}
                  </div>
                </div>
                <div className={`overlap-badge ${o.count >= mustDoThreshold ? 'hot' : ''}`}>
                  {o.count}/{memberCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
