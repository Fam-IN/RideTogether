
import { useState } from 'react'
import './CreateRide.css'

const initialForm = {
  pickup_location: '',
  destination: '',
  departure_time: '',
  vehicle_type: 'CAR',
  total_seats: '3',
  cost_per_seat: '0',
  female_only: false,
}

// Format a Date as local YYYY-MM-DDTHH:mm.
// Do not use toISOString() for the input's min/value.
function toLocalDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0')

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  )
}

function getCookie(name) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))

  return cookie
    ? decodeURIComponent(cookie.slice(name.length + 1))
    : ''
}

export default function CreateRide({ onCreated }) {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Recalculate the minimum whenever the component renders.
  const minDeparture = toLocalDateTime(new Date())

  function handleChange(event) {
    const { name, value, checked, type } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    if (submitting) return

    if (
      !form.pickup_location.trim() ||
      !form.destination.trim() ||
      !form.departure_time
    ) {
      setMessage('Please complete all required fields.')
      return
    }

    // datetime-local represents local wall-clock time.
    const departure = new Date(form.departure_time)

    if (Number.isNaN(departure.getTime())) {
      setMessage('Please select a valid departure date and time.')
      return
    }

    if (departure.getTime() <= Date.now()) {
      setMessage('Departure must be a future date and time.')
      return
    }

    const seats = Number(form.total_seats)
    const cost = Number(form.cost_per_seat)

    if (!Number.isInteger(seats) || seats < 1 || seats > 99) {
      setMessage('Total seats must be between 1 and 99.')
      return
    }

    if (!Number.isFinite(cost) || cost < 0) {
      setMessage('Cost per seat must be zero or greater.')
      return
    }

    setSubmitting(true)

    try {
      const csrfResponse = await fetch('/api/csrf/', {
        credentials: 'include',
      })

      if (!csrfResponse.ok) {
        throw new Error('Could not get the security token. Refresh and retry.')
      }

      const csrfData = await csrfResponse.json()
      const csrfToken = getCookie('csrftoken') || csrfData.csrfToken

      if (!csrfToken) {
        throw new Error('CSRF token is missing. Please refresh the page.')
      }

      const response = await fetch('/api/rides/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          pickup_location: form.pickup_location.trim(),
          destination: form.destination.trim(),
          departure_time: departure.toISOString(),
          vehicle_type: form.vehicle_type,
          total_seats: seats,
          cost_per_seat: cost.toFixed(2),
          female_only: form.female_only,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const details = Object.entries(data)
          .map(([key, value]) => {
            const detail = Array.isArray(value)
              ? value.join(', ')
              : typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value)

            return `${key}: ${detail}`
          })
          .join(' | ')

        throw new Error(
          details || `Could not publish ride (${response.status}).`,
        )
      }

      setForm(initialForm)
      setMessage('Ride posted successfully!')
      onCreated?.()
    } catch (error) {
      setMessage(error.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="create-ride-section" id="create-ride">
      <div className="create-ride-heading">
        <span className="eyebrow">YOUR JOURNEY STARTS HERE</span>
        <h2>Offer a ride</h2>
        <p>Share your route with other travellers.</p>
      </div>

      <form className="create-ride-form" onSubmit={handleSubmit}>
        <label>
          Pickup location
          <input
            name="pickup_location"
            value={form.pickup_location}
            onChange={handleChange}
            placeholder="e.g. Dhanmondi, Dhaka"
            required
          />
        </label>

        <label>
          Destination
          <input
            name="destination"
            value={form.destination}
            onChange={handleChange}
            placeholder="e.g. Uttara, Dhaka"
            required
          />
        </label>

        <label>
          Departure date and time
          <input
            type="datetime-local"
            name="departure_time"
            value={form.departure_time}
            min={minDeparture}
            onChange={handleChange}
            required
          />
        </label>

        <div className="form-row">
          <label>
            Vehicle
            <select
              name="vehicle_type"
              value={form.vehicle_type}
              onChange={handleChange}
            >
              <option value="CAR">Car</option>
              <option value="CNG">CNG</option>
              <option value="BIKE">Bike</option>
              <option value="RICKSHAW">Other</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label>
            Total seats
            <input
              type="number"
              name="total_seats"
              min="1"
              max="99"
              step="1"
              value={form.total_seats}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Cost per seat (৳)
            <input
              type="number"
              name="cost_per_seat"
              min="0"
              step="10"
              value={form.cost_per_seat}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            name="female_only"
            checked={form.female_only}
            onChange={handleChange}
          />
          Women-only ride
        </label>

        {message && (
          <p
            className="form-message"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          className="create-ride-button"
          disabled={submitting}
        >
          {submitting ? 'Posting...' : 'Publish ride →'}
        </button>
      </form>
    </section>
  )
}
