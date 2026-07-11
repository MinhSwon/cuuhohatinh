import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canTransitionMission,
  canUserAccessMission,
  findUserRescueTeam,
  getUserTeamIds,
  sanitizeMissionUpdate,
} from '../src/server/missionPolicy.js';

test('mission workflow accepts only known forward and operational transitions', () => {
  assert.equal(canTransitionMission('ASSIGNED', 'ACCEPTED'), true);
  assert.equal(canTransitionMission('MOVING', 'NEED_SUPPORT'), true);
  assert.equal(canTransitionMission('RESCUING', 'RESCUED'), true);
  assert.equal(canTransitionMission('RESCUED', 'ASSIGNED'), false);
  assert.equal(canTransitionMission('ASSIGNED', 'RESCUED'), false);
  assert.equal(canTransitionMission('ASSIGNED', 'MADE_UP'), false);
});

test('same-status GPS updates remain valid', () => {
  assert.equal(canTransitionMission('MOVING', 'MOVING'), true);
});

test('rescue users can access only missions assigned to their own teams', () => {
  const teams = [
    { id: 'team-a', leader_user_id: 'leader-a' },
    { id: 'team-b', member_user_ids: ['member-b'] },
  ];

  assert.deepEqual([...getUserTeamIds(teams, 'leader-a')], ['team-a']);
  assert.equal(canUserAccessMission(teams, 'leader-a', { rescue_team_id: 'team-a' }), true);
  assert.equal(canUserAccessMission(teams, 'leader-a', { rescue_team_id: 'team-b' }), false);
  assert.equal(canUserAccessMission(teams, 'unassigned', { rescue_team_id: 'team-a' }), false);
});

test('legacy deployed teams can be recovered by matching leader name and phone', () => {
  const teams = [{
    id: 'team-legacy',
    leader_name: 'Trần Văn Hùng',
    phone: '0923456789',
  }];
  const user = {
    id: 'user-rescue-1',
    full_name: 'Trần Văn Hùng',
    phone: '+84 923 456 789',
  };

  assert.deepEqual([...getUserTeamIds(teams, user)], ['team-legacy']);
  assert.equal(findUserRescueTeam(teams, user)?.id, 'team-legacy');
  assert.equal(canUserAccessMission(teams, user, { rescue_team_id: 'team-legacy' }), true);
});

test('mission metadata update discards fields outside the server allowlist', () => {
  assert.deepEqual(sanitizeMissionUpdate({
    current_rescuer_latitude: 18.2,
    completion_note: 'Đã bàn giao nạn nhân',
    rescue_team_id: 'attacker-team',
    status: 'RESCUED',
    arbitrary: true,
  }), {
    current_rescuer_latitude: 18.2,
    completion_note: 'Đã bàn giao nạn nhân',
  });
});
