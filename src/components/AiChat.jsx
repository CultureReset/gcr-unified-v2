import { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE } from '../config'
import './AiChat.css'

function getToken() {
  return localStorage.getItem('gcr_access_token')
}

// Best-effort location grab. Never blocks the chat — resolves null on denial/timeout.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 3000, maximumAge: 300000 }
    )
  })
}

async function sendMessage({ message, history, conversationId }) {
  const token = getToken()
  const loc = await getLocation()
  const res = await fetch(`${API_BASE}/api/tourist/ai-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message,
      history: history.slice(-10),
      conversation_id: conversationId,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    }),
  })
  if (!res.ok) throw new Error('Chat error')
  return res.json()
}

const STARTERS = [
  "What's the best seafood spot?",
  "What's happening tonight?",
  "Best happy hour deals?",
  "Family-friendly activities?",
]

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setIsLoggedIn(!!getToken())
  }, [open])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hey! 👋 I'm your Gulf Coast Concierge. Ask me anything — best spots, what's open, hidden gems, happy hours, you name it.",
      }])
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const submit = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.filter(m => m.role !== 'system')
      const data = await sendMessage({ message: msg, history, conversationId })
      setConversationId(data.conversation_id || conversationId)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Hmm, something went wrong. Try again!" }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, conversationId])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const reset = () => {
    setMessages([])
    setConversationId(null)
  }

  if (open && !isLoggedIn) {
    return (
      <div className="ai-chat-window">
        <div className="ai-chat-header">
          <div className="chat-header-left">
            <span className="chat-avatar">🏖️</span>
            <div>
              <div className="chat-header-name">Gulf Coast Concierge</div>
              <div className="chat-header-sub">Your local guide</div>
            </div>
          </div>
          <button className="chat-icon-btn" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="ai-chat-login-prompt">
          <div className="chat-login-icon">🤖</div>
          <p>Sign in to chat with your personal Gulf Coast guide.</p>
          <a href="/auth" className="chat-login-btn">Sign In</a>
        </div>
      </div>
    )
  }

  return (
    <>
      {!open && (
        <button className="ai-chat-fab" onClick={() => setOpen(true)} aria-label="Chat with local guide">
          <span className="fab-icon">🏖️</span>
          <span className="fab-label">Ask a local</span>
        </button>
      )}

      {open && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <div className="chat-header-left">
              <span className="chat-avatar">🏖️</span>
              <div>
                <div className="chat-header-name">Gulf Coast Concierge</div>
                <div className="chat-header-sub">Your local guide</div>
              </div>
            </div>
            <div className="chat-header-actions">
              {messages.length > 1 && (
                <button className="chat-icon-btn" onClick={reset} title="New chat">✏️</button>
              )}
              <button className="chat-icon-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          <div className="ai-chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === 'assistant' && <span className="msg-avatar">🏖️</span>}
                <div className="msg-bubble">{m.content}</div>
              </div>
            ))}

            {loading && (
              <div className="chat-msg assistant">
                <span className="msg-avatar">🏖️</span>
                <div className="msg-bubble typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {messages.length === 1 && !loading && (
              <div className="chat-starters">
                {STARTERS.map((s, i) => (
                  <button key={i} className="chat-starter-btn" onClick={() => submit(s)}>{s}</button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="ai-chat-input-row">
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              placeholder="Ask about food, activities, happy hours…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={loading}
            />
            <button className="ai-chat-send" onClick={() => submit()} disabled={!input.trim() || loading}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
