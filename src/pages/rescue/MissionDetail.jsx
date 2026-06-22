import { useState, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import { haversineDistance, formatDistance } from '../../utils/haversine';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CheckCircle, X, Phone, MapPin, Navigation, Activity, AlertTriangle, Clock } from 'lucide-react';
import { HA_TINH_MAP_BOUNDS, HA_TINH_MAP_CENTER, getHaTinhMapCenter, hasValidLatLng, isInHaTinhBounds } from '../../utils/haTinhMap';
import OfflineStatusBanner from '../../components/common/OfflineStatusBanner';

const victimIcon = L.divIcon({
  className: '',
  html: `<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,0.5);">🆘</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

const myIcon = L.divIcon({
  className: '',
  html: `<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);">📍</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

function MapCenter({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos && isInHaTinhBounds(pos[0], pos[1])) map.setView(pos, 15);
  }, [pos, map]);
  return null;
}

const NEXT_STATUS = {
  ASSIGNED: 'ACCEPTED', ACCEPTED: 'MOVING', MOVING: 'ARRIVED_CONFIRMED', NEAR_VICTIM: 'ARRIVED_CONFIRMED',
  ARRIVED_CONFIRMED: 'RESCUING', RESCUING: null,
};

const NEXT_LABELS = {
  ASSIGNED: '✅ Nhận nhiệm vụ', ACCEPTED: '🚤 Bắt đầu di chuyển', MOVING: '🤝 Xác nhận tiếp cận',
  NEAR_VICTIM: '🤝 Xác nhận tiếp cận (GPS ✅)', ARRIVED_CONFIRMED: '⚡ Bắt đầu cứu hộ', RESCUING: null,
};
const SHOW_GPS_SIMULATION = import.meta.env.DEV;

