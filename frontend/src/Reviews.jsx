import { useCallback, useEffect, useState } from 'react'
import './Reviews.css'

const PROFILE_API = '/api/profile/'
const REQUESTS_API = '/api/ride-requests/'
const REVIEWS_API = '/api/reviews/'

function getCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : ''
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data.detail || Object.entries(data)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join(' · ')
    throw new Error(detail || `Request failed (${response.status}).`)
  }
  return data
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-BD', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function StarRating({ value, onChange, disabled = false }) {
  return (
    <div className="review-stars" role="radiogroup" aria-label="Rating from 1 to 5 stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className={star <= value ? 'review-star selected' : 'review-star'}
          onClick={() => onChange(star)}
          disabled={disabled}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function Reviews() {
  const [username, setUsername] = useState('')
  const [requests, setRequests] = useState([])
  const [reviews, setReviews] = useState([])
  const [ratings, setRatings] = useState({})
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profileResponse, requestsResponse, reviewsResponse] = await Promise.all([
        fetch(PROFILE_API, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(REQUESTS_API, { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch(`${REVIEWS_API}?mine=1`, { credentials: 'include', headers: { Accept: 'application/json' } }),
      ])
      const [profile, requestData, reviewData] = await Promise.all([
        readResponse(profileResponse), readResponse(requestsResponse), readResponse(reviewsResponse),
      ])
      setUsername(profile.username || '')
      setRequests(Array.isArray(requestData) ? requestData : requestData.results || [])
      setReviews(Array.isArray(reviewData) ? reviewData : reviewData.results || [])
    } catch (err) {
      setError(err.message || 'Could not load ratings and reviews.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const eligible = requests.flatMap((item) => {
    const ride = item.ride_details || {}
    if (item.status !== 'ACCEPTED' || !ride.departure_time || new Date(ride.departure_time).getTime() > Date.now()) return []

    let revieweeId
    let revieweeUsername
    if (ride.creator_username === username && item.requester_username !== username) {
      revieweeId = item.requester
      revieweeUsername = item.requester_username
    } else if (item.requester_username === username) {
      revieweeId = ride.creator
      revieweeUsername = ride.creator_username
    } else {
      return []
    }

    const alreadyReviewed = reviews.some((review) =>
      Number(review.ride) === Number(item.ride) &&
      review.reviewer_username === username &&
      Number(review.reviewee) === Number(revieweeId),
    )

    return [{
      key: `${item.ride}-${revieweeId}`,
      rideId: item.ride,
      revieweeId,
      revieweeUsername,
      route: `${ride.pickup_location || 'Unknown'} → ${ride.destination || 'Unknown'}`,
      departureTime: ride.departure_time,
      alreadyReviewed,
    }]
  })

  async function submitReview(item) {
    const rating = ratings[item.key] || 5
    const comment = (comments[item.key] || '').trim()
    setSavingKey(item.key)
    setError('')
    setMessage('')
    try {
      const csrfResponse = await fetch('/api/csrf/', { credentials: 'include' })
      const csrfData = await readResponse(csrfResponse)
      const csrfToken = getCookie('csrftoken') || csrfData.csrfToken || csrfData.csrf_token
      if (!csrfToken) throw new Error('Security token missing. Refresh and try again.')

      const response = await fetch(REVIEWS_API, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          Accept: 'application/json',
        },
        body: JSON.stringify({ ride: item.rideId, reviewee: item.revieweeId, rating, comment }),
      })
      await readResponse(response)
      setMessage(`Your review for ${item.revieweeUsername} was submitted.`)
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not submit the review.')
    } finally {
      setSavingKey('')
    }
  }

  if (loading) return <section className="reviews-page"><p>Loading ratings and reviews...</p></section>

  return (
    <section className="reviews-page">
      <div className="reviews-heading">
        <span className="eyebrow">TRAVEL WITH TRUST</span>
        <h1>Ratings &amp; Reviews</h1>
        <p>Share honest feedback after an accepted ride.</p>
      </div>

      {error && <p className="reviews-alert error" role="alert">{error}</p>}
      {message && <p className="reviews-alert success" role="status">{message}</p>}

      <div className="reviews-panel">
        <div className="reviews-panel-heading">
          <h2>Eligible rides</h2>
          <button type="button" onClick={loadData} disabled={loading}>Refresh</button>
        </div>
        <p className="reviews-note">You can review a ride participant after departure time has passed. Each person can be reviewed once per ride.</p>

        {eligible.length === 0 ? (
          <div className="reviews-empty">
            <h3>No reviews to write yet</h3>
            <p>Accepted rides become eligible after their departure time.</p>
          </div>
        ) : (
          <div className="reviews-list">
            {eligible.map((item) => (
              <article className="review-write-card" key={item.key}>
                <div className="review-route-line">
                  <div><span>ROUTE</span><strong>{item.route}</strong></div>
                  <div><span>DEPARTED</span><strong>{formatDate(item.departureTime)}</strong></div>
                </div>
                <h3>Review {item.revieweeUsername || 'ride participant'}</h3>
                {item.alreadyReviewed ? (
                  <p className="review-complete">✓ You have already reviewed this person for this ride.</p>
                ) : (
                  <>
                    <label className="review-field-label">Your rating</label>
                    <StarRating value={ratings[item.key] || 5} onChange={(value) => setRatings((old) => ({ ...old, [item.key]: value }))} disabled={savingKey === item.key} />
                    <label className="review-field-label" htmlFor={`comment-${item.key}`}>Comment (optional)</label>
                    <textarea
                      id={`comment-${item.key}`}
                      value={comments[item.key] || ''}
                      maxLength={1000}
                      rows={3}
                      placeholder="How was your ride experience?"
                      onChange={(event) => setComments((old) => ({ ...old, [item.key]: event.target.value }))}
                      disabled={savingKey === item.key}
                    />
                    <button type="button" className="review-submit" onClick={() => submitReview(item)} disabled={savingKey === item.key}>
                      {savingKey === item.key ? 'Submitting...' : 'Submit review'}
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="reviews-panel">
        <h2>Reviews about you and by you</h2>
        {reviews.length === 0 ? (
          <div className="reviews-empty"><p>No reviews yet.</p></div>
        ) : (
          <div className="reviews-list">
            {reviews.map((review) => (
              <article className="review-display-card" key={review.id}>
                <div className="review-display-top">
                  <strong>{review.reviewer_username} <span>→</span> {review.reviewee_username}</strong>
                  <span className="review-display-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                </div>
                {review.comment && <p>{review.comment}</p>}
                <small>{formatDate(review.created_at)}</small>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
