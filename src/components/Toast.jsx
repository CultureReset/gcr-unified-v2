import { useEffect } from 'react'
import './Toast.css'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' && '✓ '}
      {type === 'error' && '✗ '}
      {type === 'info' && 'ℹ '}
      {message}
    </div>
  )
}
