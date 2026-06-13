import { useState, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import { haversineDistance, formatDistance } from '../../utils/haversine';
import {
  getMissionStatusColor,
  getRequestAddress,
  getRequestLatLng,
  getRequestName,
  isNeedsVerification,
} from '../../utils/rescueCoordination';
import {
  Navigation, CheckCircle, AlertTriangle, Phone, MapPin, Clock, Activity,
  ChevronRight, Filter, Maximize2, Send, X, User
} from 'lucide-react';

// Custom map icons
const victimIcon = L.divIcon({
  className: '',
  html: `<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,0.5);">🆘</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const createRescuePointIcon = (status = 'PENDING', label = '🆘') => {
  const color = status === 'PENDING' ? '#dc2626' : getMissionStatusColor(status);
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,0.35);">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const rescuerIcon = L.divIcon({
  className: '',
  html: `<div style="background:#10b981;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(16,185,129,0.5);">🛡️</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const safeZoneIcon = L.divIcon({
  className: '',
  html: `<div style="background:#3b82f6;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);">🏫</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const STATUS_LABELS = {
  PENDING: 'Chờ tiếp nhận', ASSIGNED: 'Đã phân công', ACCEPTED: 'Đã nhận',
  MOVING: 'Đang di chuyển', NEAR_VICTIM: 'Đã đến gần', ARRIVED_CONFIRMED: 'Đã tiếp cận',
  RESCUING: 'Đang cứu hộ', RESCUED: 'Cứu thành công', TRANSFERRED_SAFEZONE: 'Đã đưa đến nơi an toàn',
  UNREACHABLE: 'Không liên lạc được', NEED_SUPPORT: 'Cần hỗ trợ', CANCELLED: 'Đã hủy',
};

const STATUS_COLORS = {
  PENDING: '#94a3b8', ASSIGNED: '#60a5fa', ACCEPTED: '#3b82f6', MOVING: '#8b5cf6',
  NEAR_VICTIM: '#f97316', ARRIVED_CONFIRMED: '#4ade80', RESCUING: '#facc15',
  RESCUED: '#10b981', TRANSFERRED_SAFEZONE: '#059669', UNREACHABLE: '#ef4444',
  NEED_SUPPORT: '#f97316', CANCELLED: '#6b7280',
};

const DEFAULT_MAP_CENTER = [18.183, 105.733];
const isValidCoordinate = value => typeof value === 'number' && Number.isFinite(value);
const hasLatLng = (lat, lng) => isValidCoordinate(lat) && isValidCoordinate(lng);
const missionHasVictimLocation = mission => hasLatLng(mission?.victim_latitude, mission?.victim_longitude);
const missionHasRescuerLocation = mission => hasLatLng(mission?.current_rescuer_latitude, mission?.current_rescuer_longitude);

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (hasLatLng(center?.[0], center?.[1])) map.setView(center, 14);
  }, [center, map]);
  return null;
}

export default function DispatchCenter() {
  const { rescueMissions, rescueRequests, safeZones, rescueTeams, updateMissionStatus, addNotification } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedMission, setSelectedMission] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [showFilter, setShowFilter] = useState(false);

  const activeMissions = rescueMissions.filter(m => !['RESCUED', 'TRANSFERRED_SAFEZONE', 'CANCELLED'].includes(m.status));
  const displayMissions = filterStatus ? rescueMissions.filter(m => m.status === filterStatus) : rescueMissions;
  const safeZonesWithLocation = safeZones.filter(sz => hasLatLng(sz.latitude, sz.longitude));
  const missionsWithVictimLocation = rescueMissions.filter(missionHasVictimLocation);
  const pendingRequestsWithLocation = rescueRequests
    .filter(request => request.status === 'PENDING')
    .map(request => ({ request, position: getRequestLatLng(request) }))
    .filter(item => item.position);

  const handleSelectMission = (mission) => {
    setSelectedMission(mission);
    if (missionHasVictimLocation(mission)) {
      setMapCenter([mission.victim_latitude, mission.victim_longitude]);
    }
  };

  // Simulate GPS update for a mission
  const simulateGPSUpdate = (mission) => {
    if (!missionHasVictimLocation(mission)) {
      toast.error('Nhiệm vụ này chưa có tọa độ nạn nhân để mô phỏng GPS');
      return;
    }

    const newLat = mission.victim_latitude + (Math.random() - 0.5) * 0.001;
    const newLon = mission.victim_longitude + (Math.random() - 0.5) * 0.001;
    const distance = haversineDistance(newLat, newLon, mission.victim_latitude, mission.victim_longitude);
    
    let newStatus = mission.status;
    let extraData = { current_rescuer_latitude: newLat, current_rescuer_longitude: newLon };

    if (distance <= 100 && !mission.auto_arrival_detected && mission.status === 'MOVING') {
      newStatus = 'NEAR_VICTIM';
      extraData = {
        ...extraData,
        auto_arrival_detected: true,
        auto_arrival_time: new Date().toISOString(),
        auto_arrival_distance_meters: Math.round(distance),
      };
      addNotification(currentUser?.id, '🚨 Hệ thống xác định NEAR_VICTIM', `Đội ${mission.team_name} đã đến gần nạn nhân ${mission.victim_name} (${Math.round(distance)}m)`, 'AUTO_CHECKIN', mission.id);
      toast.warning(`📍 Hệ thống: Đội ${mission.team_name} đã đến gần ${mission.victim_name}!`);
    }

    updateMissionStatus(mission.id, newStatus, extraData, 'SYSTEM', null, 'Cập nhật vị trí GPS');
    toast.success(`Đã cập nhật vị trí ${mission.team_name}`);
  };

  const missionsByStatus = {
    pending: rescueRequests.filter(r => r.status === 'PENDING'),
    processing: rescueMissions.filter(m => ['ASSIGNED','ACCEPTED','MOVING','NEAR_VICTIM','ARRIVED_CONFIRMED','RESCUING'].includes(m.status)),
    needSupport: rescueMissions.filter(m => m.status === 'NEED_SUPPORT'),
    completed: rescueMissions.filter(m => ['RESCUED','TRANSFERRED_SAFEZONE'].includes(m.status)),
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Trung tâm điều phối cứu hộ</h1>
          <p className="page-subtitle">Theo dõi và điều phối các nhiệm vụ cứu hộ theo thời gian thực</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.5rem 0.875rem', display: 'flex', gap: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>⚡ {missionsByStatus.pending.length} chờ phân công</span>
            <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>🔄 {missionsByStatus.processing.length} đang xử lý</span>
            {missionsByStatus.needSupport.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>🆘 {missionsByStatus.needSupport.length} cần hỗ trợ!</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.25rem', height: 'calc(100vh - 180px)', minHeight: 600 }}>
        {/* Left Panel - Mission List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', overflowY: 'auto' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['', 'PENDING', 'MOVING', 'NEAR_VICTIM', 'RESCUING', 'NEED_SUPPORT', 'RESCUED'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.68rem' }}
              >
                {s ? STATUS_LABELS[s] : 'Tất cả'}
              </button>
            ))}
          </div>

          {/* Pending requests alert */}
          {missionsByStatus.pending.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fecaca', borderRadius: 10, padding: '0.875rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#dc2626', marginBottom: '0.5rem' }}>
                ⚠️ {missionsByStatus.pending.length} yêu cầu chờ phân công
              </div>
              {missionsByStatus.pending.slice(0, 3).map(r => (
                <div key={r.id} style={{ background: 'white', borderRadius: 6, padding: '0.5rem 0.625rem', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{getRequestName(r)}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>📍 {r.area_name}</div>
                    {isNeedsVerification(r) && <div style={{ fontSize: '0.66rem', color: '#dc2626', fontWeight: 700 }}>Can xac minh vi tri</div>}
                  </div>
                  <LevelBadge level={r.emergency_level} />
                </div>
              ))}
            </div>
          )}

          {/* NEED_SUPPORT alert */}
          {missionsByStatus.needSupport.map(m => (
            <div key={m.id} style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', border: '1px solid #fed7aa', borderRadius: 10, padding: '0.875rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#c2410c', marginBottom: '0.375rem' }}>
                🆘 CẦN HỖ TRỢ THÊM!
              </div>
              <div style={{ fontSize: '0.75rem' }}>{m.team_name} cần hỗ trợ tại {m.victim_name}</div>
              <button className="btn btn-warning btn-sm" style={{ marginTop: '0.5rem' }}>
                <Phone size={13} /> Gọi ngay
              </button>
            </div>
          ))}

          {/* Mission cards */}
          {displayMissions.map(m => {
            const isSelected = selectedMission?.id === m.id;
            const distance = missionHasVictimLocation(m) && missionHasRescuerLocation(m)
              ? haversineDistance(m.current_rescuer_latitude, m.current_rescuer_longitude, m.victim_latitude, m.victim_longitude)
              : null;

            return (
              <div
                key={m.id}
                onClick={() => handleSelectMission(m)}
                style={{
                  background: isSelected ? '#eff6ff' : 'white',
                  border: `2px solid ${isSelected ? '#3b82f6' : '#f1f5f9'}`,
                  borderRadius: 10, padding: '0.875rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{m.victim_name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{m.victim_address?.substring(0, 40)}...</div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                <div style={{ fontSize: '0.72rem', color: '#374151', marginBottom: '0.5rem' }}>
                  🛡️ {m.team_name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {distance !== null && (
                    <span style={{ fontSize: '0.7rem', color: distance <= 100 ? '#10b981' : '#64748b', fontWeight: distance <= 100 ? 700 : 400 }}>
                      📏 {formatDistance(distance)}
                    </span>
                  )}
                  {m.auto_arrival_detected && (
                    <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', borderRadius: '9999px', padding: '1px 8px', fontWeight: 600 }}>
                      ✅ GPS đã xác nhận gần
                    </span>
                  )}
                </div>

                {m.status === 'MOVING' && missionHasVictimLocation(m) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', fontSize: '0.7rem' }}
                    onClick={e => { e.stopPropagation(); simulateGPSUpdate(m); }}
                  >
                    📡 Mô phỏng cập nhật GPS
                  </button>
                )}
              </div>
            );
          })}

          {displayMissions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              Không có nhiệm vụ nào
            </div>
          )}
        </div>

        {/* Right - Map */}
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative' }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater center={mapCenter} />

            {/* Safe zones */}
            {safeZonesWithLocation.map(sz => (
              <Marker key={sz.id} position={[sz.latitude, sz.longitude]} icon={safeZoneIcon}>
                <Popup>
                  <div style={{ fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>🏫 {sz.name}</div>
                    <div style={{ color: '#64748b' }}>{sz.address}</div>
                    <div style={{ marginTop: 4 }}>Sức chứa: {sz.current_people}/{sz.capacity}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Pending rescue requests */}
            {pendingRequestsWithLocation.map(({ request, position }) => (
              <Marker key={request.id} position={[position.lat, position.lng]} icon={createRescuePointIcon('PENDING', '⏳')}>
                <Popup>
                  <div style={{ fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 700, color: '#dc2626' }}>Dang cho phan cong: {getRequestName(request)}</div>
                    <div style={{ color: '#64748b', marginTop: 4 }}>{getRequestAddress(request)}</div>
                    <div style={{ marginTop: 4 }}><LevelBadge level={request.emergency_level} /></div>
                    {isNeedsVerification(request) && <div style={{ marginTop: 4, color: '#dc2626', fontWeight: 700 }}>Can xac minh vi tri</div>}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Missions */}
            {missionsWithVictimLocation.map(m => (
              <div key={m.id}>
                {/* Victim */}
                <Marker position={[m.victim_latitude, m.victim_longitude]} icon={createRescuePointIcon(m.status, m.mission_type === 'SUPPORT_OR_CLUSTER' ? '➕' : '🆘')}>
                  <Popup>
                    <div style={{ fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: 700, color: '#dc2626' }}>🆘 {m.victim_name}</div>
                      <div style={{ color: '#64748b', marginTop: 4 }}>{m.victim_address}</div>
                      <div style={{ marginTop: 4 }}><StatusBadge status={m.status} /></div>
                      <div style={{ marginTop: 4, color: '#2563eb', fontWeight: 700 }}>Da co doi {m.team_name} phu trach</div>
                      {m.linked_mission_id && <div style={{ marginTop: 4, color: '#7c3aed' }}>Ho tro/cum voi: {m.linked_mission_id}</div>}
                    </div>
                  </Popup>
                </Marker>
                {/* Geofence circle */}
                <Circle
                  center={[m.victim_latitude, m.victim_longitude]}
                  radius={m.checkin_radius_meters}
                  pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.08, weight: 2, dashArray: '5,5' }}
                />
                {/* Rescuer */}
                {missionHasRescuerLocation(m) && (
                  <>
                    <Marker position={[m.current_rescuer_latitude, m.current_rescuer_longitude]} icon={rescuerIcon}>
                      <Popup>
                        <div style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 700, color: '#059669' }}>🛡️ {m.team_name}</div>
                          <div style={{ marginTop: 4 }}><StatusBadge status={m.status} /></div>
                        </div>
                      </Popup>
                    </Marker>
                    <Polyline
                      positions={[[m.current_rescuer_latitude, m.current_rescuer_longitude], [m.victim_latitude, m.victim_longitude]]}
                      pathOptions={{ color: '#3b82f6', dashArray: '8,4', weight: 2, opacity: 0.6 }}
                    />
                  </>
                )}
              </div>
            ))}
          </MapContainer>

          {/* Map legend */}
          <div style={{
            position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
            background: 'white', borderRadius: 10, padding: '0.75rem 1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.72rem',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>Chú thích bản đồ</div>
            {[
              { icon: '⏳', label: 'Yeu cau cho phan cong', color: '#dc2626' },
              { icon: '🆘', label: 'Da co doi phu trach', color: '#2563eb' },
              { icon: '➕', label: 'Nhiem vu ho tro/cum', color: '#7c3aed' },
              { icon: '🛡️', label: 'Đội cứu hộ', color: '#10b981' },
              { icon: '🏫', label: 'Điểm sơ tán', color: '#3b82f6' },
              { icon: '⭕', label: 'Vùng geofence 100m', color: '#f97316' },
            ].map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                <span>{l.icon}</span>
                <span style={{ color: '#64748b' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Selected mission detail overlay */}
          {selectedMission && (
            <div style={{
              position: 'absolute', top: 20, right: 20, zIndex: 1000,
              background: 'white', borderRadius: 12, padding: '1rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)', width: 260,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Chi tiết nhiệm vụ</span>
                <button onClick={() => setSelectedMission(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
              </div>
              <StatusBadge status={selectedMission.status} />
              <div style={{ marginTop: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedMission.victim_name}</div>
                <div style={{ color: '#64748b', marginBottom: 4 }}>🛡️ {selectedMission.team_name}</div>
                {selectedMission.auto_arrival_detected && (
                  <div style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>
                    ✅ Hệ thống đã xác nhận đến gần ({selectedMission.auto_arrival_distance_meters}m)
                  </div>
                )}
                {missionHasVictimLocation(selectedMission) && missionHasRescuerLocation(selectedMission) && (
                  <div style={{ color: '#3b82f6', fontSize: '0.72rem', marginTop: 4 }}>
                    📏 Khoảng cách hiện tại: {formatDistance(haversineDistance(
                      selectedMission.current_rescuer_latitude,
                      selectedMission.current_rescuer_longitude,
                      selectedMission.victim_latitude,
                      selectedMission.victim_longitude
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
