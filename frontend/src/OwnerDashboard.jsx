import { useEffect, useState } from 'react'
import './OwnerDashboard.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const statuses = ['New', 'Contacted', 'Confirmed', 'Completed', 'Cancelled']

async function adminRequest(path, token, options = {}) {
  const response = await fetch(`${API_BASE}/admin${path}`, {
    ...options,
    cache: 'no-store',
    signal: options.signal || AbortSignal.timeout(15000),
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const result = await response.json()
  if (!response.ok) {
    const message = typeof result.detail === 'string' ? result.detail : 'Please check the entered details.'
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return result
}

export default function OwnerDashboard() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [changes, setChanges] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!session) return undefined
    const remaining = session.expiresAt - Date.now()
    const timer = window.setTimeout(() => {
      setSession(null)
      setData(null)
      setChanges({})
      setNotice('')
      setError('Your session expired. Please sign in again.')
    }, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    let active = true
    adminRequest(`/appointments?page=${page}`, session.token, { signal: controller.signal })
      .then((result) => { if (active) setData(result) })
      .catch((failure) => {
        if (!active) return
        if (failure.status === 401 || failure.status === 403) {
          setSession(null)
          setData(null)
          setChanges({})
        }
        setError(failure.message || 'Could not load appointments. Please refresh.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [session, page, refreshVersion])

  async function signIn(event) {
    event.preventDefault()
    if (loginBusy) return
    setLoginBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await adminRequest('/login', null, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      setLoading(true)
      setData(null)
      setSession({ token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 })
      setPage(1)
      setPassword('')
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not connect. Check that the backend is running.')
    } finally {
      setLoginBusy(false)
    }
  }

  function signOut() {
    setSession(null)
    setData(null)
    setChanges({})
    setEmail('')
    setPassword('')
    setError('')
    setNotice('Signed out on this page.')
  }

  function refreshRequests() {
    setLoading(true)
    setData(null)
    setError('')
    setRefreshVersion((value) => value + 1)
  }

  function changePage(nextPage) {
    setChanges({})
    setLoading(true)
    setData(null)
    setError('')
    setPage(nextPage)
  }

  async function saveStatus(row) {
    if (savingId || !session) return
    const nextStatus = changes[row.id] || row.status
    if (nextStatus === row.status) return
    if (nextStatus === 'Confirmed' && !window.confirm('Confirm this appointment? First verify the requested slot with reception.')) return
    if (nextStatus === 'Cancelled' && !window.confirm('Mark this appointment as Cancelled?')) return
    setSavingId(row.id)
    setError('')
    setNotice('')
    try {
      await adminRequest(`/appointments/${row.id}/status`, session.token, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, expected_status: row.status }),
      })
      setChanges((previous) => {
        const updated = { ...previous }
        delete updated[row.id]
        return updated
      })
      setNotice(`Status saved as ${nextStatus}.`)
      refreshRequests()
    } catch (failure) {
      if (failure.status === 401 || failure.status === 403) {
        setSession(null)
        setData(null)
      }
      setError(failure.status ? failure.message : 'Connection interrupted. Refresh to check whether the status was saved before retrying.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="owner-dashboard">
      <header className="owner-heading">
        <div>
          <p className="owner-eyebrow">CLINICFLOW AI · FICTIONAL DEMO</p>
          <h1>Owner dashboard</h1>
          <p>{data?.business_name || 'Pearl Dental Care, Karachi'}</p>
        </div>
        <nav aria-label="Owner navigation">
          <a href="/">View clinic website</a>
          {session && <button type="button" onClick={signOut} disabled={Boolean(savingId)}>Sign out</button>}
        </nav>
      </header>

      {error && <p role="alert" className="owner-error">{error}</p>}
      {notice && <p role="status" className="owner-notice">{notice}</p>}

      {!session ? (
        <section className="owner-login">
          <h2>Sign in to your business</h2>
          <p>Use your Supabase Auth owner account.</p>
          <form onSubmit={signIn}>
            <label>Email
              <input type="email" autoComplete="username" value={email}
                onChange={(event) => setEmail(event.target.value)} required maxLength={254} disabled={loginBusy} />
            </label>
            <label>Password
              <input type="password" autoComplete="current-password" value={password}
                onChange={(event) => setPassword(event.target.value)} required disabled={loginBusy} />
            </label>
            <button type="submit" disabled={loginBusy}>{loginBusy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="owner-muted">This demo keeps your login in page memory. Refreshing the page requires signing in again.</p>
        </section>
      ) : (
        <>
          <div className="owner-toolbar">
            <h2>Appointment requests</h2>
            <button type="button" disabled={loading || Boolean(savingId)}
              onClick={refreshRequests}>Refresh requests</button>
          </div>
          {loading && <p role="status">Loading your business requests…</p>}
          {data && (
            <>
              <div className="owner-metrics">
                {[['Total appointment requests', data.total], ['New requests', data.new], ['Confirmed appointments', data.confirmed]].map(([label, value]) => (
                  <article key={label}><span>{label}</span><strong>{value}</strong></article>
                ))}
              </div>
              <p className="owner-muted">Requested dates and times use Karachi time. Only synthetic customer details belong in this demo.</p>
              {data.appointments.length === 0 ? <p>No appointment requests on this page.</p> : (
                <div className="owner-table-scroll" role="region" aria-label="Appointment requests" tabIndex={0}>
                  <table>
                    <thead><tr><th>Customer</th><th>Service</th><th>Requested visit</th><th>Message</th><th>Status</th></tr></thead>
                    <tbody>
                      {data.appointments.map((row) => (
                        <tr key={row.id}>
                          <td><strong>{row.customer_name}</strong><br /><span>{row.phone}</span></td>
                          <td>{row.service}</td>
                          <td>{row.preferred_date}<br />{row.preferred_time.slice(0, 5)}</td>
                          <td className="owner-message">{row.message || '—'}</td>
                          <td>
                            <label className="owner-sr-only" htmlFor={`status-${row.id}`}>Status for {row.customer_name}</label>
                            <select id={`status-${row.id}`} value={changes[row.id] || row.status}
                              disabled={Boolean(savingId)} onChange={(event) => setChanges((previous) => ({ ...previous, [row.id]: event.target.value }))}>
                              {statuses.map((status) => <option key={status}>{status}</option>)}
                            </select>
                            <button type="button" disabled={Boolean(savingId) || !changes[row.id] || changes[row.id] === row.status}
                              onClick={() => saveStatus(row)}>{savingId === row.id ? 'Saving…' : 'Save status'}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="owner-pagination">
                <button type="button" disabled={page <= 1 || Boolean(savingId)} onClick={() => changePage(page - 1)}>Previous</button>
                <span>Page {page} of {Math.max(1, Math.ceil(data.total / data.page_size))}</span>
                <button type="button" disabled={page * data.page_size >= data.total || Boolean(savingId)} onClick={() => changePage(page + 1)}>Next</button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}
