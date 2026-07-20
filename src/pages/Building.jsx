import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, authFetch } from '../context/AppContext'
import './Building.css'

const STEPS = [
  'Reading your saved places',
  'Checking hours & categories',
  'Planning routes by location',
  'Matching your interests',
  'Building your itinerary with AI',
]

const FACTS = [
  "The Alabama Gulf Coast has some of the whitest sand beaches in the world, made of pure quartz",
  "Gulf Shores and Orange Beach draw millions of visitors to the Alabama coast each year",
  "The Alabama Gulf Coast is home to over 32 miles of stunning white-sand beaches",
  "The Gulf State Park pier in Gulf Shores is one of the longest public fishing piers in the Gulf",
]

export default function Building() {
  const navigate = useNavigate()
  const { savedPlaces, saveItinerary, tourist } = useApp()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    // animate steps up through 4; hold on 5 until AI responds
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i <= STEPS.length - 1) setStep(i)
      if (i >= STEPS.length - 1) clearInterval(interval)
    }, 700)

    buildItinerary().catch(e => {
      clearInterval(interval)
      setError(e?.message || 'Could not build itinerary')
    })
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buildItinerary() {
    if (!localStorage.getItem('gcr_access_token')) {
      // Not signed in — fall back to a trivial local plan from saves so UX still works
      const local = localBuild(savedPlaces, tourist)
      saveItinerary(local)
      setDone(true)
      setTimeout(() => navigate('/itinerary'), 600)
      return
    }

    const r = await authFetch('/api/tourist/build-itinerary', { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'AI planner failed')

    setStep(STEPS.length)
    saveItinerary(d.itinerary)
    setDone(true)
    setTimeout(() => navigate('/itinerary'), 800)
  }

  const fact = FACTS[Math.floor(Math.random() * FACTS.length)]

  if (error) return (
    <div className="building-page">
      <div className="building-content">
        <div className="building-logo">🌊 Gulf Coast Radar</div>
        <h2 style={{color:'#fca5a5'}}>Couldn't build your trip</h2>
        <p style={{color:'rgba(255,255,255,.7)'}}>{error}</p>
        <button className="btn-primary" style={{marginTop:20}} onClick={() => navigate('/home')}>Back to home</button>
      </div>
    </div>
  )

  return (
    <div className="building-page">
      <div className="building-content">
        <div className="building-logo">🌊 Gulf Coast Radar</div>
        <h2>Building your perfect trip…</h2>
        <p className="building-dest">{tourist?.destination || 'Gulf Coast'}</p>

        <div className="building-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`building-step ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
              <div className="step-icon">
                {i < step ? '✓' : i === step ? <span className="spinner" /> : '○'}
              </div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        {step >= 2 && (
          <div className="building-fact animate-fade-up">
            <span>💡</span>
            <span>{fact}</span>
          </div>
        )}

        {done && <div className="building-done animate-fade-up">✨ Your trip is ready!</div>}
      </div>
    </div>
  )
}

// Fallback for signed-out users (should rarely hit since /building requires login flow)
function localBuild(savedPlaces, tourist) {
  const days = tourist?.trip_days || 3
  const plan = Array.from({ length: Math.min(days, 3) }, (_, dayIdx) => {
    const dayPlaces = savedPlaces.filter((_, i) => i % Math.min(days, 3) === dayIdx)
    const slots = [
      dayPlaces[0] && { time: '9:00 AM',  business: dayPlaces[0], note: 'Start your morning here' },
      dayPlaces[1] && { time: '12:30 PM', business: dayPlaces[1], note: 'Lunch stop' },
      dayPlaces[2] && { time: '4:00 PM',  business: dayPlaces[2], note: 'Afternoon activity' },
      dayPlaces[3] && { time: '7:00 PM',  business: dayPlaces[3], note: 'Evening' },
    ].filter(Boolean)
    return { day: dayIdx + 1, date: `Day ${dayIdx + 1}`, slots }
  })
  return { days: plan, destination: tourist?.destination }
}
