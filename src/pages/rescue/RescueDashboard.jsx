import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import { haversineDistance, formatDistance } from '../../utils/haversine';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function RescueDashboard() {
  const { currentUser } = useAuth();
  const { rescueMissions, rescueTeams, floodWarnings, updateOwnTeamStatus } = useData();
  const toast = useToast();

  const myTeam = rescueTeams.find(t =>
    t.leader_user_id === currentUser?.id ||
    t.leader_id === currentUser?.id ||
    t.user_id === currentUser?.id ||
    (Array.isArray(t.member_user_ids) && t.member_user_ids.includes(currentUser?.id)) ||
    currentUser?.team_id === t.id
  );

  const myMissions = rescueMissions.filter(m => m.rescue_team_id === myTeam?.id);
  const activeMissions = myMissions.filter(m => !['RESCUED', 'TRANSFERRED_SAFEZONE', 'CANCELLED', 'UNREACHABLE'].includes(m.status));
  const completedMissions = myMissions.filter(m => ['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(m.status));
  const activeWarnings = floodWarnings.filter(w => w.status === 'PUBLISHED');

  const handleTeamStatusChange = async () => {
    if (!myTeam) return;
    const nextStatus = myTeam.status === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    try {
      await updateOwnTeamStatus(myTeam.id, nextStatus);
      toast.success(nextStatus === 'AVAILABLE' ? 'Đội đã chuyển sang Sẵn sàng' : 'Đội đã chuyển sang Bận');
    } catch (err) {
      toast.error(err.response?.data?.error === 'Team still has active missions'
        ? 'Không thể chuyển sang Sẵn sàng khi đội còn nhiệm vụ đang xử lý.'
        : 'Không thể cập nhật trạng thái đội.');
    }
  };

  if (!myTeam) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h1 className="page-title">Tài khoản chưa được liên kết với đội cứu hộ</h1>
          <p className="page-subtitle">Vui lòng yêu cầu Admin cập nhật trường tài khoản trưởng đội trước khi nhận nhiệm vụ.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Chào mừng, {currentUser?.full_name}! 🛡️</h1>
        <p className="page-subtitle">
          {myTeam ? `Đội: ${myTeam.team_name} · ${myTeam.area_name}` : 'Đội cứu hộ'}
          {myTeam && <span style={{ marginLeft: 12 }}><StatusBadge status={myTeam.status} /></span>}
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleTeamStatusChange}>
          Chuyển sang {myTeam.status === 'AVAILABLE' ? 'Bận' : 'Sẵn sàng'}
        </button>
      </div>

      {/* Active warnings */}
      {activeWarnings.length > 0 && (
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activeWarnings.slice(0, 2).map(w => (
            <div key={w.id} className={`alert-banner ${w.level.toLowerCase()}`}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <LevelBadge level={w.level} />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{w.title}</span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {w.area_name}</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#374151', marginTop: 4 }}>{w.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Nhiệm vụ đang xử lý', value: activeMissions.length, color: '#3b82f6', bg: '#eff6ff', icon: Activity },
          { label: 'Cứu thành công', value: completedMissions.length, color: '#10b981', bg: '#f0fdf4', icon: CheckCircle },
          { label: 'Tổng nhiệm vụ', value: myMissions.length, color: '#374151', bg: '#f8fafc', icon: Clock },
          { label: 'Trạng thái đội', value: myTeam?.status === 'AVAILABLE' ? 'Sẵn sàng' : 'Bận', color: myTeam?.status === 'AVAILABLE' ? '#10b981' : '#f59e0b', bg: myTeam?.status === 'AVAILABLE' ? '#f0fdf4' : '#fffbeb', icon: CheckCircle },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.375rem' }}>{s.label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Active missions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={16} color="#ef4444" /> Nhiệm vụ đang thực hiện</span>
            <Link to="/rescue/missions" className="btn btn-primary btn-sm">Xem tất cả</Link>
          </div>
          {activeMissions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
              ✅ Không có nhiệm vụ nào đang thực hiện
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activeMissions.map(m => {
                const dist = m.current_rescuer_latitude
                  ? haversineDistance(m.current_rescuer_latitude, m.current_rescuer_longitude, m.victim_latitude, m.victim_longitude)
                  : null;
                return (
                  <div key={m.id} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>🆘 {m.victim_name}</div>
                      <StatusBadge status={m.status} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>📍 {m.victim_address}</div>
                    <div style={{ display: 'flex', gap: '0.875rem', fontSize: '0.72rem' }}>
                      <a href={`tel:${m.victim_phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>📞 {m.victim_phone}</a>
                      {dist !== null && <span style={{ color: dist <= 100 ? '#10b981' : '#64748b' }}>📏 {formatDistance(dist)}</span>}
                      {m.auto_arrival_detected && <span style={{ color: '#10b981', fontWeight: 600 }}>✅ GPS đã xác nhận</span>}
                    </div>
                    <Link to={`/rescue/missions`} className="btn btn-primary btn-sm" style={{ marginTop: '0.625rem' }}>
                      Mở nhiệm vụ
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Team info */}
        <div>
          {myTeam && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header"><span className="card-title">🛡️ Thông tin đội</span></div>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.78rem' }}>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Trưởng đội</span><div style={{ fontWeight: 600 }}>👤 {myTeam.leader_name}</div></div>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Điện thoại</span><a href={`tel:${myTeam.phone}`} style={{ display: 'block', color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>📞 {myTeam.phone}</a></div>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Thành viên</span><div style={{ fontWeight: 600 }}>👥 {myTeam.member_count} người</div></div>
                  <div><span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Phương tiện</span><div style={{ fontWeight: 600 }}>🚤 {myTeam.vehicle_type || '—'}</div></div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">✅ Cứu hộ hoàn tất gần đây</span></div>
            {completedMissions.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>Chưa có</div>
            ) : (
              <div>
                {completedMissions.slice(-5).reverse().map(m => (
                  <div key={m.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>✅ {m.victim_name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.completed_at ? new Date(m.completed_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
