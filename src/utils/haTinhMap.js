export const HA_TINH_MAP_CENTER = [18.35, 105.9];

// Approximate administrative bounds for Ha Tinh province.
// Leaflet uses [[south, west], [north, east]].
export const HA_TINH_MAP_BOUNDS = [
  [17.85, 105.05],
  [18.85, 106.55],
];

export function hasValidLatLng(lat, lng) {
  return typeof lat === 'number'
    && typeof lng === 'number'
    && Number.isFinite(lat)
    && Number.isFinite(lng);
}

export function isInHaTinhBounds(lat, lng) {
  if (!hasValidLatLng(lat, lng)) return false;
  const [[south, west], [north, east]] = HA_TINH_MAP_BOUNDS;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

export function getHaTinhMapCenter(lat, lng) {
  return isInHaTinhBounds(lat, lng) ? [lat, lng] : HA_TINH_MAP_CENTER;
}
