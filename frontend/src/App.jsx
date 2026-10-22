
import { useEffect, useState } from 'react'
import './App.css'
import CreateRide from './CreateRide'
import MyRequests from './MyRequests'
import RequestDashboard from './RequestDashboard'
import Profile from './Profile'
import Reviews from './Reviews'

const API_URL = '/api/rides/'
const LOGIN_URL = 'http://localhost:8000/login/'
const REGISTER_URL = 'http://localhost:8000/register/'

function formatDate(value) {
  if (!value) return 'Time not specified'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Time not specified'
  }

  return date.toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function localDateKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function RideCard({ ride, onConnect, isLoggedIn }) {
  const availableSeats = Number(ride.available_seats ?? 0)
  const price = Number(ride.cost_per_seat ?? 0)

  const vehicleLabel = {
    CAR: '🚗 Car',
    CNG: '🛺 CNG',
    BIKE: '🏍️ Bike',
    OTHER: '🚐 Other',
  }[ride.vehicle_type] || '🚗 Car'

  return (
    <article className="ride-card">
      <div className="ride-card-top">
        <span className="vehicle-tag">{vehicleLabel}</span>

        {ride.female_only && (
          <span className="safety-tag">Women only</span>
        )}
      </div>

      <div className="route">
        <div className="route-point">
          <span className="route-dot pickup-dot" />
          <div>
            <small>FROM</small>
            <h3>{ride.pickup_location}</h3>
          </div>
        </div>

        <div className="route-line" />

        <div className="route-point">
          <span className="route-dot destination-dot" />
          <div>
            <small>TO</small>
            <h3>{ride.destination}</h3>
          </div>
        </div>
      </div>

      <div className="ride-details">
        <div>
          <small>DEPARTURE</small>
          <p>{formatDate(ride.departure_time)}</p>
        </div>

        <div>
          <small>SEATS AVAILABLE</small>
          <p>{availableSeats}</p>
        </div>
      </div>

      <div className="ride-card-footer">
        <div>
          <small>PRICE PER SEAT</small>
          <p className="price">
            ৳{price.toLocaleString('en-BD')}
          </p>
        </div>

        <span className="creator">
          By {ride.creator_username || 'Community member'}
        </span>
      </div>

      {isLoggedIn ? (
        <button
          type="button"
          className="create-ride-button connect-button"
          onClick={() => onConnect(ride.id)}
          disabled={availableSeats < 1}
        >
          {availableSeats > 0
            ? 'Connect request →'
            : 'No seats available'}
        </button>
      ) : (
        <a className="connect-login-link" href={LOGIN_URL}>
          Log in to connect →
        </a>
      )}
    </article>
  )
}

