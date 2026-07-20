import { useState, useRef, useEffect } from 'react'
import { API_BASE as API } from '../config'
import './LocationPicker.css'

export default function LocationPicker({ onSelect, initialValue = '' }) {
  const [input, setInput] = useState(initialValue)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const suggestionsRef = useRef(null)
  const inputRef = useRef(null)

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `${API}/api/gcr/locations/autocomplete?q=${encodeURIComponent(query)}`
      )
      const data = await res.json()
      setSuggestions(data.results || [])
      setSelectedIndex(-1)
    } catch (err) {
      console.error('Location search error:', err)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions(input)
    }, 300)
    return () => clearTimeout(timer)
  }, [input])

  const handleSelect = (location) => {
    setInput(location.name)
    setShowSuggestions(false)
    setSuggestions([])
    onSelect?.(location)
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        break
      default:
        break
    }
  }

  return (
    <div className="location-picker">
      <div className="location-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="location-input"
          placeholder="Where are you staying?"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => input && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
        />
        {loading && <div className="location-spinner">⌛</div>}
        {input && (
          <button
            className="location-clear"
            onClick={() => {
              setInput('')
              setSuggestions([])
              setShowSuggestions(false)
              inputRef.current?.focus()
            }}
          >
            ✕
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="location-suggestions">
          {suggestions.map((location, idx) => (
            <div
              key={idx}
              className={`location-suggestion ${idx === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(location)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="location-suggestion-icon">📍</div>
              <div className="location-suggestion-text">
                <div className="location-suggestion-name">{location.name}</div>
                {location.distance && (
                  <div className="location-suggestion-distance">
                    ~{location.distance}km away
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
