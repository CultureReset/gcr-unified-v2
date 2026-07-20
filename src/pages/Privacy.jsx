import { useNavigate } from 'react-router-dom'

export default function Privacy() {
  const navigate = useNavigate()
  return (
    <div className="page safe-top safe-bottom" style={{padding:'24px 20px 100px',color:'#fff',maxWidth:760,margin:'0 auto',lineHeight:1.6}}>
      <button onClick={() => navigate(-1)} style={{background:'none',border:'none',color:'#7c6af7',fontSize:14,cursor:'pointer',padding:0,marginBottom:16}}>← Back</button>
      <h1 style={{marginTop:0}}>Privacy Policy</h1>
      <p style={{color:'rgba(255,255,255,.6)'}}>Last updated: April 21, 2026</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> email address and password (hashed, never stored in plaintext).</li>
        <li><strong>Trip data:</strong> destination, travel dates, interests, places you save, itineraries you build.</li>
        <li><strong>Group data:</strong> if you join a group trip, other members can see the places you save to that group.</li>
      </ul>

      <h2>What we DON'T collect</h2>
      <ul>
        <li>No location tracking.</li>
        <li>No payment information (we don't charge tourists).</li>
        <li>No third-party ad tracking or cross-site cookies.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to operate the service — remember your saves across devices, build your itinerary, and show you personalized business recommendations from our partner network (Gulf Coast Radar listings).</p>

      <h2>Who we share it with</h2>
      <p>Nobody, except:</p>
      <ul>
        <li><strong>Supabase</strong> — our database provider (data stored in the United States).</li>
        <li><strong>Brevo</strong> — our email provider (used to send your confirmation and itinerary emails).</li>
        <li><strong>Vercel</strong> — hosts the app.</li>
        <li>Other members of a group trip you've explicitly joined (they see only what you saved to that specific group).</li>
      </ul>
      <p>We do <strong>not</strong> sell your data.</p>

      <h2>Your rights</h2>
      <ul>
        <li>You can delete your account at any time from the Profile page.</li>
        <li>You can request a full export of your data by emailing <a href="mailto:info@cybercheckinc.com" style={{color:'#7c6af7'}}>info@cybercheckinc.com</a>.</li>
        <li>Residents of California (CCPA) and the EU/UK (GDPR) have additional rights; contact us to exercise them.</li>
      </ul>

      <h2>Security</h2>
      <p>Passwords are hashed. Data is encrypted in transit (HTTPS). Database access is restricted via row-level security — your data is visible only to you (and group members, for group-tagged saves).</p>

      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:info@cybercheckinc.com" style={{color:'#7c6af7'}}>info@cybercheckinc.com</a>.</p>
    </div>
  )
}