function App() {
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [vehicleType, setVehicleType] = useState('ALL')
  const [departureDate, setDepartureDate] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState({
    pickup: '',
    destination: '',
  })

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activePage, setActivePage] = useState('home')
  const [connectMessage, setConnectMessage] = useState('')
  const [connectSuccess, setConnectSuccess] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load rides from Django. This is the only rides-loading effect.
  useEffect(() => {
    const controller = new AbortController()

    async function loadRides() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(API_URL, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`)
        }

        const data = await response.json()

        let rideList

        if (Array.isArray(data)) {
          rideList = data
        } else if (Array.isArray(data.results)) {
          rideList = data.results
        } else {
          throw new Error('Unexpected rides API response format.')
        }

        if (!controller.signal.aborted) {
          setRides(rideList)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to load rides:', err)

          if (!controller.signal.aborted) {
            setError(
              'Could not load rides. Check the Django server and API connection.',
            )
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadRides()

    return () => controller.abort()
  }, [refreshKey])

  // Check whether the Django session is logged in.
  useEffect(() => {
    const controller = new AbortController()

    async function checkLogin() {
      try {
        const response = await fetch('/profile/', {
          method: 'GET',
          credentials: 'include',
          redirect: 'follow',
          signal: controller.signal,
        })

        const finalPath = new URL(response.url).pathname
        const redirectedToLogin =
          finalPath.includes('/login')

        if (!controller.signal.aborted) {
          setIsLoggedIn(response.ok && !redirectedToLogin)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Login session check failed:', err)

          if (!controller.signal.aborted) {
            setIsLoggedIn(false)
          }
        }
      }
    }

    checkLogin()

    return () => controller.abort()
  }, [])

  // Filter rides in the browser; changing filters does not refetch the API.
  const visibleRides = rides.filter((ride) => {
    const departureTimestamp = new Date(
      ride.departure_time,
    ).getTime()

    const availableSeats = Number(ride.available_seats ?? 0)
    const price = Number(ride.cost_per_seat ?? 0)

    const pickupSearch = search.pickup.trim().toLowerCase()
    const destinationSearch = search.destination.trim().toLowerCase()

    const ridePickup = String(
      ride.pickup_location ?? '',
    ).toLowerCase()

    const rideDestination = String(
      ride.destination ?? '',
    ).toLowerCase()

    const isFutureRide =
      Number.isFinite(departureTimestamp) &&
      departureTimestamp > Date.now()

    const hasSeats = availableSeats > 0
    const isOpen = !ride.status || ride.status === 'OPEN'

    const matchesPickup =
      !pickupSearch || ridePickup.includes(pickupSearch)

    const matchesDestination =
      !destinationSearch ||
      rideDestination.includes(destinationSearch)

    const matchesVehicle =
      vehicleType === 'ALL' ||
      ride.vehicle_type === vehicleType

    const matchesDate =
      !departureDate ||
      localDateKey(ride.departure_time) === departureDate

    const matchesPrice =
      maxPrice === '' ||
      (Number.isFinite(price) && price <= Number(maxPrice))

    return (
      isFutureRide &&
      hasSeats &&
      isOpen &&
      matchesPickup &&
      matchesDestination &&
      matchesVehicle &&
      matchesDate &&
      matchesPrice
    )
  })

  // Send a Connect Request with the Django CSRF token.
  async function handleConnect(rideId) {
    setConnectMessage('')
    setConnectSuccess(false)

    try {
      if (!isLoggedIn) {
        throw new Error('Please log in before requesting a ride.')
      }

      const csrfResponse = await fetch('/api/csrf/', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!csrfResponse.ok) {
        throw new Error(
          'Could not get the security token. Refresh the page and retry.',
        )
      }

      const csrfData = await csrfResponse.json()

      const csrfCookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith('csrftoken='))
        ?.split('=')
        .slice(1)
        .join('=')

      const csrfToken = csrfCookie
        ? decodeURIComponent(csrfCookie)
        : csrfData.csrfToken || csrfData.csrf_token

      if (!csrfToken) {
        throw new Error(
          'CSRF token is missing. Refresh the page and retry.',
        )
      }

      const response = await fetch('/api/ride-requests/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          ride: rideId,
          seats_requested: 1,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 401 || response.status === 403) {
        setIsLoggedIn(false)

        const detail =
          data.detail ||
          data.non_field_errors?.join?.(' ') ||
          'Login or permission problem. Please log in again.'

        throw new Error(detail)
      }

      if (!response.ok) {
        const detail = Object.entries(data)
          .map(([key, value]) => {
            const message = Array.isArray(value)
              ? value.join(', ')
              : typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value)

            return `${key}: ${message}`
          })
          .join(' · ')

        throw new Error(
          detail || `Could not send request (${response.status}).`,
        )
      }

      setConnectSuccess(true)
      setConnectMessage(
        'Request sent successfully! Waiting for the ride creator.',
      )

      // Refresh the available rides after a successful request.
      setRefreshKey((key) => key + 1)
    } catch (err) {
      setConnectSuccess(false)
      setConnectMessage(err.message || 'Something went wrong.')
    }
  }

  function handleSearch(event) {
    event.preventDefault()

    setSearch({
      pickup,
      destination,
    })
  }
  
function handleQuickRoute(from, to) {
  setPickup(from)
  setDestination(to)

  setSearch({
    pickup: from,
    destination: to,
  })

  document.getElementById('find-rides')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}


  function clearSearch() {
    setPickup('')
    setDestination('')
    setVehicleType('ALL')
    setDepartureDate('')
    setMaxPrice('')

    setSearch({
      pickup: '',
      destination: '',
    })
  }

  function handleRideCreated() {
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="/">
          <span className="brand-icon">R</span>
          RideTogether
        </a>

        <nav className="nav-links">
          <a href="#home" onClick={(event) => { event.preventDefault(); setActivePage('home') }}>Home</a>
          <a href="#find-rides" onClick={() => setActivePage('home')}>Find a ride</a>
          <a href="#create-ride" onClick={() => setActivePage('home')}>Offer a ride</a>
          {isLoggedIn && (
            <>
              <a href="#my-profile" onClick={(event) => { event.preventDefault(); setActivePage('profile') }}>My Profile</a>
              <a href="#my-ride-history" onClick={(event) => { event.preventDefault(); setActivePage('history') }}>My Ride History</a>
              <a href="#ratings-reviews" onClick={(event) => { event.preventDefault(); setActivePage('reviews') }}>Ratings &amp; Reviews</a>
            </>
          )}
          {!isLoggedIn && <a href={REGISTER_URL}>Sign up</a>}
          <a className="nav-login" href={LOGIN_URL}>
            {isLoggedIn ? 'Account' : 'Log in'}
          </a>
        </nav>
      </header>

      <main>
        {activePage === 'home' ? (
          <>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">YOUR JOURNEY, SHARED</span>

            <h1>
              Better journeys.
              <br />
              <span>Better together.</span>
            </h1>

            <p>
              Find people travelling your way, share the cost,
              and make every journey count.
            </p>

            <a className="hero-link" href="#find-rides">
              Explore available rides <span>↓</span>
            </a>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="sun" />
            <div className="hill hill-back" />
            <div className="hill hill-front" />

            <div className="floating-card">
              <span className="floating-icon">✦</span>
              <div>
                <strong>Go together</strong>
                <small>Share the ride, share the cost.</small>
              </div>
            </div>

            <div className="road">
              <div className="road-line" />
              <div className="car-illustration">🚙</div>
            </div>
          </div>

          <div className="hero-bottom">
            <span>✳ Community-powered travel</span>
            <span>✳ More affordable journeys</span>
            <span>✳ Travel together</span>
          </div>
        </section>
        
{/* INTERACTIVE HOME SHORTCUTS */}
<section className="rt-home-upgrade">
  <div className="rt-home-upgrade__panel">
    <div className="rt-home-upgrade__copy">
      <span className="eyebrow">START WITH A ROUTE</span>

      <h2>One small plan. A better journey.</h2>

      <p>
        Choose a suggested route to fill in the search instantly,
        or enter your own pickup and destination below.
      </p>

      <div className="rt-home-upgrade__routes">
        <button
          type="button"
          className="rt-route-chip"
          onClick={() =>
            handleQuickRoute('Savar', 'Motijheel')
          }
        >
          <strong>Savar → Motijheel</strong>
          <span>Use this route ↗</span>
        </button>

        <button
          type="button"
          className="rt-route-chip"
          onClick={() =>
            handleQuickRoute('Uttara', 'Dhanmondi')
          }
        >
          <strong>Uttara → Dhanmondi</strong>
          <span>Use this route ↗</span>
        </button>

        <button
          type="button"
          className="rt-route-chip"
          onClick={() =>
            handleQuickRoute('Mirpur', 'Gulshan')
          }
        >
          <strong>Mirpur → Gulshan</strong>
          <span>Use this route ↗</span>
        </button>
      </div>
    </div>

    <aside className="rt-home-upgrade__side">
      <div>
        <small>AVAILABLE RIGHT NOW</small>

        <div className="rt-home-upgrade__count">
          {loading ? '…' : visibleRides.length}
        </div>

        <p>
          {loading
            ? 'Checking current rides…'
            : 'rides match your current filters.'}
        </p>
      </div>

      <div>
        <p>
          Ready to travel—or help someone else get there?
        </p>

        <div className="rt-home-upgrade__actions">
          <a href="#find-rides">Find a ride ↓</a>
          <a
            className="rt-secondary"
            href="#create-ride"
          >
            Offer a ride ↗
          </a>
        </div>
      </div>
    </aside>
  </div>
</section>
        {/* SEARCH AND FILTERS */}
        <section className="search-section" id="find-rides">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LET'S GET MOVING</span>
              <h2>Where are you headed?</h2>
              <p>Find a ride that matches your route.</p>
            </div>

            <span className="heading-decoration">↗</span>
          </div>

          <form className="search-form" onSubmit={handleSearch}>
            <label className="search-field">
              <span className="field-icon pickup-icon">●</span>

              <span className="field-content">
                <span>Pickup location</span>
                <input
                  value={pickup}
                  onChange={(event) => setPickup(event.target.value)}
                  placeholder="Where from?"
                />
              </span>
            </label>

            <div className="search-divider" />

            <label className="search-field">
              <span className="field-icon destination-icon">●</span>

              <span className="field-content">
                <span>Destination</span>
                <input
                  value={destination}
                  onChange={(event) =>
                    setDestination(event.target.value)
                  }
                  placeholder="Where to?"
                />
              </span>
            </label>

            <button className="search-button" type="submit">
              <span>⌕</span> Find rides
            </button>
          </form>

          <div className="ride-filter-row">
            <label className="ride-filter-field">
              <span>Vehicle type</span>
              <select
                value={vehicleType}
                onChange={(event) =>
                  setVehicleType(event.target.value)
                }
              >
                <option value="ALL">All vehicles</option>
                <option value="CAR">Car</option>
                <option value="CNG">CNG</option>
                <option value="BIKE">Bike</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <label className="ride-filter-field">
              <span>Departure date</span>
              <input
                type="date"
                min={localDateKey(new Date())}
                value={departureDate}
                onChange={(event) =>
                  setDepartureDate(event.target.value)
                }
              />
            </label>

            <label className="ride-filter-field">
              <span>Maximum price per seat (৳)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Any price"
                value={maxPrice}
                onChange={(event) =>
                  setMaxPrice(event.target.value)
                }
              />
            </label>
          </div>

          {(
            search.pickup ||
            search.destination ||
            vehicleType !== 'ALL' ||
            departureDate ||
            maxPrice !== ''
          ) && (
            <button
              type="button"
              className="clear-button"
              onClick={clearSearch}
            >
              Clear search ×
            </button>
          )}
        </section>

        {/* CREATE RIDE */}
        <CreateRide onCreated={handleRideCreated} />

        {/* PASSENGER REQUESTS */}
        <MyRequests />

        {/* RIDE CREATOR DASHBOARD */}
        <RequestDashboard onDecision={handleRideCreated} />

        {/* AVAILABLE RIDES */}
        <section className="rides-section">
          <div className="rides-heading">
            <div>
              <span className="eyebrow">YOUR NEXT ADVENTURE</span>
              <h2>Available rides</h2>
            </div>

            {!loading && !error && (
              <span className="ride-count">
                {visibleRides.length}{' '}
                {visibleRides.length === 1 ? 'ride' : 'rides'}
              </span>
            )}

            <button
              type="button"
              className="outline-button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
            >
              {loading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>

          {/* CONNECT FEEDBACK */}
          {connectMessage && (
            <p
              className={`form-message ${
                connectSuccess ? 'success' : 'error'
              }`}
              role="status"
            >
              {connectMessage}
            </p>
          )}

          {loading && (
            <div className="state-message">
              <div className="spinner" />
              <p>Finding rides for you...</p>
            </div>
          )}

          {error && (
            <div className="state-message error-message">
              <p>{error}</p>

              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && visibleRides.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🚗</div>
              <h3>No matching rides found</h3>

              <p>
                Try changing your route or filters. Only future rides
                with available seats are shown.
              </p>

              {(
                search.pickup ||
                search.destination ||
                vehicleType !== 'ALL' ||
                departureDate ||
                maxPrice !== ''
              ) && (
                <button
                  type="button"
                  className="outline-button"
                  onClick={clearSearch}
                >
                  Show all rides
                </button>
              )}
            </div>
          )}

          {!loading && !error && visibleRides.length > 0 && (
            <div className="ride-grid">
              {visibleRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onConnect={handleConnect}
                  isLoggedIn={isLoggedIn}
                />
              ))}
            </div>
          )}
        </section>

        {/* COMMUNITY BANNER */}
        <section className="community-banner">
          <div>
            <span className="eyebrow">TRAVEL IS BETTER TOGETHER</span>
            <h2>Your seat in a better journey awaits.</h2>

            <p>
              Create an account and become part of the community.
            </p>
          </div>

          <a className="banner-button" href={REGISTER_URL}>
            Join RideTogether ↗
          </a>
        </section>
          </>
        ) : activePage === 'profile' ? (
          <Profile view="profile" />
        ) : activePage === 'history' ? (
          <Profile view="history" />
        ) : (
          <Reviews />
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <a className="brand footer-brand" href="/">
          <span className="brand-icon">R</span>
          RideTogether
        </a>

        <span>Share the journey. Share the joy.</span>
        <span>© {new Date().getFullYear()} RideTogether</span>
      </footer>
    </div>
  )
}

export default App
