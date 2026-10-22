import { useCallback, useEffect, useState } from 'react'
import './MyRequests.css'

const API_URL = '/api/ride-requests/?mine=1'

function formatDeparture(value) {
  if (!value) return 'Not specified'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not specified'
  }

  return date.toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function MyRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Could not load requests (${response.status}).`,
        )
      }

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
          ? data.results
          : null

      if (!items) {
        throw new Error('Unexpected response from the requests API.')
      }

      setRequests(items)
    } catch (err) {
      setError(err.message || 'Could not load your requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  return (
    <section
      className="my-requests-section"
      id="my-bookings"
    >
      <div className="my-requests-heading">
        <div>
          <span className="my-requests-eyebrow">
            YOUR JOURNEY
          </span>

          <h2>My ride requests</h2>

          <p>
            Track the status of rides you have requested.
          </p>
        </div>

        <button
          type="button"
          className="my-requests-refresh"
          onClick={loadRequests}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="my-requests-error" role="alert">
          {error}
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="my-requests-empty">
          Loading your requests...
        </div>
      ) : !error && requests.length === 0 ? (
        <div className="my-requests-empty">
          <span className="my-requests-icon">🚗</span>
          <h3>No requests yet</h3>
          <p>
            Send a Connect Request on a ride to see it here.
          </p>
        </div>
      ) : (
        <div className="my-requests-list">
          {requests.map((item) => {
            const ride = item.ride_details || {}
            const currentStatus = String(
              item.status || 'PENDING',
            ).toUpperCase()

            const statusMessage = {
              PENDING:
                'Waiting for the ride creator to respond.',
              ACCEPTED:
                'Your request has been accepted.',
              REJECTED:
                'The ride creator rejected this request.',
              CANCELLED:
                'This request has been cancelled.',
            }

            return (
              <article
                className="my-request-card"
                key={item.id}
              >
                <div className="my-request-top">
                  <span className="my-request-id">
                    Request #{item.id}
                  </span>

                  <span
                    className={
                      'my-request-status ' +
                      currentStatus.toLowerCase()
                    }
                  >
                    {currentStatus}
                  </span>
                </div>

                <div className="my-request-route">
                  <div className="my-request-location">
                    <span className="my-request-label">
                      FROM
                    </span>

                    <strong>
                      {ride.pickup_location ||
                        'Pickup unavailable'}
                    </strong>
                  </div>

                  <span
                    className="my-request-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>

                  <div className="my-request-location">
                    <span className="my-request-label">
                      TO
                    </span>

                    <strong>
                      {ride.destination ||
                        'Destination unavailable'}
                    </strong>
                  </div>
                </div>

                <div className="my-request-details">
                  <div>
                    <span>Departure</span>
                    <strong>
                      {formatDeparture(ride.departure_time)}
                    </strong>
                  </div>

                  <div>
                    <span>Seats requested</span>
                    <strong>
                      {item.seats_requested ?? 1}
                    </strong>
                  </div>

                  <div>
                    <span>Ride creator</span>
                    <strong>
                      {ride.creator_username ||
                        'Not available'}
                    </strong>
                  </div>
                </div>

                <p className="my-request-message">
                  {statusMessage[currentStatus] ||
                    'Check the current status of your request.'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
