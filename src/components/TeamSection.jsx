import { useState, useEffect } from 'react'
import { API_BASE } from '../config'

export default function TeamSection({ slug }) {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTeam()
  }, [slug])

  const loadTeam = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/team/${slug}`)
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team || [])
      }
    } catch (err) {
      console.error('Error loading team:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading team...</div>
  if (team.length === 0) return <p className="no-data">No team members listed</p>

  return (
    <section className="content-section team-section">
      <h2>👥 Our Team</h2>
      <div className="team-grid">
        {team.map((member) => (
          <div key={member.id} className="team-card">
            {member.photo_url && (
              <div className="team-photo">
                <img src={member.photo_url} alt={member.name} />
              </div>
            )}
            <div className="team-info">
              <h3 className="team-name">{member.name}</h3>
              {member.title && <p className="team-title">{member.title}</p>}
              {member.specialty && <p className="team-specialty">🏆 {member.specialty}</p>}
              {member.years_experience && (
                <p className="team-experience">📅 {member.years_experience} years</p>
              )}
              {member.certifications && member.certifications.length > 0 && (
                <div className="team-certifications">
                  {member.certifications.map((cert, i) => (
                    <span key={i} className="cert-badge">{cert}</span>
                  ))}
                </div>
              )}
              {member.bio && <p className="team-bio">{member.bio}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