export default function MissionDetail() {
  const { currentUser } = useAuth();
  const { rescueMissions, rescueTeams, updateMissionStatus, addNotification, addLog } = useData();
  const toast = useToast();
  const [myPos, setMyPos] = useState(null);
  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [completionNote, setCompletionNote] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef(null);
  const lastQueuedGpsRef = useRef(0);

  const myTeam = rescueTeams.find(t => t.leader_user_id === currentUser?.id) || rescueTeams[0];
  const missions = rescueMissions.filter(m => m.rescue_team_id === myTeam?.id && !['CANCELLED', 'UNREACHABLE'].includes(m.status));
  const activeMissions = missions.filter(m => !['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(m.status));
  const selectedMission = missions.find(m => m.id === selectedMissionId) || activeMissions[0];
  const missionHasVictimLocation = selectedMission
    ? hasValidLatLng(selectedMission.victim_latitude, selectedMission.victim_longitude)
      && isInHaTinhBounds(selectedMission.victim_latitude, selectedMission.victim_longitude)
    : false;
  const victimMapCenter = missionHasVictimLocation
    ? getHaTinhMapCenter(selectedMission.victim_latitude, selectedMission.victim_longitude)
    : HA_TINH_MAP_CENTER;
  const myPosInHaTinh = myPos && isInHaTinhBounds(myPos[0], myPos[1]);

  const distance = myPosInHaTinh && selectedMission && missionHasVictimLocation
    ? haversineDistance(myPos[0], myPos[1], selectedMission.victim_latitude, selectedMission.victim_longitude)
    : null;

  const nearVictim = distance !== null && distance <= (selectedMission?.checkin_radius_meters || 100);

  // GPS tracking
  const startTracking = () => {
    if (navigator.geolocation) {
      setTracking(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => setMyPos([pos.coords.latitude, pos.coords.longitude]),
        () => toast.error('Không thể lấy vị trí GPS'),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    } else {
      toast.error('Thiết bị không hỗ trợ GPS. Vui lòng nhập/cập nhật vị trí thủ công qua điều phối viên.');
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    setTracking(false);
  };

  useEffect(() => {
    if (!tracking || !myPos || !selectedMission) return;
    if (typeof navigator !== 'undefined' && navigator.onLine) return;

    const now = Date.now();
    if (now - lastQueuedGpsRef.current < 30000) return;
    lastQueuedGpsRef.current = now;

    updateMissionStatus(
      selectedMission.id,
      selectedMission.status,
      {
        current_rescuer_latitude: myPos[0],
        current_rescuer_longitude: myPos[1],
        gps_saved_offline: true,
      },
      'RESCUE_TEAM',
      currentUser?.id,
      'Lưu tạm vị trí GPS khi mất mạng'
    );
  }, [tracking, myPos, selectedMission, updateMissionStatus, currentUser?.id]);

  // Simulate approaching
  const simulateApproach = () => {
    if (!SHOW_GPS_SIMULATION || !selectedMission) return;
    const near = [
      selectedMission.victim_latitude + 0.0003,
      selectedMission.victim_longitude + 0.0002,
    ];
    setMyPos(near);
    toast.success('📍 Đã mô phỏng vị trí gần nạn nhân (trong vòng 100m)');
  };

  const handleAdvanceStatus = async () => {
    if (!selectedMission) return;
    const next = NEXT_STATUS[selectedMission.status];
    if (!next) return;
    try {
      const result = await updateMissionStatus(
        selectedMission.id, next,
        myPos ? { current_rescuer_latitude: myPos[0], current_rescuer_longitude: myPos[1] } : {},
        'RESCUE_TEAM', currentUser?.id,
        `Đội ${myTeam?.team_name} cập nhật trạng thái → ${next}`
      );
      if (result?.queued) toast.warning('Đang mất mạng: trạng thái đã lưu tạm và sẽ tự gửi lại khi có mạng.');
      else toast.success(`Đã cập nhật: ${next}`);
    } catch (err) {
      console.error('Không cập nhật được trạng thái nhiệm vụ:', err);
      toast.error('Không cập nhật được trạng thái. Vui lòng thử lại.');
    }
  };

  const reportMissionStatus = async (newStatus, note, successMessage) => {
    if (!selectedMission) return;
    try {
      const result = await updateMissionStatus(
        selectedMission.id,
        newStatus,
        myPos ? { current_rescuer_latitude: myPos[0], current_rescuer_longitude: myPos[1] } : {},
        'RESCUE_TEAM',
        currentUser?.id,
        note
      );

      if (result?.queued) {
        toast.warning('Đang offline: yêu cầu đã lưu tạm. Hệ thống sẽ tự gửi lại cho điều phối khi có mạng.');
      } else {
        toast.warning(successMessage);
      }
    } catch (err) {
      console.error('Không gửi được cập nhật nhiệm vụ:', err);
      toast.error('Không gửi được cập nhật. Vui lòng thử lại hoặc gọi trực tiếp điều phối viên.');
    }
  };

  const handleMarkNearVictim = () => {
    if (!selectedMission || !nearVictim) return;
    updateMissionStatus(
      selectedMission.id, 'NEAR_VICTIM',
      {
        current_rescuer_latitude: myPos[0],
        current_rescuer_longitude: myPos[1],
        auto_arrival_detected: true,
        auto_arrival_time: new Date().toISOString(),
        auto_arrival_distance_meters: Math.round(distance),
      },
      'SYSTEM', null,
      `Hệ thống tự động xác định: Đội đã đến gần nạn nhân (${Math.round(distance)}m)`
    );
    addNotification(null, '🤖 Hệ thống: NEAR_VICTIM được xác nhận', `Đội ${myTeam?.team_name} đã vào vùng geofence nạn nhân ${selectedMission.victim_name}`, 'AUTO_CHECKIN', selectedMission.id);
    toast.success('🤖 Hệ thống đã tự động xác nhận NEAR_VICTIM!');
  };

  const handleMarkRescued = () => {
    if (!completionNote.trim()) { toast.error('Vui lòng nhập ghi chú kết quả!'); return; }
    updateMissionStatus(
      selectedMission.id, 'RESCUED',
      { completion_note: completionNote, completed_at: new Date().toISOString() },
      'RESCUE_TEAM', currentUser?.id,
      `Đội cứu hộ xác nhận cứu thành công: ${completionNote}`
    );
    addLog(currentUser?.id, currentUser?.full_name, 'Cứu hộ thành công', 'rescue_missions', selectedMission.id, completionNote);
    toast.success('🎉 Đã đánh dấu cứu hộ thành công!');
    setShowCompleteModal(false);
    setCompletionNote('');
  };

  const canComplete = ['ARRIVED_CONFIRMED', 'RESCUING'].includes(selectedMission?.status);
  const nextLabel = selectedMission ? NEXT_LABELS[selectedMission.status] : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Nhiệm vụ của đội</h1><p className="page-subtitle">{myTeam?.team_name} · {myTeam?.area_name}</p></div>
        {tracking ? (
          <button className="btn btn-danger btn-sm" onClick={stopTracking}><X size={14} /> Dừng GPS</button>
        ) : (
          <button className="btn btn-primary" onClick={startTracking}><Navigation size={16} /> Bật GPS tracking</button>
        )}
      </div>
      <OfflineStatusBanner />

      {/* Mission selector */}
      {activeMissions.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
          {activeMissions.map(m => (
            <button key={m.id}
              onClick={() => setSelectedMissionId(m.id)}
              className={`btn btn-sm ${selectedMissionId === m.id || selectedMission?.id === m.id ? 'btn-primary' : 'btn-secondary'}`}>
              {m.victim_name} ({m.status})
            </button>
          ))}
        </div>
      )}

      {selectedMission ? (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.25rem' }}>
          {/* Left panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Mission card */}
            <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🆘 {selectedMission.victim_name}</span>
                  <StatusBadge status={selectedMission.status} />
                </div>
                <a href={`tel:${selectedMission.victim_phone}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>
                  📞 {selectedMission.victim_phone}
                </a>
              </div>
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#374151' }}>📍 {selectedMission.victim_address}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedMission.has_elderly && <span className="badge" style={{ background: '#fef9c3', color: '#713f12' }}>👴 Người già</span>}
                  {selectedMission.has_children && <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>👶 Trẻ em</span>}
                  {selectedMission.has_disabled && <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>♿ Khuyết tật</span>}
                </div>
              </div>
            </div>

            {/* GPS distance */}
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Navigation size={16} /> Trạng thái GPS
              </div>
              {myPos ? (
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>📍 Vị trí của bạn: {myPos[0].toFixed(5)}, {myPos[1].toFixed(5)}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: nearVictim ? '#10b981' : '#374151', marginBottom: '0.5rem' }}>
                    📏 {distance !== null ? formatDistance(distance) : '—'}
                  </div>
                  {nearVictim ? (
                    <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '0.625rem', fontSize: '0.78rem', fontWeight: 600 }}>
                      ✅ Bạn đang trong vùng 100m xung quanh nạn nhân!
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.625rem', fontSize: '0.78rem', color: '#64748b' }}>
                      Hãy tiếp tục di chuyển đến nạn nhân
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Chưa bật GPS. Nhấn "Bật GPS tracking" để theo dõi.</div>
              )}
              {SHOW_GPS_SIMULATION && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={simulateApproach}>
                  📡 Mô phỏng vị trí gần nạn nhân
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚡ Cập nhật trạng thái</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {nextLabel && (
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAdvanceStatus}>
                    {nextLabel}
                  </button>
                )}

                {nearVictim && selectedMission.status === 'MOVING' && !selectedMission.auto_arrival_detected && (
                  <button className="btn btn-warning" style={{ width: '100%', justifyContent: 'center' }} onClick={handleMarkNearVictim}>
                    🤖 Hệ thống xác nhận NEAR_VICTIM (GPS ≤ 100m)
                  </button>
                )}

                {canComplete && (
                  <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', background: '#10b981', color: 'white' }} onClick={() => setShowCompleteModal(true)}>
                    🎉 Xác nhận CỨU THÀNH CÔNG
                  </button>
                )}

                <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { if (window.confirm('Báo cáo không liên lạc được?')) reportMissionStatus('UNREACHABLE', 'Đội cứu hộ báo cáo: Không thể liên lạc', 'Đã báo cáo không liên lạc cho điều phối'); }}>
                  📵 Báo cáo không liên lạc
                </button>
                <button className="btn btn-warning btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => reportMissionStatus('NEED_SUPPORT', 'Đội cứu hộ yêu cầu hỗ trợ thêm', 'Đã gửi yêu cầu hỗ trợ cho điều phối!')}>
                  🆘 Yêu cầu hỗ trợ thêm
                </button>
              </div>
            </div>
          </div>

          {/* Map */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', minHeight: 500 }}>
            <MapContainer
              center={victimMapCenter}
              zoom={missionHasVictimLocation ? 15 : 11}
              minZoom={9}
              maxBounds={HA_TINH_MAP_BOUNDS}
              maxBoundsViscosity={1}
              style={{ height: '100%', minHeight: 500, width: '100%' }}
            >
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {myPosInHaTinh && <MapCenter pos={myPos} />}

              {missionHasVictimLocation && (
                <>
                  <Marker position={[selectedMission.victim_latitude, selectedMission.victim_longitude]} icon={victimIcon}>
                    <Popup><div style={{ fontSize: '0.82rem' }}><strong>🆘 {selectedMission.victim_name}</strong><br />{selectedMission.victim_address}</div></Popup>
                  </Marker>
                  <Circle center={[selectedMission.victim_latitude, selectedMission.victim_longitude]} radius={selectedMission.checkin_radius_meters} pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.1, dashArray: '5,5' }} />
                </>
              )}

              {myPosInHaTinh && (
                <Marker position={myPos} icon={myIcon}>
                  <Popup><div style={{ fontSize: '0.82rem' }}>📍 Vị trí của bạn</div></Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
          <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>Không có nhiệm vụ đang thực hiện</p>
          <p style={{ fontSize: '0.82rem' }}>Chờ Admin phân công nhiệm vụ mới</p>
        </div>
      )}

      {/* Complete modal */}
      {showCompleteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCompleteModal(false)}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🎉 Xác nhận cứu hộ thành công</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#15803d' }}>
                ⚠️ Lưu ý: Chỉ đánh dấu khi bạn đã thực sự tiếp cận và cứu được nạn nhân. Hệ thống KHÔNG tự động tick mục này.
              </div>
              <label className="form-label">Ghi chú kết quả *</label>
              <textarea className="form-input" rows={3} value={completionNote} onChange={e => setCompletionNote(e.target.value)} placeholder="VD: Đã cứu 3 người lên xuồng, đưa về điểm sơ tán trường THCS..." style={{ resize: 'none' }} />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>Hủy</button>
                <button className="btn" style={{ background: '#10b981', color: 'white' }} onClick={handleMarkRescued}>🎉 Xác nhận</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
