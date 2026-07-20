import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE } from '../config'
import './ArtistLive.css'

// Standalone live-artist page (headerless, QR/link-tree style). Reads the same
// artist_profiles row the GCR directory profile does, but shows the live-show
// money layer instead of the directory/booking layer. Every section is gated on
// real data — nothing renders unless the artist actually has it filled in, and
// every action writes to a real endpoint (no demo/fake sections).
export default function ArtistLive() {
  const { slug } = useParams()
  const [data, setData]       = useState(null)
  const [queue, setQueue]     = useState([])
  const [loading, setLoading] = useState(true)

  // one form model shared across the three money actions
  const [song, setSong]       = useState('')
  const [name, setName]       = useState('')
  const [msg, setMsg]         = useState('')
  const [amount, setAmount]   = useState(10)
  const [active, setActive]   = useState(null)   // 'request' | 'shoutout' | 'tip' | null
  const [sent, setSent]       = useState(false)

  useEffect(() => {
    setLoading(true); setData(null); setQueue([]); setActive(null); setSent(false)
    setSong(''); setName(''); setMsg('')
    fetch(`${API_BASE}/api/gcr/artist/${slug}/live`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        if (d?.artist?.default_min) setAmount(d.artist.default_min)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
    fetch(`${API_BASE}/api/artists/${slug}/queue`)
      .then(r => r.ok ? r.json() : [])
      .then(q => setQueue(Array.isArray(q) ? q : []))
      .catch(() => setQueue([]))
  }, [slug])

  if (loading) return <div className="al-loading"><div className="al-spinner" /></div>
  if (!data?.artist) return (
    <div className="al-loading"><div style={{ fontSize: 48 }}>🎵</div><p>Artist not found</p></div>
  )

  const { artist, show } = data
  const min = artist.default_min || 10
  const amounts = [min, min * 2, min * 4, min * 10]
  const hasPay = !!(artist.cashapp || artist.venmo)

  const tags = [
    ...(artist.genre ? String(artist.genre).split(/[,/]/).map(s => s.trim()).filter(Boolean) : []),
    artist.hometown,
  ].filter(Boolean).slice(0, 4)

  async function logRequest(type) {
    try {
      await fetch(`${API_BASE}/api/artists/${slug}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_title: type === 'request' ? song : undefined,
          fan_name: name,
          note: msg,
          amount,
          request_type: type,
        }),
      })
    } catch {}
  }

  function pay(appType, type) {
    logRequest(type)
    setSent(true)
    if (appType === 'cashapp' && artist.cashapp) {
      const h = artist.cashapp.replace(/^\$/, '')
      window.open(`https://cash.app/$${h}/${amount}`, '_blank')
    } else if (appType === 'venmo' && artist.venmo) {
      const h = artist.venmo.replace(/^@/, '')
      const note = encodeURIComponent(song || msg || (type === 'tip' ? 'Tip' : 'Request'))
      window.open(`https://venmo.com/${h}?txn=pay&amount=${amount}&note=${note}`, '_blank')
    }
  }

  const share = () => {
    if (navigator.share) navigator.share({ title: artist.name, url: window.location.href }).catch(() => {})
  }

  // reusable action panel (request / shoutout / tip)
  function ActionPanel({ type, title, accent }) {
    return (
      <div className={`al-panel al-panel-${accent}`}>
        <div className="al-panel-title">{title}</div>
        {type === 'request' && (
          <>
            {Array.isArray(artist.songs) && artist.songs.length > 0 && (
              <div className="al-songs">
                {artist.songs.map((s, i) => {
                  const t = typeof s === 'string' ? s : s.title
                  return <button key={i} className={`al-song ${song === t ? 'on' : ''}`} onClick={() => setSong(t)}>{t}</button>
                })}
              </div>
            )}
            <input className="al-in" placeholder="Song name" value={song} onChange={e => setSong(e.target.value)} />
          </>
        )}
        {type === 'shoutout' && (
          <>
            <div className="al-examples">
              {['Happy Birthday! 🎂', 'Anniversary 💍', 'Roll Tide! 🐘', 'Bachelorette 🥂'].map(x => (
                <button key={x} className="al-ex" onClick={() => setMsg(x)}>{x}</button>
              ))}
            </div>
            <textarea className="al-in al-ta" placeholder="Your shoutout message…" value={msg} onChange={e => setMsg(e.target.value)} />
          </>
        )}
        <input className="al-in" placeholder="Your name or table #" value={name} onChange={e => setName(e.target.value)} />
        <div className="al-amounts">
          {amounts.map(a => (
            <button key={a} className={`al-amt ${amount === a ? 'on' : ''}`} onClick={() => setAmount(a)}>${a}</button>
          ))}
        </div>
        {hasPay ? (
          <div className="al-pay">
            {artist.cashapp && <button className="al-pay-btn al-cash" onClick={() => pay('cashapp', type)}>Cash App · ${amount}</button>}
            {artist.venmo && <button className="al-pay-btn al-venmo" onClick={() => pay('venmo', type)}>Venmo · ${amount}</button>}
          </div>
        ) : (
          <div className="al-nopay">This artist hasn't added a payment handle yet.</div>
        )}
        {sent && <div className="al-sent">Sent! Pay in the app you opened — {artist.name} gets it directly.</div>}
      </div>
    )
  }

  return (
    <div className="al-page">
      {/* HERO */}
      <div className="al-hero" style={{ backgroundImage: artist.photo_url ? `url(${artist.photo_url})` : undefined }}>
        <div className="al-hero-ov" />
        <div className="al-hero-top">
          <button className="al-icon" onClick={() => window.history.back()}>←</button>
          <button className="al-icon" onClick={share}>↗</button>
        </div>
        <div className="al-hero-btm">
          {show && <div className="al-live"><span className="al-dot" /> PLAYING NOW</div>}
          <h1 className="al-name">{artist.name}</h1>
          {tags.length > 0 && (
            <div className="al-tags">{tags.map((t, i) => <span key={i} className="al-tag">{t}</span>)}</div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="al-actions">
        {artist.request_enabled && (
          <button className={`al-act al-act-req ${active === 'request' ? 'on' : ''}`} onClick={() => setActive(active === 'request' ? null : 'request')}>
            <span>🎵</span> Request a Song
          </button>
        )}
        {artist.shoutout_enabled && (
          <button className={`al-act al-act-sh ${active === 'shoutout' ? 'on' : ''}`} onClick={() => setActive(active === 'shoutout' ? null : 'shoutout')}>
            <span>📢</span> Send a Shoutout
          </button>
        )}
        <button className={`al-act al-act-tip ${active === 'tip' ? 'on' : ''}`} onClick={() => setActive(active === 'tip' ? null : 'tip')}>
          <span>💸</span> Tip the Artist
        </button>
      </div>

      <div className="al-body">
        {/* expanded action */}
        {active === 'request'  && <ActionPanel type="request"  title="Request a Song"  accent="req" />}
        {active === 'shoutout' && <ActionPanel type="shoutout" title="Send a Shoutout" accent="sh" />}
        {active === 'tip'      && <ActionPanel type="tip"      title="Tip the Artist"  accent="tip" />}

        {/* NOW PLAYING (single real active show) */}
        {show && (
          <div className="al-card">
            <div className="al-label">Playing Now</div>
            <div className="al-show-venue">{show.venue}</div>
            <div className="al-show-meta">
              {[show.city, show.start_time && show.end_time ? `${show.start_time} – ${show.end_time}` : show.start_time].filter(Boolean).join(' · ')}
            </div>
          </div>
        )}

        {/* ABOUT */}
        {artist.bio && (
          <div className="al-card">
            <div className="al-label">About</div>
            <p className="al-bio">{artist.bio}</p>
          </div>
        )}

        {/* LIVE QUEUE (real) */}
        {queue.length > 0 && (
          <div className="al-card">
            <div className="al-label">Live Request Queue</div>
            <div className="al-queue">
              {queue.slice(0, 12).map((q, i) => (
                <div key={q.id || i} className="al-q">
                  <div className="al-q-rank">{i + 1}</div>
                  <div className="al-q-song">
                    <b>{q.song_title || (q.request_type === 'tip' ? 'Tip' : 'Shoutout')}</b>
                    {q.fan_name && <span> · {q.fan_name}</span>}
                  </div>
                  {q.amount > 0 && <div className="al-q-amt">${q.amount}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LINKS */}
        {(artist.instagram_url || artist.spotify_url) && (
          <div className="al-card">
            <div className="al-label">Links</div>
            <div className="al-links">
              {artist.instagram_url && <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="al-link">📸 Instagram</a>}
              {artist.spotify_url && <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" className="al-link">🎧 Spotify</a>}
            </div>
          </div>
        )}
      </div>

      <div className="al-footer">Powered by CyberCheck · Gulf Coast Radar</div>
    </div>
  )
}
