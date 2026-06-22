import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { AlertTriangle, Phone, Shield, Building2, Bell, Navigation } from 'lucide-react';
import { LevelBadge } from '../../components/common/StatusBadge';
import { getPublicSafeZones, getSafeZoneOccupancy } from '../../utils/safeZones';

export default function HomePage() {
  const { floodWarnings, safeZones, rescueRequests, rescueTeams, publicStats } = useData();
  const activeWarnings = floodWarnings.filter(w => w.status === 'PUBLISHED');
  const emergencyWarnings = activeWarnings.filter(w => w.level === 'EMERGENCY');
  const hasEmergency = emergencyWarnings.length > 0;
  const publicSafeZones = getPublicSafeZones(safeZones);
  const rescueRequestTotal = rescueRequests.length || publicStats.rescue_request_count || 0;
  const availableTeamTotal = rescueTeams.length
    ? rescueTeams.filter(team => team.status === 'AVAILABLE').length
    : publicStats.available_team_count || 0;

  const EMERGENCY_CONTACTS = [
    { name: 'Ban Chỉ huy PCTT Hương Khê', phone: '0693 851 000', icon: Shield },
    { name: 'Cảnh sát PCCC & CNCH',        phone: '114',           icon: AlertTriangle },
    { name: 'Cấp cứu y tế',                phone: '115',           icon: Phone },
    { name: 'Đường dây nóng UBND',          phone: '0239 381 2345', icon: Navigation },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f1eb', fontFamily: "'Inter', sans-serif" }}>

      {/* Emergency ticker */}
      {hasEmergency && (
        <div className="emergency-pulse" style={{
          background: '#a04040', color: '#fdf5f5',
          padding: '0.5rem 1rem', textAlign: 'center',
          fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.02em',
        }}>
          🚨 Cảnh báo khẩn cấp — {emergencyWarnings[0]?.area_name}: {emergencyWarnings[0]?.title}
          &nbsp;·&nbsp;
          <a href="tel:0693851000" style={{ color: '#fecaca', textDecoration: 'underline' }}>0693 851 000</a>
        </div>
      )}

      {/* Header */}
      <header style={{
        background: '#2d2825',
        padding: '0 2rem',
        position: 'sticky', top: hasEmergency ? 0 : 0,
        zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.svg" alt="Cổng thông tin cứu hộ ngập lụt" className="brand-logo-image compact" />
            <div>
              <div style={{ fontFamily: "'Lora', serif", color: '#f0ece5', fontWeight: 600, fontSize: '0.92rem', letterSpacing: '0.01em' }}>
                CỨU HỘ NGẬP LỤT
              </div>
              <div style={{ color: '#9e9282', fontSize: '0.6rem', letterSpacing: '0.05em' }}>
                CỔNG THÔNG TIN CỨU HỘ
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            <Link to="/login" style={{ color: '#b8afa5', fontSize: '0.75rem', textDecoration: 'none', padding: '0.375rem 0.75rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s' }}>
              Đăng nhập
            </Link>
            <Link to="/sos" style={{
              background: '#a04040', color: 'white', fontSize: '0.75rem', fontWeight: 600,
              textDecoration: 'none', padding: '0.375rem 0.875rem', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}>
              🆘 Cứu hộ khẩn cấp
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(160deg, #2d2825 0%, #3a3530 55%, #454038 100%)',
        padding: '3.5rem 2rem',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '3rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Left */}
            <div style={{ flex: '1 1 380px' }}>
              {activeWarnings.length > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(160,64,64,0.2)', border: '1px solid rgba(160,64,64,0.35)',
                  borderRadius: 5, padding: '0.3rem 0.75rem', marginBottom: '1.25rem',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c07070' }} className="emergency-pulse" />
                  <span style={{ color: '#e8a0a0', fontSize: '0.7rem', fontWeight: 500 }}>
                    {activeWarnings.length} cảnh báo đang hoạt động
                  </span>
                </div>
              )}

              <h1 style={{
                fontFamily: "'Lora', serif",
                color: '#f0ece5', fontSize: '2rem', fontWeight: 600,
                lineHeight: 1.35, letterSpacing: '-0.01em', marginBottom: '0.875rem',
              }}>
                Hệ thống cảnh báo<br />
                <span style={{ color: '#8aabcf' }}>lũ lụt Hương Khê</span>
              </h1>
              <p style={{ color: '#9e9585', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.75rem', maxWidth: 400 }}>
                Theo dõi cảnh báo lũ theo thời gian thực, gửi yêu cầu cứu hộ và tìm điểm sơ tán gần nhất cho khu vực Hương Khê, Hà Tĩnh.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/sos" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: '#a04040', color: 'white', textDecoration: 'none',
                  padding: '0.65rem 1.25rem', borderRadius: 7, fontWeight: 600, fontSize: '0.85rem',
                  boxShadow: '0 4px 14px rgba(160,64,64,0.4)',
                }}>
                  🆘 Gửi cứu hộ khẩn cấp
                </Link>
                <Link to="/register" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(255,255,255,0.08)', color: '#c8c0b5', textDecoration: 'none',
                  padding: '0.65rem 1.25rem', borderRadius: 7, fontWeight: 500, fontSize: '0.85rem',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}>
                  <Bell size={15} /> Đăng ký nhận cảnh báo
                </Link>
              </div>
              <p style={{ color: '#6b6360', fontSize: '0.68rem', marginTop: '0.75rem' }}>Không cần đăng nhập — gửi cứu hộ trong dưới 30 giây</p>
            </div>

            {/* Stats column */}
            <div style={{ flex: '0 1 280px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { icon: '🌊', label: 'Cảnh báo đang hoạt động', value: activeWarnings.length, dim: '#a04040' },
                { icon: '🆘', label: 'Yêu cầu cứu hộ', value: rescueRequestTotal, dim: '#a0731a' },
                { icon: '🛡️', label: 'Đội cứu hộ sẵn sàng', value: availableTeamTotal, dim: '#3a6b4a' },
                { icon: '🏫', label: 'Điểm sơ tán mở', value: publicSafeZones.filter(s => s.status === 'AVAILABLE').length, dim: '#4a6fa5' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.875rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e8e0d5', fontFamily: "'Lora', serif" }}>{s.value}</div>
                  <div style={{ fontSize: '0.62rem', color: '#8a8278', marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '2rem' }}>

        {/* Active warnings */}
        {activeWarnings.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 600, color: '#2a2520' }}>
                Cảnh báo đang hoạt động
              </h2>
              <span style={{ background: '#f5d8d8', color: '#7a2020', borderRadius: 4, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 600 }}>
                {activeWarnings.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {activeWarnings.map(w => (
                <div key={w.id} className={`alert-banner ${w.level.toLowerCase()}`}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                      <LevelBadge level={w.level} />
                      <span style={{ fontFamily: "'Lora', serif", fontWeight: 600, fontSize: '0.88rem', color: '#2a2520' }}>{w.title}</span>
                      <span style={{ fontSize: '0.68rem', color: '#9e9282' }}>📍 {w.area_name}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#4a4035', lineHeight: 1.6 }}>{w.content}</p>
                    <div style={{ marginTop: '0.375rem', fontSize: '0.68rem', color: '#9e9282' }}>
                      Đến {new Date(w.end_time).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Safe zones */}
          <section>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.05rem', fontWeight: 600, color: '#2a2520', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={17} color="#3a6b4a" /> Điểm sơ tán
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {publicSafeZones.map(sz => {
                const occupancy = getSafeZoneOccupancy(sz);
                const barColor = occupancy.percent >= 90 ? '#a04040' : occupancy.percent >= 70 ? '#a0731a' : '#3a6b4a';
                return (
                  <div key={sz.id} className="card" style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#2a2520', marginBottom: 2 }}>{sz.name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#9e9282' }}>📍 {sz.area_name} · {sz.contact_phone}</div>
                      </div>
                      <span className={`badge badge-${sz.status}`}>{sz.status === 'FULL' ? 'Đã đầy' : 'Còn chỗ'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#9e9282', marginBottom: 5 }}>
                      <span>{occupancy.current_people}/{occupancy.capacity} người</span><span>{occupancy.percent}%</span>
                    </div>
                    <div style={{ height: 4, background: '#ede8e0', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${occupancy.percent}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Emergency contacts */}
          <section>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.05rem', fontWeight: 600, color: '#2a2520', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone size={17} color="#a04040" /> Số liên hệ khẩn cấp
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {EMERGENCY_CONTACTS.map((c, i) => (
                <a key={i} href={`tel:${c.phone}`} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  background: '#fdfcf8', borderRadius: 9, padding: '0.75rem 0.875rem',
                  textDecoration: 'none', border: '1px solid #e2dbd0',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ width: 36, height: 36, background: '#f5e8e8', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={16} color="#a04040" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#9e9282', marginBottom: 1 }}>{c.name}</div>
                    <div style={{ fontFamily: "'Lora', serif", fontWeight: 600, fontSize: '0.95rem', color: '#a04040' }}>{c.phone}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* SOS CTA */}
            <div style={{
              background: '#2d2825', borderRadius: 12, padding: '1.25rem', textAlign: 'center',
              border: '1px solid #3d3530',
            }}>
              <div style={{ fontFamily: "'Lora', serif", color: '#f0ece5', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.375rem' }}>
                Cần cứu hộ ngay?
              </div>
              <div style={{ color: '#9e9282', fontSize: '0.72rem', marginBottom: '0.875rem' }}>
                Không cần đăng nhập · Gửi vị trí GPS tức thì
              </div>
              <Link to="/sos" style={{
                display: 'inline-block', background: '#a04040', color: 'white',
                textDecoration: 'none', borderRadius: 7, padding: '0.6rem 1.375rem',
                fontWeight: 600, fontSize: '0.85rem', boxShadow: '0 3px 10px rgba(160,64,64,0.35)',
              }}>
                🆘 Gửi yêu cầu cứu hộ
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: '#2d2825', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem 2rem', marginTop: '3rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          <img src="/logo.svg" alt="Cổng thông tin cứu hộ ngập lụt" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
          <span style={{ fontFamily: "'Lora', serif", color: '#c8c0b5', fontWeight: 500, fontSize: '0.85rem' }}>CỨU HỘ NGẬP LỤT</span>
        </div>
        <p style={{ fontSize: '0.68rem', color: '#6b6360' }}>Hệ thống cảnh báo lũ lụt & điều phối cứu hộ · Huyện Hương Khê, Tỉnh Hà Tĩnh</p>
      </footer>

      {/* Floating SOS */}
      <Link to="/sos" style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 999,
        width: 56, height: 56, borderRadius: '50%',
        background: '#a04040', color: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textDecoration: 'none', fontSize: '0.58rem', fontWeight: 700,
        boxShadow: '0 4px 16px rgba(160,64,64,0.45)',
        border: '2px solid rgba(255,255,255,0.2)',
        animation: 'pulse-soft 2.5s infinite',
        letterSpacing: '0.05em',
      }}>
        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🆘</span>
        <span style={{ marginTop: 2 }}>SOS</span>
      </Link>
    </div>
  );
}
