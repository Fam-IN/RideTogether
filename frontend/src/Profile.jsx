import { useCallback, useEffect, useState } from 'react'
import './Profile.css'
import './Profile_Photo.css'

const PROFILE_API = '/api/profile/'
const HISTORY_API = '/api/ride-requests/?mine=1'

function getCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))

  return cookie
    ? decodeURIComponent(cookie.slice(name.length + 1))
    : ''
}

function formatDate(value) {
  if (!value) return 'Not available'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function readableStatus(status) {
  const labels = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  }

  return labels[status] || status || 'Unknown'
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail =
      data.detail ||
      Object.entries(data)
        .map(([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(', ') : value}`,
        )
        .join(' · ')

    throw new Error(
      detail || `Request failed (${response.status}).`,
    )
  }

  return data
}

export default function Profile({ view = 'all' }) {
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [gender, setGender] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [profileResponse, historyResponse] = await Promise.all([
        fetch(PROFILE_API, {
          credentials: 'include',
        }),
        fetch(HISTORY_API, {
          credentials: 'include',
        }),
      ])

      const profileData = await readResponse(profileResponse)
      const historyData = await readResponse(historyResponse)

      const history = Array.isArray(historyData)
        ? historyData
        : Array.isArray(historyData.results)
          ? historyData.results
          : null

      if (!history) {
        throw new Error('Unexpected ride history response format.')
      }

      setProfile(profileData)
      setPhoneNumber(profileData.phone_number || '')
      setSelectedPhoto(null)
      setPhotoPreview('')
      setGender(profileData.gender || '')
      setRequests(history)
    } catch (err) {
      setError(
        err.message || 'Could not load your profile and ride history.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const csrfResponse = await fetch('/api/csrf/', {
        credentials: 'include',
      })

      const csrfData = await readResponse(csrfResponse)
      const csrfToken = getCookie('csrftoken') || csrfData.csrfToken

      if (!csrfToken) {
        throw new Error('Security token missing. Refresh and try again.')
      }

      const response = await fetch(PROFILE_API, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          gender,
        }),
      })

      const data = await readResponse(response)

      setProfile(data)
      setPhoneNumber(data.phone_number || '')
      setGender(data.gender || '')
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(err.message || 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }


  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(selectedPhoto)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedPhoto])

  function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photos must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setError('')
    setMessage('')
    setSelectedPhoto(file)
  }

  async function handlePhotoUpload() {
    if (!selectedPhoto) {
      setError('Choose a photo first.')
      return
    }

    setUploadingPhoto(true)
    setError('')
    setMessage('')

    try {
      const csrfResponse = await fetch('/api/csrf/', { credentials: 'include' })
      const csrfData = await readResponse(csrfResponse)
      const csrfToken = getCookie('csrftoken') || csrfData.csrfToken || csrfData.csrf_token
      if (!csrfToken) throw new Error('Security token missing. Refresh and try again.')

      const formData = new FormData()
      formData.append('profile_image', selectedPhoto)

      const response = await fetch(PROFILE_API, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrfToken },
        body: formData,
      })

      const data = await readResponse(response)
      setProfile(data)
      setSelectedPhoto(null)
      setPhotoPreview('')
      setMessage('Profile photo updated successfully.')
    } catch (err) {
      setError(err.message || 'Could not upload your profile photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (loading) {
    return (
      <section className="profile-section">
        <p>Loading your profile...</p>
      </section>
    )
  }

  if (error && !profile) {
    return (
      <section className="profile-section">
        <h2>My Profile</h2>
        <p className="profile-error" role="alert">{error}</p>
        <button type="button" onClick={loadData}>
          Try again
        </button>
      </section>
    )
  }

  const acceptedCount = requests.filter(
    (item) => item.status === 'ACCEPTED',
  ).length

  return (
    <section className="profile-section" id="my-profile">
      {error && (
        <p className="profile-error" role="alert">{error}</p>
      )}

      {message && (
        <p className="profile-success" role="status">{message}</p>
      )}

      {view !== 'history' && (
        <>
      <div className="profile-heading">
        <span className="eyebrow">YOUR RIDETOGETHER ACCOUNT</span>
        <h2>My Profile</h2>
        <p>Manage your details and keep track of your journeys.</p>
      </div>

      <div className="profile-summary">
        <div className="profile-photo-area">
          <div className="profile-avatar">
            {(photoPreview || profile?.profile_image) ? (
              <img
                src={photoPreview || profile.profile_image}
                alt={`${profile?.username || 'User'} profile`}
                className="profile-avatar-image"
              />
            ) : (
              <span>{(profile?.username || 'U').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <label className="profile-photo-picker">
            Choose photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              aria-label="Choose profile photo from your device"
            />
          </label>
          <small>JPG, PNG or WebP · max 5 MB</small>
          {selectedPhoto && (
            <button
              type="button"
              className="profile-save-button"
              onClick={handlePhotoUpload}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? 'Uploading photo...' : 'Save photo'}
            </button>
          )}
        </div>

        <div className="profile-identity">
          <h3>{profile?.username || 'User'}</h3>
          <p>{profile?.email || 'No email provided'}</p>
          <span className="profile-trust">
            Trust score: {profile?.trust_score ?? 0}
          </span>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSave}>
        <label>
          Username
          <input
            value={profile?.username || ''}
            readOnly
          />
        </label>

        <label>
          Email
          <input
            value={profile?.email || ''}
            readOnly
          />
        </label>

        <label>
          Phone number
          <input
            type="tel"
            maxLength={20}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Enter your phone number"
          />
        </label>

        <label>
          Gender
          <select
            value={gender}
            onChange={(event) => setGender(event.target.value)}
          >
            <option value="">Choose an option</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="UNDISCLOSED">Prefer not to say</option>
          </select>
        </label>

        <div className="profile-readonly">
          <span>Phone verification</span>
          <strong>
            {profile?.is_phone_verified ? 'Verified' : 'Not verified'}
          </strong>
          <span>
            Saving your profile does not verify your phone number.
          </span>
        </div>

        <button
          type="submit"
          className="profile-save-button"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
        </>
      )}

      {view !== 'profile' && (
        <>
      <div className="history-heading">
        <div>
          <span className="eyebrow">YOUR JOURNEYS</span>
          <h2>My Ride History</h2>
        </div>

        <button
          type="button"
          className="profile-refresh-button"
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="history-stats">
        <div>
          <strong>{requests.length}</strong>
          <span>Total requests</span>
        </div>
        <div>
          <strong>{acceptedCount}</strong>
          <span>Accepted</span>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="profile-empty">
          <h3>No ride requests yet</h3>
          <p>When you connect with a ride, your request will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {requests.map((item) => {
            const ride = item.ride_details || {}

            return (
              <article className="history-card" key={item.id}>
                <div className="history-card-top">
                  <span className="history-vehicle">
                    {ride.vehicle_type === 'BIKE'
                      ? '🏍️ Bike'
                      : ride.vehicle_type === 'CNG'
                        ? '🛺 CNG'
                        : ride.vehicle_type === 'OTHER'
                          ? '🚐 Other'
                          : '🚗 Car'}
                  </span>

                  <span
                    className={`history-status status-${String(
                      item.status || '',
                    ).toLowerCase()}`}
                  >
                    {readableStatus(item.status)}
                  </span>
                </div>

                <div className="history-route">
                  <div>
                    <span>FROM</span>
                    <strong>{ride.pickup_location || 'Unknown'}</strong>
                  </div>

                  <span className="history-arrow" aria-hidden="true">
                    →
                  </span>

                  <div>
                    <span>TO</span>
                    <strong>{ride.destination || 'Unknown'}</strong>
                  </div>
                </div>

                <div className="history-details">
                  <p>
                    <span>Departure</span>
                    <strong>{formatDate(ride.departure_time)}</strong>
                  </p>
                  <p>
                    <span>Seats requested</span>
                    <strong>{item.seats_requested ?? 1}</strong>
                  </p>
                  <p>
                    <span>Price per seat</span>
                    <strong>
                      ৳{Number(ride.cost_per_seat || 0).toLocaleString('en-BD')}
                    </strong>
                  </p>
                  <p>
                    <span>Ride creator</span>
                    <strong>{ride.creator_username || 'Community member'}</strong>
                  </p>
                </div>

                <p className="history-created">
                  Requested on {formatDate(item.created_at)}
                </p>
              </article>
            )
          })}
        </div>
      )}
        </>
      )}
    </section>
  )
}
