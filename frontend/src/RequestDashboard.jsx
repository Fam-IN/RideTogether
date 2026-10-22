import { useCallback, useEffect, useState } from 'react'
import './RequestDashboard.css'

const REQUESTS_URL = '/api/ride-requests/'

function getCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))

  return cookie
    ? decodeURIComponent(cookie.slice(name.length + 1))
    : ''
}

export default function RequestDashboard({ onDecision }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${REQUESTS_URL}?incoming=1`, {
        credentials: 'include',
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Please log in with the ride creator account to view requests.',
        )
      }

      if (!response.ok) {
        throw new Error(
          data.detail || `Could not load requests (${response.status}).`,
        )
      }

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
          ? data.results
          : []

      setRequests(items)
    } catch (err) {
      setError(err.message || 'Could not load ride requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function handleDecision(requestId, action) {
    setBusyId(requestId)
    setError('')
    setMessage('')

    try {
      const csrfResponse = await fetch('/api/csrf/', {
        credentials: 'include',
      })

      const csrfData = await csrfResponse.json().catch(() => ({}))

      if (!csrfResponse.ok) {
        throw new Error('Could not get the security token.')
      }

      const csrfToken =
        getCookie('csrftoken') || csrfData.csrfToken

      const response = await fetch(
        `${REQUESTS_URL}${requestId}/decision/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          body: JSON.stringify({ action }),
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const details = Object.entries(data)
          .map(([key, value]) => {
            const text = Array.isArray(value)
              ? value.join(', ')
              : String(value)

            return `${key}: ${text}`
          })
          .join(' | ')

        throw new Error(
          details || `Could not ${action} request (${response.status}).`,
        )
      }

setMessage(
  action === 'accept'
    ? 'Request accepted! Seat availability has been updated.'
    : 'Request rejected.',
)

if (typeof onDecision === 'function') {
  onDecision()
}

await loadRequests()
    } catch (err) {
      setError(err.message || 'Could not update this request.')
    } finally {
      setBusyId(null)
    }
  }

  const pendingRequests = requests.filter(
    (item) => item.status === 'PENDING',
  )

  return (
    <section className="request-dashboard" id="my-requests">
      <div className="request-dashboard-heading">
        <div>
          <span className="eyebrow">RIDE CREATOR TOOLS</span>
          <h2>Pending requests</h2>
          <p>Review passengers requesting a seat on your rides.</p>
        </div>

        <button
          type="button"
          className="request-refresh-button"
          onClick={loadRequests}
          disabled={loading}
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {message && (
        <p className="request-notice success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="request-notice error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="request-empty">Loading requests...</p>
      ) : !error && pendingRequests.length === 0 ? (
        <div className="request-empty">
          <span className="request-empty-icon">✉️</span>
          <h3>No pending requests</h3>
          <p>
            New passenger requests for your rides will appear here.
          </p>
        </div>
      ) : (
        <div className="request-list">
          {pendingRequests.map((item) => {
            const ride = item.ride_details || {}

            return (
              <article
                className="request-card"
                key={item.id}
              >
                <div className="request-card-heading">
                  <div>
                    <span className="request-status">
                      PENDING
                    </span>

                    <h3>
                      {item.requester_username || 'Passenger'}
                    </h3>
                  </div>

                  <span className="request-seat-count">
                    {item.seats_requested}{' '}
                    {item.seats_requested === 1 ? 'seat' : 'seats'}
                  </span>
                </div>

                <div className="request-route">
                  <p>
                    <span>FROM</span>
                    <strong>
                      {ride.pickup_location || 'Pickup not available'}
                    </strong>
                  </p>

                  <p>
                    <span>TO</span>
                    <strong>
                      {ride.destination || 'Destination not available'}
                    </strong>
                  </p>
                </div>

                <p className="request-ride-info">
                  Ride #{item.ride} ·{' '}
                  {ride.available_seats ?? '—'} seats currently available
                </p>

                <div className="request-actions">
                  <button
                    type="button"
                    className="request-accept-button"
                    onClick={() =>
                      handleDecision(item.id, 'accept')
                    }
                    disabled={busyId !== null}
                  >
                    {busyId === item.id
                      ? 'Processing...'
                      : '✓ Accept'}
                  </button>

                  <button
                    type="button"
                    className="request-reject-button"
                    onClick={() =>
                      handleDecision(item.id, 'reject')
                    }
                    disabled={busyId !== null}
                  >
                    Reject
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
