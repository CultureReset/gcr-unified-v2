import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏖️</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Page Not Found</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>That page doesn't exist or may have moved.</p>
      <button
        onClick={() => navigate('/')}
        style={{ padding: '12px 28px', background: '#667eea', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
      >
        Back to Gulf Coast Radar
      </button>
    </div>
  )
}
