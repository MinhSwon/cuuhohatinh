export const MISSION_STATUSES = Object.freeze([
  'ASSIGNED',
  'ACCEPTED',
  'MOVING',
  'NEAR_VICTIM',
  'ARRIVED_CONFIRMED',
  'RESCUING',
  'RESCUED',
  'TRANSFERRED_SAFEZONE',
  'UNREACHABLE',
  'NEED_SUPPORT',
  'CANCELLED',
]);

const TRANSITIONS = Object.freeze({
  ASSIGNED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['MOVING', 'NEED_SUPPORT', 'UNREACHABLE', 'CANCELLED'],
  MOVING: ['NEAR_VICTIM', 'ARRIVED_CONFIRMED', 'NEED_SUPPORT', 'UNREACHABLE', 'CANCELLED'],
  NEAR_VICTIM: ['ARRIVED_CONFIRMED', 'NEED_SUPPORT', 'UNREACHABLE', 'CANCELLED'],
  ARRIVED_CONFIRMED: ['RESCUING', 'RESCUED', 'NEED_SUPPORT', 'UNREACHABLE', 'CANCELLED'],
  RESCUING: ['RESCUED', 'TRANSFERRED_SAFEZONE', 'NEED_SUPPORT', 'UNREACHABLE'],
  NEED_SUPPORT: ['MOVING', 'NEAR_VICTIM', 'ARRIVED_CONFIRMED', 'RESCUING', 'UNREACHABLE', 'CANCELLED'],
  RESCUED: ['TRANSFERRED_SAFEZONE'],
  TRANSFERRED_SAFEZONE: [],
  UNREACHABLE: [],
  CANCELLED: [],
});

const ALLOWED_UPDATE_FIELDS = new Set([
  'current_rescuer_latitude',
  'current_rescuer_longitude',
  'gps_saved_offline',
  'auto_arrival_detected',
  'auto_arrival_time',
  'auto_arrival_distance_meters',
  'completion_note',
  'completed_at',
]);

export function isValidMissionStatus(status) {
  return MISSION_STATUSES.includes(status);
}

export function canTransitionMission(oldStatus, newStatus) {
  if (!isValidMissionStatus(oldStatus) || !isValidMissionStatus(newStatus)) return false;
  // Repeating the status is reserved for GPS/metadata updates.
  return oldStatus === newStatus || TRANSITIONS[oldStatus].includes(newStatus);
}

function normalizeIdentityText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
}

export function getUserTeamIds(teams, userOrId) {
  const user = typeof userOrId === 'object' && userOrId !== null ? userOrId : { id: userOrId };
  if (!user.id || !Array.isArray(teams)) return new Set();

  const userPhone = normalizePhone(user.phone);
  const userName = normalizeIdentityText(user.full_name || user.fullName);

  return new Set(teams.filter(team => {
    const memberIds = Array.isArray(team.member_user_ids) ? team.member_user_ids : [];
    const idMatched = team.leader_user_id === user.id
      || team.leader_id === user.id
      || team.user_id === user.id
      || memberIds.includes(user.id);
    const legacyIdentityMatched = Boolean(
      userPhone
      && userName
      && normalizePhone(team.phone) === userPhone
      && normalizeIdentityText(team.leader_name) === userName
    );
    return idMatched || legacyIdentityMatched;
  }).map(team => team.id));
}

export function findUserRescueTeam(teams, user) {
  const teamIds = getUserTeamIds(teams, user);
  return Array.isArray(teams) ? teams.find(team => teamIds.has(team.id)) || null : null;
}

export function canUserAccessMission(teams, user, mission) {
  return Boolean(mission?.rescue_team_id && getUserTeamIds(teams, user).has(mission.rescue_team_id));
}

export function sanitizeMissionUpdate(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};

  return Object.fromEntries(
    Object.entries(extraData).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key))
  );
}
