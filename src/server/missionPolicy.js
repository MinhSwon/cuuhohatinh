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

export function getUserTeamIds(teams, userId) {
  if (!userId || !Array.isArray(teams)) return new Set();

  return new Set(teams.filter(team => {
    const memberIds = Array.isArray(team.member_user_ids) ? team.member_user_ids : [];
    return team.leader_user_id === userId
      || team.leader_id === userId
      || team.user_id === userId
      || memberIds.includes(userId);
  }).map(team => team.id));
}

export function canUserAccessMission(teams, userId, mission) {
  return Boolean(mission?.rescue_team_id && getUserTeamIds(teams, userId).has(mission.rescue_team_id));
}

export function sanitizeMissionUpdate(extraData) {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) return {};

  return Object.fromEntries(
    Object.entries(extraData).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key))
  );
}
