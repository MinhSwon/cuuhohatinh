import { formatDistance, haversineDistance } from './haversine';

export const ACTIVE_RESCUE_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'MOVING',
  'NEAR_VICTIM',
  'ARRIVED_CONFIRMED',
  'RESCUING',
  'NEED_SUPPORT',
];

export const TERMINAL_RESCUE_STATUSES = [
  'RESCUED',
  'TRANSFERRED_SAFEZONE',
  'CANCELLED',
  'UNREACHABLE',
];

export function getRequestName(request) {
  return request?.victim_name || request?.full_name || 'Nguoi can cuu ho';
}

export function getRequestPhone(request) {
  return request?.victim_phone || request?.phone || '';
}

export function getRequestAreaName(request) {
  return request?.victim_area_name || request?.area_name || 'Chua xac dinh';
}

export function getRequestAddress(request) {
  return request?.victim_address_detail || request?.address_detail || '';
}

export function getRequestLatLng(request) {
  const lat = toNumber(request?.victim_latitude ?? request?.latitude);
  const lng = toNumber(request?.victim_longitude ?? request?.longitude);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

export function getMissionLatLng(mission) {
  const lat = toNumber(mission?.victim_latitude);
  const lng = toNumber(mission?.victim_longitude);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

export function findNearbyActiveMissions(request, missions = [], radiusMeters = 250) {
  const requestPos = getRequestLatLng(request);
  if (!requestPos) return [];

  return missions
    .filter(mission => ACTIVE_RESCUE_STATUSES.includes(mission.status))
    .map(mission => {
      const missionPos = getMissionLatLng(mission);
      if (!missionPos) return null;
      const distance = haversineDistance(requestPos.lat, requestPos.lng, missionPos.lat, missionPos.lng);
      return distance <= radiusMeters ? { mission, distance } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
}

export function getTeamActiveMissions(team, missions = []) {
  return missions.filter(mission =>
    mission.rescue_team_id === team?.id && ACTIVE_RESCUE_STATUSES.includes(mission.status)
  );
}

export function getTeamMaxActiveMissions(team) {
  const configured = Number.parseInt(team?.max_active_missions, 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return team?.status === 'BUSY' ? 1 : 2;
}

export function getTeamRecommendation(team, request, missions = []) {
  const activeMissions = getTeamActiveMissions(team, missions);
  const maxActive = getTeamMaxActiveMissions(team);
  const teamLat = toNumber(team?.latitude);
  const teamLng = toNumber(team?.longitude);
  const requestPos = getRequestLatLng(request);
  const distance = teamLat !== null && teamLng !== null && requestPos
    ? haversineDistance(teamLat, teamLng, requestPos.lat, requestPos.lng)
    : null;
  const overCapacity = activeMissions.length >= maxActive;
  const unavailable = ['OFFLINE', 'MAINTENANCE', 'INACTIVE'].includes(team?.status);
  const score =
    (unavailable ? -1000 : 0) +
    (overCapacity ? -250 : 0) +
    (distance === null ? 0 : Math.max(0, 200 - distance / 100)) +
    (team?.area_id && team.area_id === (request?.victim_area_id || request?.area_id) ? 45 : 0) +
    (Number(team?.member_count || team?.memberCount || 0) * 2);

  return {
    team,
    activeCount: activeMissions.length,
    maxActive,
    distance,
    distanceLabel: distance === null ? 'Chua co GPS doi/diem cuu' : formatDistance(distance),
    overCapacity,
    unavailable,
    score,
  };
}

export function getTeamRecommendations(teams = [], request, missions = []) {
  return teams
    .map(team => getTeamRecommendation(team, request, missions))
    .sort((a, b) => b.score - a.score);
}

export function getAssignmentWarnings(request, missions = [], teams = [], selectedTeamId = '') {
  const warnings = [];
  const nearby = findNearbyActiveMissions(request, missions);
  if (nearby.length > 0 || request?.nearby_active_mission_id) {
    const nearest = nearby[0];
    warnings.push({
      type: 'NEARBY_ACTIVE_MISSION',
      message: nearest
        ? `Da co ${nearest.mission.team_name || 'mot doi'} dang xu ly cach ${formatDistance(nearest.distance)}. Can gom cum hoac phan cong ho tro.`
        : `Da co ${request.nearby_active_team_name || 'mot doi'} dang den khu vuc nay. Can xac minh de tranh trung doi.`,
    });
  }

  if (!getRequestLatLng(request)) {
    warnings.push({
      type: 'NEEDS_LOCATION_VERIFICATION',
      message: 'Yeu cau chua co toa do GPS cua nguoi can cuu, can goi xac minh truoc khi doi xuat phat.',
    });
  }

  const selectedTeam = teams.find(team => team.id === selectedTeamId);
  if (selectedTeam) {
    const recommendation = getTeamRecommendation(selectedTeam, request, missions);
    if (recommendation.overCapacity) {
      warnings.push({
        type: 'TEAM_OVER_CAPACITY',
        message: `${selectedTeam.team_name || selectedTeam.name} da dat tai ${recommendation.activeCount}/${recommendation.maxActive} nhiem vu dang xu ly.`,
      });
    }
    if (recommendation.unavailable) {
      warnings.push({
        type: 'TEAM_UNAVAILABLE',
        message: `${selectedTeam.team_name || selectedTeam.name} khong o trang thai san sang.`,
      });
    }
  }

  return warnings;
}

export function getMissionStatusColor(status) {
  if (['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(status)) return '#16a34a';
  if (status === 'NEED_SUPPORT') return '#9333ea';
  if (['ASSIGNED', 'ACCEPTED', 'MOVING'].includes(status)) return '#2563eb';
  if (['NEAR_VICTIM', 'ARRIVED_CONFIRMED', 'RESCUING'].includes(status)) return '#f97316';
  if (['UNREACHABLE', 'CANCELLED'].includes(status)) return '#64748b';
  return '#dc2626';
}

export function isNeedsVerification(request) {
  return request?.verification_status === 'NEEDS_VERIFICATION' || !getRequestLatLng(request);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
