// Compass + geo-bearing helpers for the AR camera overlay.
// This is plain math, not React-specific, so it lives alongside locationService.js.

// Initial bearing (degrees, 0 = North, clockwise) from point 1 to point 2.
export function bearingTo(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Angle of `targetBearing` relative to the device's current compass `heading`,
// normalized to -180..180. 0 = target is straight ahead, negative = target is
// to the left, positive = to the right.
export function relativeBearing(heading, targetBearing) {
  return (((targetBearing - heading + 540) % 360) + 360) % 360 - 180
}

// Extracts a true compass heading (0 = North, clockwise) from a
// deviceorientation(absolute) event. iOS Safari exposes webkitCompassHeading
// directly (already tilt-compensated, doesn't need `absolute`); other
// browsers only give tilt-compensated absolute heading via `alpha` on an
// *absolute* event, which counts counter-clockwise from the device's
// original reference frame, so it needs inverting to become a compass
// heading. Returns null if the event doesn't carry usable heading data.
export function headingFromOrientationEvent(event) {
  if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
    return event.webkitCompassHeading
  }
  if (event.absolute && event.alpha != null) {
    return (360 - event.alpha) % 360
  }
  return null
}
