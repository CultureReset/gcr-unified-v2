import { API_BASE } from '../config'

// Location tracking service
// Handles background location updates and geofence detection

let locationWatcher = null
let lastLocation = null

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8 // miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Request location permission
export async function requestLocationPermission() {
  try {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported')
      return false
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location permission granted')
          resolve(true)
        },
        (error) => {
          console.error('Location permission denied:', error.message)
          resolve(false)
        }
      )
    })
  } catch (e) {
    console.error('Error requesting location:', e)
    return false
  }
}

// Start tracking location in background
export function startLocationTracking(token) {
  if (locationWatcher) return // Already tracking

  if (!navigator.geolocation) {
    console.error('Geolocation not supported')
    return
  }

  console.log('Starting location tracking...')

  // Request location every 30 seconds
  locationWatcher = setInterval(async () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        lastLocation = { latitude, longitude, accuracy }

        // Send location to server
        try {
          const response = await fetch(`${API_BASE}/api/tourist/location`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              lat: latitude,
              lng: longitude,
              accuracy_meters: accuracy
            })
          })

          if (response.ok) {
            const data = await response.json()
            if (data.new_triggers && data.new_triggers.length > 0) {
              // Geofence triggered! (will handle SMS in next phase)
              console.log('Geofence triggered:', data.new_triggers)
            }
          }
        } catch (e) {
          console.error('Error sending location:', e)
        }
      },
      (error) => {
        console.error('Error getting location:', error.message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }, 30000) // Every 30 seconds
}

// Stop location tracking
export function stopLocationTracking() {
  if (locationWatcher) {
    clearInterval(locationWatcher)
    locationWatcher = null
    console.log('Location tracking stopped')
  }
}

// Get last known location
export function getLastLocation() {
  return lastLocation
}

// Enable location sharing (update settings)
export async function enableLocationSharing(token, settings = {}) {
  try {
    const response = await fetch(`${API_BASE}/api/tourist/location-settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_sharing_enabled: true,
        geofence_radius_miles: settings.geofence_radius_miles || 1.0,
        sms_frequency: settings.sms_frequency || 'once_per_day',
        sms_categories: settings.sms_categories || ['food', 'nightlife', 'activities', 'stay']
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('Location sharing enabled:', data)
      return data
    } else {
      console.error('Failed to enable location sharing')
      return null
    }
  } catch (e) {
    console.error('Error enabling location sharing:', e)
    return null
  }
}

// Disable location sharing
export async function disableLocationSharing(token) {
  try {
    stopLocationTracking()

    const response = await fetch(`${API_BASE}/api/tourist/location-settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_sharing_enabled: false
      })
    })

    if (response.ok) {
      console.log('Location sharing disabled')
      return true
    }
    return false
  } catch (e) {
    console.error('Error disabling location sharing:', e)
    return false
  }
}
