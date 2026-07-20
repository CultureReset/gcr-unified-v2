import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './BottomNav.css'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId } = useApp()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const navItems = userId
    ? [
        { icon: '🏠', label: 'Home',    path: '/home' },
        { icon: '🔍', label: 'Search',  path: '/search' },
        { icon: '👆', label: 'Swipe',   path: '/swipe/all' },
        { icon: '❤️', label: 'Saves',   path: '/saves' },
        { icon: '👤', label: 'Profile', path: '/profile' },
      ]
    : [
        { icon: '🏠', label: 'Home',     path: '/' },
        { icon: '🔍', label: 'Search',   path: '/search' },
        { icon: '🎉', label: 'Events',   path: '/events' },
        { icon: '👆', label: 'Swipe',    path: '/swipe/restaurants' },
        { icon: '👤', label: 'Sign In',  path: '/auth' },
      ]

  const visibleItems = navItems

  const handleNavClick = (path) => {
    navigate(path)
  }

  return (
    <nav className="bottom-nav">
      {visibleItems.map(item => (
        <button
          key={item.path}
          className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
          onClick={() => handleNavClick(item.path)}
          title={item.label}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
