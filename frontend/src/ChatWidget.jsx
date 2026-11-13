import { useEffect, useRef, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const panelStyle = {
  position: 'fixed',
  right: 16,
  bottom: 88,
  width: 'min(360px, calc(100vw - 32px))',
  maxHeight: 'min(620px, calc(100dvh - 112px))',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#ffffff',
  color: '#163a35',
  border: '1px solid #d8e5dd',
  borderRadius: 18,
  boxShadow: '0 12px 40px #123f3826',
  textAlign: 'left',
  fontFamily: 'Arial, sans-serif',
  zIndex: 1000,
}

const buttonStyle = {
  padding: '10px 12px',
  border: '1px solid #bccfc5',
  borderRadius: 10,
  background: '#f7f8f3',
  color: '#163a35',
  cursor: 'pointer',
  font: 'inherit',
}

const quickAnswers = [
  ['Services', 'Sample services: Dental checkup, Teeth cleaning and Restorative care (fillings and crowns).'],
  ['Hours', 'Sample hours: Monday–Saturday, 10 AM–7 PM Karachi time. Sunday closed.'],
  ['Prices', 'Prices have not been supplied for this fictional demo. Reception must provide accurate charges.'],
  ['Reception', 'Human handoff contact is not configured. Kisi ko message nahi bheja gaya.'],
]

const fallbackDetails = {
  not_configured: 'AI connection settings are missing.',
  invalid_account_id: 'AI account settings need checking.',
  provider_http_401: 'AI authentication needs checking.',
  provider_http_403: 'AI access permissions need checking.',
  provider_http_404: 'AI service configuration needs checking.',
  provider_http_429: 'AI usage limit reached.',
  timeout: 'AI took too long to respond.',
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Assalam o Alaikum! Pearl Dental Care fictional demo mein welcome. Ask about our sample services or hours in English, Urdu or Roman Urdu.',
      source: 'rules',
    },
  ])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messageEnd = useRef(null)
  const sendInProgress = useRef(false)

  useEffect(() => {
    if (isOpen) messageEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, isOpen, isSending])

  function openAppointmentForm() {
    const section = document.getElementById('appointment')
    if (section) {
      setIsOpen(false)
      section.scrollIntoView({ behavior: 'smooth' })
      section.querySelector('input')?.focus({ preventScroll: true })
    } else {
      setError('Appointment form is unavailable on this page.')
    }
  }

  function showQuickAnswer(reply) {
    setError('')
    setMessages((previous) => [
      ...previous.slice(-11),
      { role: 'assistant', content: reply, source: 'rules' },
    ])
  }

  async function sendMessage(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sendInProgress.current) return

    sendInProgress.current = true
    setIsSending(true)
    setError('')
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }))
    setMessages((previous) => [...previous.slice(-11), { role: 'user', content: text }])
    setDraft('')

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        setError(response.status === 429
          ? 'Please wait one minute before sending more messages.'
          : 'Reception chat is unavailable. Please use the quick answers below.')
        setDraft(text)
        return
      }
      const result = await response.json()
      if (typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('Invalid chat response')
      }
      setMessages((previous) => [
        ...previous.slice(-11),
        {
          role: 'assistant',
          content: result.reply,
          source: result.source,
          reason: result.reason,
          action: result.action,
        },
      ])
    } catch {
      setError('Connection interrupted. Quick answers and the appointment form are still available.')
      setDraft(text)
    } finally {
      sendInProgress.current = false
      setIsSending(false)
    }
  }

  return (
    <>
      {isOpen && (
        <section id="receptionist-panel" aria-labelledby="receptionist-title" style={panelStyle}>
          <header style={{ padding: 18, background: '#123f38', color: 'white', flexShrink: 0 }}>
            <strong id="receptionist-title">Pearl reception</strong>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>Fictional demo · English / Urdu / Roman Urdu</p>
          </header>

          <div role="log" aria-label="Reception conversation" aria-live="polite"
            style={{ padding: 16, overflowY: 'auto', minHeight: 80, flex: '1 1 auto' }}>
            {messages.map((message, index) => (
              <div key={index} style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: message.role === 'user' ? '#e0efe7' : '#f7f8f3',
                overflowWrap: 'anywhere',
              }}>
                <small>{message.role === 'user' ? 'You' : 'Pearl reception'}</small>
                <p dir="auto" style={{ margin: '6px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                {message.role === 'assistant' && (
                  <small style={{ color: '#52665e' }}>
                    {message.source === 'cloudflare' ? 'AI response · Cloudflare'
                      : message.source === 'fallback' ? 'Quick answer · AI unavailable' : 'Quick answer'}
                    {message.source === 'fallback' && ` — ${fallbackDetails[message.reason] || 'AI service is temporarily unavailable.'}`}
                  </small>
                )}
                {message.action === 'appointment_form' && (
                  <button type="button" onClick={openAppointmentForm} style={{ ...buttonStyle, marginTop: 8 }}>
                    Open appointment form
                  </button>
                )}
              </div>
            ))}
            {isSending && <p role="status">Reception is replying…</p>}
            <div ref={messageEnd} />
          </div>

          <div style={{ padding: '0 16px 16px', overflowY: 'auto', flexShrink: 0, maxHeight: '45dvh' }}>
            {error && <p role="alert" style={{ color: '#8a302b', fontSize: 13 }}>{error}</p>}
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
              <input aria-label="Message reception" placeholder="Type your question…" dir="auto"
                value={draft} onChange={(event) => setDraft(event.target.value)}
                maxLength={500} required disabled={isSending}
                style={{ minWidth: 0, flex: 1, padding: 10, border: '1px solid #bccfc5', borderRadius: 8, background: 'white', color: '#163a35', font: 'inherit' }} />
              <button type="submit" disabled={isSending || !draft.trim()} style={buttonStyle}>
                {isSending ? '…' : 'Send'}
              </button>
            </form>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {quickAnswers.map(([label, answer]) => (
                <button key={label} type="button" style={buttonStyle} disabled={isSending}
                  onClick={() => showQuickAnswer(answer)}>{label}</button>
              ))}
              <button type="button" style={buttonStyle} onClick={openAppointmentForm}>Request appointment</button>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 0 }}>
              Use sample details only. AI replies may be inaccurate. Reception must confirm appointments.
              Chat cannot provide diagnosis or prescriptions.
            </p>
          </div>
        </section>
      )}

      <button type="button" aria-expanded={isOpen} aria-controls="receptionist-panel"
        onClick={() => setIsOpen(!isOpen)} style={{
          position: 'fixed', right: 16, bottom: 20, padding: '15px 20px', border: 0,
          borderRadius: 30, background: '#123f38', color: 'white', boxShadow: '0 6px 20px #123f3833',
          cursor: 'pointer', font: '600 15px Arial, sans-serif', zIndex: 1000,
        }}>
        {isOpen ? 'Close reception' : 'Chat with reception'}
      </button>
    </>
  )
}
