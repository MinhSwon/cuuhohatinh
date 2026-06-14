import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { AREAS } from '../data/publicData';

const DataContext = createContext(null);
const shouldUseOfflineFallback = (err) => !err.response;

function getEventStreamUrl(token) {
  const apiBaseUrl = axios.defaults.baseURL || '';
  const url = new URL('/api/events', apiBaseUrl || window.location.origin);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function DataProvider({ children }) {
  const [areas, setAreas] = useState(AREAS);
  const [users, setUsers] = useState([]);
  const [citizenProfiles, setCitizenProfiles] = useState([]);
  const [vulnerableHouseholds, setVulnerableHouseholds] = useState([]);
  const [floodWarnings, setFloodWarnings] = useState([]);
  const [rescueRequests, setRescueRequests] = useState([]);
  const [rescueMissions, setRescueMissions] = useState([]);
  const [missionStatusLogs, setMissionStatusLogs] = useState([]);
  const [rescueTeams, setRescueTeams] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [rescueRoutes, setRescueRoutes] = useState([]);
  const [dams, setDams] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [damageReports, setDamageReports] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dbSynced, setDbSynced] = useState(false);
  const [eventStreamToken, setEventStreamToken] = useState(() => localStorage.getItem('authToken') || '');

  const applyBackendState = useCallback((data) => {
    if (data.areas) setAreas(data.areas);
    if (data.users) setUsers(data.users);
    if (data.citizenProfiles) setCitizenProfiles(data.citizenProfiles);
    if (data.vulnerableHouseholds) setVulnerableHouseholds(data.vulnerableHouseholds);
    if (data.floodWarnings) setFloodWarnings(data.floodWarnings);
    if (data.rescueRequests) setRescueRequests(data.rescueRequests);
    if (data.rescueMissions) setRescueMissions(data.rescueMissions);
    if (data.missionStatusLogs) setMissionStatusLogs(data.missionStatusLogs);
    if (data.rescueTeams) setRescueTeams(data.rescueTeams);
    if (data.safeZones) setSafeZones(data.safeZones);
    if (data.rescueRoutes) setRescueRoutes(data.rescueRoutes);
    if (data.dams) setDams(data.dams);
    if (data.smsLogs) setSmsLogs(data.smsLogs);
    if (data.damageReports) setDamageReports(data.damageReports);
    if (data.activityLogs) setActivityLogs(data.activityLogs);
    if (data.notifications) setNotifications(data.notifications);
    setDbSynced(true);
  }, []);

  // Sync state with Express backend database on mount
  useEffect(() => {
    async function syncWithBackend() {
      try {
        const res = await axios.get('/api/db');
        applyBackendState(res.data);
      } catch (err) {
        console.warn('Backend server offline. Running in offline mockup mode with local state.', err);
      }
    }
    syncWithBackend();
  }, [applyBackendState]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return undefined;

    const events = new EventSource(getEventStreamUrl(eventStreamToken));

    const handleDbUpdate = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.data) applyBackendState(payload.data);
      } catch (err) {
        console.warn('Realtime update payload is invalid.', err);
      }
    };

    events.addEventListener('db:update', handleDbUpdate);
    events.onerror = () => {
      console.warn('Realtime stream disconnected. Browser will retry automatically.');
    };

    return () => {
      events.removeEventListener('db:update', handleDbUpdate);
      events.close();
    };
  }, [applyBackendState, eventStreamToken]);

  useEffect(() => {
    const syncToken = () => {
      setEventStreamToken(localStorage.getItem('authToken') || '');
    };

    window.addEventListener('storage', syncToken);
    const tokenPoll = window.setInterval(syncToken, 1000);

    return () => {
      window.removeEventListener('storage', syncToken);
      window.clearInterval(tokenPoll);
    };
  }, []);

  const addLog = useCallback((userId, userName, action, tableName, recordId, note) => {
    const log = {
      id: `al-${Date.now()}`,
      user_id: userId,
      user_name: userName,
      action,
      table_name: tableName,
      record_id: recordId,
      note,
      created_at: new Date().toISOString(),
    };
    setActivityLogs(prev => [log, ...prev]);
  }, []);

  const addNotification = useCallback((userId, title, message, type, relatedId = null) => {
    const notif = {
      id: `notif-${Date.now()}`,
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString(),
      related_id: relatedId,
    };
    setNotifications(prev => [notif, ...prev]);
  }, []);

  const markNotificationRead = useCallback(async (notifId) => {
    try {
      await axios.put(`/api/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    }
  }, []);

  // Semantic Vector Search API Call
  const searchSemantics = useCallback(async (query, type) => {
    try {
      const res = await axios.get('/api/search', { params: { q: query, type } });
      return res.data;
    } catch (err) {
      console.error('Semantic search failed:', err);
      return [];
    }
  }, []);

  // Flood warnings CRUD
  const createWarning = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/warnings', data);
      const w = res.data;
      setFloodWarnings(prev => [w, ...prev]);
      return w;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const w = { id: `fw-${Date.now()}`, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sms_sent: false, sms_count: 0 };
      setFloodWarnings(prev => [w, ...prev]);
      return w;
    }
  }, []);

  const updateWarning = useCallback(async (id, data) => {
    try {
      const res = await axios.put(`/api/warnings/${id}`, data);
      const w = res.data;
      setFloodWarnings(prev => prev.map(item => item.id === id ? w : item));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setFloodWarnings(prev => prev.map(w => w.id === id ? { ...w, ...data, updated_at: new Date().toISOString() } : w));
    }
  }, []);

  const deleteWarning = useCallback(async (id) => {
    try {
      await axios.delete(`/api/warnings/${id}`);
      setFloodWarnings(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setFloodWarnings(prev => prev.filter(w => w.id !== id));
    }
  }, []);

  // Rescue requests
  const createRescueRequest = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/rescue-requests', data);
      const rr = res.data;
      setRescueRequests(prev => [rr, ...prev]);
      return rr;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const rr = {
        id: `rr-${Date.now()}`,
        ...data,
        status: 'PENDING',
        assigned_team_id: null,
        assigned_team_name: null,
        created_at: new Date().toISOString(),
        accepted_at: null,
        completed_at: null,
      };
      setRescueRequests(prev => [rr, ...prev]);
      return rr;
    }
  }, []);

  const updateRescueRequest = useCallback(async (id, data) => {
    try {
      const res = await axios.put(`/api/rescue-requests/${id}`, data);
      const rr = res.data;
      setRescueRequests(prev => prev.map(r => r.id === id ? rr : r));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setRescueRequests(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    }
  }, []);

  const assignTeamToRequest = useCallback(async (requestId, teamId, teamName, currentUser, options = {}) => {
    try {
      const res = await axios.post(`/api/rescue-requests/${requestId}/assign`, { teamId, teamName, currentUser, ...options });
      const { request, mission, rescueTeams: updatedTeams } = res.data;
      setRescueRequests(prev => prev.map(r => r.id === requestId ? request : r));
      setRescueMissions(prev => [mission, ...prev]);
      if (updatedTeams) setRescueTeams(updatedTeams);
      
      // Update logs and notifications locally from backend sync
      const dbRes = await axios.get('/api/db');
      setActivityLogs(dbRes.data.activityLogs || []);
      setNotifications(dbRes.data.notifications || []);
      if (dbRes.data.rescueTeams) setRescueTeams(dbRes.data.rescueTeams);
      return res.data;
    } catch (err) {
      console.error('Assign rescue request failed:', err);
      throw err;
    }
  }, []);

  // Mission updates
  const updateMissionStatus = useCallback(async (missionId, newStatus, extraData = {}, changedByType = 'RESCUE_TEAM', changedByUser = null, note = '') => {
    try {
      const res = await axios.post(`/api/missions/${missionId}/status`, {
        newStatus, extraData, changedByType, changedByUser, note
      });
      const updatedMission = res.data.mission;
      setRescueMissions(prev => prev.map(m => m.id === missionId ? updatedMission : m));
      if (res.data.rescueTeams) setRescueTeams(res.data.rescueTeams);
      
      // Load updated request status and status logs from backend
      const dbRes = await axios.get('/api/db');
      if (dbRes.data.rescueRequests) setRescueRequests(dbRes.data.rescueRequests);
      if (dbRes.data.missionStatusLogs) setMissionStatusLogs(dbRes.data.missionStatusLogs);
      if (dbRes.data.rescueTeams) setRescueTeams(dbRes.data.rescueTeams);
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setRescueMissions(prev => prev.map(m => {
        if (m.id !== missionId) return m;
        const oldStatus = m.status;
        const updated = { ...m, status: newStatus, ...extraData };
        
        const logEntry = {
          id: `msl-${Date.now()}`,
          mission_id: missionId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by_type: changedByType,
          changed_by_user_id: changedByUser?.id || null,
          note: note || `Cập nhật trạng thái sang ${newStatus}`,
          created_at: new Date().toISOString(),
        };
        setMissionStatusLogs(sl => [...sl, logEntry]);
        return updated;
      }));

      setRescueMissions(prev => {
        const mission = prev.find(m => m.id === missionId);
        if (mission) {
          const requestStatus = mapMissionStatusToRequest(newStatus);
          if (requestStatus) {
            setRescueRequests(rr => rr.map(r =>
              r.id === mission.rescue_request_id ? { ...r, status: requestStatus } : r
            ));
          }
        }
        return prev;
      });
    }
  }, []);

  const mapMissionStatusToRequest = (missionStatus) => {
    const map = {
      ASSIGNED: 'ASSIGNED',
      ACCEPTED: 'ACCEPTED',
      MOVING: 'MOVING',
      NEAR_VICTIM: 'NEAR_VICTIM',
      ARRIVED_CONFIRMED: 'ARRIVED_CONFIRMED',
      RESCUING: 'RESCUING',
      RESCUED: 'RESCUED',
      TRANSFERRED_SAFEZONE: 'TRANSFERRED_SAFEZONE',
      UNREACHABLE: 'UNREACHABLE',
      NEED_SUPPORT: 'NEED_SUPPORT',
      CANCELLED: 'CANCELLED',
    };
    return map[missionStatus];
  };

  // Rescue teams CRUD
  const createTeam = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/teams', data);
      const team = res.data;
      setRescueTeams(prev => [...prev, team]);
      return team;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const team = { id: `team-${Date.now()}`, ...data, created_at: new Date().toISOString() };
      setRescueTeams(prev => [...prev, team]);
      return team;
    }
  }, []);

  const updateTeam = useCallback(async (id, data) => {
    try {
      const res = await axios.put(`/api/teams/${id}`, data);
      const team = res.data;
      setRescueTeams(prev => prev.map(t => t.id === id ? team : t));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setRescueTeams(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    }
  }, []);

  const deleteTeam = useCallback(async (id) => {
    try {
      await axios.delete(`/api/teams/${id}`);
      setRescueTeams(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setRescueTeams(prev => prev.filter(t => t.id !== id));
    }
  }, []);

  // Safe zones CRUD
  const createSafeZone = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/safe-zones', data);
      const sz = res.data;
      setSafeZones(prev => [...prev, sz]);
      return sz;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const sz = { id: `sz-${Date.now()}`, ...data, created_at: new Date().toISOString() };
      setSafeZones(prev => [...prev, sz]);
      return sz;
    }
  }, []);

  const updateSafeZone = useCallback(async (id, data) => {
    try {
      const res = await axios.put(`/api/safe-zones/${id}`, data);
      const sz = res.data;
      setSafeZones(prev => prev.map(s => s.id === id ? sz : s));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setSafeZones(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    }
  }, []);

  const deleteSafeZone = useCallback(async (id) => {
    try {
      await axios.delete(`/api/safe-zones/${id}`);
      setSafeZones(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setSafeZones(prev => prev.filter(s => s.id !== id));
    }
  }, []);

  // Routes CRUD
  const createRoute = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/routes', data);
      const r = res.data;
      setRescueRoutes(prev => [...prev, r]);
      return r;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const r = { id: `route-${Date.now()}`, ...data, created_at: new Date().toISOString() };
      setRescueRoutes(prev => [...prev, r]);
      return r;
    }
  }, []);

  const updateRoute = useCallback(async (id, data) => {
    try {
      const res = await axios.put(`/api/routes/${id}`, data);
      const r = res.data;
      setRescueRoutes(prev => prev.map(item => item.id === id ? r : item));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setRescueRoutes(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    }
  }, []);

  const deleteRoute = useCallback(async (id) => {
    try {
      await axios.delete(`/api/routes/${id}`);
      setRescueRoutes(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setRescueRoutes(prev => prev.filter(r => r.id !== id));
    }
  }, []);

  // SMS log
  const addSmsLog = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/sms-logs', data);
      const log = res.data;
      setSmsLogs(prev => [log, ...prev]);
      return log;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const log = { id: `sms-${Date.now()}`, ...data, sent_at: new Date().toISOString() };
      setSmsLogs(prev => [log, ...prev]);
      return log;
    }
  }, []);

  const sendSmsNotification = useCallback(async (data) => {
    const res = await axios.post('/api/sms/send', data);
    const dbRes = await axios.get('/api/db');
    if (dbRes.data.smsLogs) setSmsLogs(dbRes.data.smsLogs);
    if (dbRes.data.floodWarnings) setFloodWarnings(dbRes.data.floodWarnings);
    return res.data;
  }, []);

  // Damage reports
  const createDamageReport = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/damage-reports', data);
      const dr = res.data;
      setDamageReports(prev => [dr, ...prev]);
      return dr;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const dr = { id: `dr-${Date.now()}`, ...data, status: 'PENDING', created_at: new Date().toISOString() };
      setDamageReports(prev => [dr, ...prev]);
      return dr;
    }
  }, []);

  // Vulnerable households
  const createVulnerableHousehold = useCallback(async (data) => {
    try {
      const res = await axios.post('/api/vulnerable-households', data);
      const vh = res.data;
      setVulnerableHouseholds(prev => [...prev, vh]);
      return vh;
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      const vh = { id: `vh-${Date.now()}`, ...data, created_at: new Date().toISOString() };
      setVulnerableHouseholds(prev => [...prev, vh]);
      return vh;
    }
  }, []);

  const updateVulnerableHousehold = useCallback(async (id, data) => {
    try {
      const res = await axios.put(`/api/vulnerable-households/${id}`, data);
      const vh = res.data;
      setVulnerableHouseholds(prev => prev.map(v => v.id === id ? vh : v));
    } catch (err) {
      if (!shouldUseOfflineFallback(err)) throw err;
      setVulnerableHouseholds(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
    }
  }, []);

  return (
    <DataContext.Provider value={{
      areas,
      users, setUsers,
      citizenProfiles, setCitizenProfiles,
      vulnerableHouseholds, setVulnerableHouseholds,
      floodWarnings, setFloodWarnings,
      rescueRequests, setRescueRequests,
      rescueMissions, setRescueMissions,
      missionStatusLogs, setMissionStatusLogs,
      rescueTeams, setRescueTeams,
      safeZones, setSafeZones,
      rescueRoutes, setRescueRoutes,
      dams, setDams,
      smsLogs, setSmsLogs,
      damageReports, setDamageReports,
      activityLogs, setActivityLogs,
      notifications, setNotifications,
      dbSynced,
      // Actions
      addLog, addNotification, markNotificationRead,
      searchSemantics,
      createWarning, updateWarning, deleteWarning,
      createRescueRequest, updateRescueRequest, assignTeamToRequest,
      updateMissionStatus,
      createTeam, updateTeam, deleteTeam,
      createSafeZone, updateSafeZone, deleteSafeZone,
      createRoute, updateRoute, deleteRoute,
      addSmsLog, sendSmsNotification,
      createDamageReport,
      createVulnerableHousehold, updateVulnerableHousehold,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
