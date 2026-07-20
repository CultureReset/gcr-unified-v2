import { useNavigate } from 'react-router-dom'

export default function Terms() {
  const navigate = useNavigate()
  return (
    <div className="page safe-top safe-bottom" style={{padding:'24px 20px 100px',color:'#fff',maxWidth:760,margin:'0 auto',lineHeight:1.6}}>
      <button onClick={() => navigate(-1)} style={{background:'none',border:'none',color:'#7c6af7',fontSize:14,cursor:'pointer',padding:0,marginBottom:16}}>← Back</button>
      <h1 style={{marginTop:0}}>Terms of Service</h1>
      <p style={{color:'rgba(255,255,255,.6)'}}>Last updated: April 21, 2026</p>

      <h2>1. Who we are</h2>
      <p>Gulf Coast Radar ("the Service") is operated by CyberCheck Inc. Contact: <a href="mailto:info@cybercheckinc.com" style={{color:'#7c6af7'}}>info@cybercheckinc.com</a>.</p>

      <h2>2. Your account</h2>
      <p>You must provide a valid email address. You're responsible for keeping your password secure. You must be 13 or older to use the Service.</p>

      <h2>3. What the Service does</h2>
      <p>The Service helps you discover Gulf Coast businesses (restaurants, activities, etc.), save ones you like, and plan a trip itinerary. Business listings are sourced from our partner network. Business hours, prices, and availability are provided by those businesses and may change without notice — we're not responsible for inaccurate third-party content.</p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Don't use the Service for anything illegal.</li>
        <li>Don't spam, harass, or impersonate others.</li>
        <li>Don't scrape, reverse-engineer, or abuse the API.</li>
        <li>Don't upload content you don't own or have permission to use.</li>
      </ul>

      <h2>5. User content</h2>
      <p>Saves, itineraries, and group content you create belong to you. By using group features, you grant other members of your group permission to view what you've saved to that group. You can delete your content or your account at any time.</p>

      <h2>6. No bookings or payments</h2>
      <p>The Service does not process reservations, bookings, or payments. Any transactions with listed businesses happen directly between you and the business — we're not a party to those transactions.</p>

      <h2>7. Disclaimer</h2>
      <p>The Service is provided "as is," without warranties of any kind. We don't guarantee the accuracy of listings, availability of businesses, or that the Service will be uninterrupted.</p>

      <h2>8. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, CyberCheck Inc. is not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>

      <h2>9. Changes</h2>
      <p>We may update these Terms. We'll update the "Last updated" date. Continued use after an update means you accept the new Terms.</p>

      <h2>10. Governing law</h2>
      <p>These Terms are governed by the laws of the United States.</p>

      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:info@cybercheckinc.com" style={{color:'#7c6af7'}}>info@cybercheckinc.com</a>.</p>
    </div>
  )
}
