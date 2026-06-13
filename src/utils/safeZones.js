const TEST_SAFE_ZONE_NAME_PATTERN = /\b(test|fake|stress|demo|sample|dummy)\b/i;

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeSafeZone(zone) {
  const capacity = Math.max(0, Math.round(toFiniteNumber(zone?.capacity)));
  const currentPeople = Math.max(0, Math.round(toFiniteNumber(zone?.current_people)));

  return {
    ...zone,
    name: String(zone?.name || '').trim(),
    address: String(zone?.address || '').trim(),
    area_name: String(zone?.area_name || '').trim(),
    capacity,
    current_people: currentPeople,
    contact_phone: String(zone?.contact_phone || zone?.manager_phone || '').trim(),
    contact_person: String(zone?.contact_person || zone?.manager_name || '').trim(),
  };
}

export function isVerifiedPublicSafeZone(zone) {
  const safeZone = normalizeSafeZone(zone);
  return Boolean(
    safeZone.name &&
    safeZone.address &&
    safeZone.capacity > 0 &&
    !TEST_SAFE_ZONE_NAME_PATTERN.test(safeZone.name) &&
    safeZone.name.length > 1
  );
}

export function getPublicSafeZones(safeZones) {
  return (Array.isArray(safeZones) ? safeZones : [])
    .map(normalizeSafeZone)
    .filter(isVerifiedPublicSafeZone);
}

export function getSafeZoneOccupancy(zone) {
  const safeZone = normalizeSafeZone(zone);
  const hasCapacity = safeZone.capacity > 0;
  const percent = hasCapacity
    ? Math.min(100, Math.max(0, Math.round((safeZone.current_people / safeZone.capacity) * 100)))
    : 0;

  return {
    ...safeZone,
    hasCapacity,
    percent,
    availableSlots: hasCapacity ? Math.max(0, safeZone.capacity - safeZone.current_people) : null,
  };
}
