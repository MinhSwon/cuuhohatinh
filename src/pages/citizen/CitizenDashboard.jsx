import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, Phone, CheckCircle, Shield } from 'lucide-react';
import { getPublicSafeZones } from '../../utils/safeZones';

export default function CitizenDashboard() {
  const { currentUser } = useAuth();
  const { floodWarnings, rescueRequests, safeZones, citizenProfiles, areas } = useData();

  const myProfile = citizenProfiles.find(cp => cp.user_id === currentUser?.id);
  const activeWarnings = floodWarnings.filter(w => w.status === 'PUBLISHED');
  const myAreaWarnings = myProfile
    ? activeWarnings.filter(w => w.area_id === myProfile.area_id)
    : activeWarnings;
  const myRequests = rescueRequests.filter(r => r.user_id === currentUser?.id || r.phone === currentUser?.phone);
  const publicSafeZones = getPublicSafeZones(safeZones);
  const nearSafeZones = publicSafeZones.filter(sz => !myProfile || sz.area_id === myProfile.area_id);

  const EMERGENCY_CONTACTS = [
    { name: 'Ban PCTT Hương Khê', phone: '0693 851 000' },
    { name: 'PCCC & CNCH', phone: '114' },
    { name: 'Cấp cứu', phone: '115' },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Xin chào, {currentUser?.full_name}! 👋</h1>
        <p className="page-subtitle">
          📍 {myProfile ? areas.find(a => a.id === myProfile.area_id)?.old_name || 'Hương Khê' : 'Hương Khê, Hà Tĩnh'}
        </p>
      </div>

      {/* Emergency banner */}
      {myAreaWarnings.some(w => w.level === 'EMERGENCY') && (
        <div style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }} className="emergency-pulse">
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>🚨 CẢNH BÁO KHẨN CẤP TRONG KHU VỰC BẠN!</div>
          <p style={{ fontSize: '0.88rem', opacity: 0.9 }}>{myAreaWarnings.find(w => w.level === 'EMERGENCY')?.title}</p>
          <Link to="/citizen/request" className="btn" style={{ marginTop: '0.875rem', background: 'white', color: '#dc2626', fontWeight: 700 }}>
            🆘 Gửi yêu cầu cứu hộ ngay
          </Link>
        </div>
      )}

      {/* Cảnh báo khu vực */}
      {myAreaWarnings.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="#f59e0b" /> Cảnh báo tại khu vực bạn ({myAreaWarnings.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {myAreaWarnings.map(w => (
              <div key={w.id} className={`alert-banner ${w.level.toLowerCase()}`}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <LevelBadge level={w.level} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{w.title}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>{w.content}</p>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                    🕐 Đến: {new Date(w.end_time).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Quick Actions */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.875rem' }}>⚡ Hành động nhanh</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <Link to="/citizen/request" className="btn btn-danger" style={{ justifyContent: 'flex-start', padding: '0.875rem 1rem' }}>
              <AlertTriangle size={20} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>🆘 Gửi yêu cầu cứu hộ</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>Cần hỗ trợ khẩn cấp</div>
              </div>
            </Link>
            <Link to="/citizen/warnings" className="btn btn-warning" style={{ justifyContent: 'flex-start', padding: '0.875rem 1rem' }}>
              <Bell size={20} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>📢 Xem cảnh báo lũ</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{activeWarnings.length} cảnh báo đang hoạt động</div>
              </div>
            </Link>
            <Link to="/citizen/safezones" className="btn btn-primary" style={{ justifyContent: 'flex-start', padding: '0.875rem 1rem' }}>
              <Shield size={20} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>🏫 Điểm sơ tán gần nhất</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>{nearSafeZones.filter(s => s.status === 'AVAILABLE').length} điểm còn chỗ</div>
              </div>
            </Link>
          </div>
        </div>

        {/* My requests */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.875rem' }}>
            📋 Yêu cầu cứu hộ của tôi
          </h2>
          {myRequests.length === 0 ? (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
              <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 0.75rem' }} />
              Bạn chưa có yêu cầu cứu hộ nào
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {myRequests.map(r => (
                <div key={r.id} className="card" style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>Yêu cầu #{r.id.substring(0, 8)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {r.assigned_team_name && <div>🛡️ Đội: {r.assigned_team_name}</div>}
                    <div>🕐 {new Date(r.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Emergency contacts */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Phone size={18} color="#dc2626" /> Số khẩn cấp
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {EMERGENCY_CONTACTS.map((c, i) => (
            <a key={i} href={`tel:${c.phone}`} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', borderRadius: 10, padding: '0.875rem', textDecoration: 'none', border: '1px solid #fecaca', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 40, height: 40, background: '#fef2f2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Phone size={18} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.name}</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#dc2626' }}>{c.phone}</div>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
