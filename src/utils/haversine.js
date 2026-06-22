// Haversine formula to calculate distance between two GPS coordinates
// Returns distance in meters

export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0, R * c);
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Check if a point is within a geofence radius
export function isInsideGeofence(rescuerLat, rescuerLon, victimLat, victimLon, radiusMeters) {
  const distance = haversineDistance(rescuerLat, rescuerLon, victimLat, victimLon);
  return { isInside: distance <= radiusMeters, distance };
}

// Format distance for display
export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return 'Chưa có GPS đội/điểm cứu';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
