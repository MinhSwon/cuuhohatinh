import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, AlertTriangle, Shield, Bell, MessageSquare, TrendingUp,
  CheckCircle, Clock, Activity, ChevronRight, Waves
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const {
    rescueRequests, rescueTeams, citizenProfiles,
    vulnerableHouseholds, floodWarnings, smsLogs,
    rescueMissions, areas, notifications,
  } = useData();

  // Stats
  const activeWarnings = floodWarnings.filter(w => w.status === 'PUBLISHED').length;
  const pendingRequests = rescueRequests.filter(r => r.status === 'PENDING').length;
  const processingRequests = rescueRequests.filter(r =>
    ['ASSIGNED', 'ACCEPTED', 'MOVING', 'NEAR_VICTIM', 'ARRIVED_CONFIRMED', 'RESCUING'].includes(r.status)
  ).length;
  const rescuedRequests = rescueRequests.filter(r =>
    r.status === 'RESCUED' || r.status === 'TRANSFERRED_SAFEZONE'
  ).length;
  const unreachableRequests = rescueRequests.filter(r => r.status === 'UNREACHABLE').length;
  const availableTeams = rescueTeams.filter(t => t.status === 'AVAILABLE').length;

  // Chart: Requests by area
  const requestsByArea = areas.map(a => ({
    name: a.old_name.replace('Thị trấn ', 'TT. ').replace('Xã ', ''),
    count: rescueRequests.filter(r => r.area_id === a.id).length,
  }));

  // Chart: Status pie
  const statusData = [
    { name: 'Chờ tiếp nhận', value: pendingRequests, color: '#b8afa5' },
    { name: 'Đang xử lý', value: processingRequests, color: '#4a6fa5' },
    { name: 'Cứu thành công', value: rescuedRequests, color: '#3a6b4a' },
    { name: 'Không liên lạc', value: unreachableRequests, color: '#a04040' },
  ].filter(d => d.value > 0);

  const toDateKey = value => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };
  const todayKey = toDateKey(new Date().toISOString());
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = toDateKey(date.toISOString());
    return {
      key,
      label: date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T'),
    };
  });

  const dailyData = lastSevenDays.map(day => ({
    day: day.label,
    canhbao: floodWarnings.filter(w => toDateKey(w.created_at || w.start_time) === day.key).length,
    cuuho: rescueRequests.filter(r => toDateKey(r.created_at) === day.key).length,
  }));
  const todayCitizenCount = citizenProfiles.filter(cp => toDateKey(cp.created_at) === todayKey).length;
  const todayRescuedCount = rescueRequests.filter(r =>
    ['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(r.status) && toDateKey(r.updated_at || r.created_at) === todayKey
  ).length;

  const statCards = [
    { label: 'Tổng người dân', value: citizenProfiles.length, icon: Users, color: '#4a6fa5', bg: '#e8edf5', change: `+${todayCitizenCount} hôm nay` },
    { label: 'Hộ dễ tổn thương', value: vulnerableHouseholds.length, icon: Shield, color: '#6b5a9a', bg: '#ede8f5', change: 'Ưu tiên cứu hộ' },
    { label: 'Đội cứu hộ sẵn sàng', value: `${availableTeams}/${rescueTeams.length}`, icon: Users, color: '#3a6b4a', bg: '#e0ede5', change: `${rescueTeams.filter(t => t.status === 'BUSY').length} đang nhiệm vụ` },
    { label: 'Cảnh báo đang hoạt động', value: activeWarnings, icon: Bell, color: '#a0731a', bg: '#f5efd8', change: 'Đang phát sóng' },
    { label: 'Chờ tiếp nhận', value: pendingRequests, icon: Clock, color: '#a04040', bg: '#f5e0e0', change: '⚠️ Cần phân công ngay' },
    { label: 'Đang xử lý', value: processingRequests, icon: Activity, color: '#4a6fa5', bg: '#e8edf5', change: 'Đang trong quá trình' },
    { label: 'Cứu thành công', value: rescuedRequests, icon: CheckCircle, color: '#3a6b4a', bg: '#e0ede5', change: `${todayRescuedCount} hôm nay` },
    { label: 'SMS đã gửi', value: smsLogs.filter(s => s.status === 'SENT').length, icon: MessageSquare, color: '#3a7a8a', bg: '#ddeef2', change: `${smsLogs.filter(s => s.status === 'FAILED').length} thất bại` },
  ];

  const recentRequests = rescueRequests.slice(0, 5);
  const unreadNotifs = notifications.filter(n => !n.is_read && n.user_id === currentUser?.id);

  return (
    <div className="page-container">
      {/* Welcome + Emergency alert */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>
          Chào mừng, {currentUser?.full_name}
        </h1>
        <p className="page-subtitle">
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Emergency notifications */}
      {unreadNotifs.length > 0 && (
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {unreadNotifs.slice(0, 3).map(n => (
            <div key={n.id} style={{
              background: '#faf5f0', border: '1px solid #e0c8b8',
              borderLeft: '3px solid #a04040',
              borderRadius: 8, padding: '0.75rem 1rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <AlertTriangle size={16} color="#a04040" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b3030' }}>{n.title}</div>
                <div style={{ fontSize: '0.7rem', color: '#9e6060', marginTop: 1 }}>{n.message}</div>
              </div>
              {n.type === 'RESCUE_REQUEST' && (
                <Link to="/admin/rescue-requests" className="btn btn-danger btn-sm">Xem ngay</Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Active warning pills */}
      {activeWarnings > 0 && (
        <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {floodWarnings.filter(w => w.status === 'PUBLISHED').map(w => (
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0.875rem', borderRadius: '9999px',
              border: `1px solid ${w.level === 'EMERGENCY' ? '#fecaca' : w.level === 'HIGH' ? '#fed7aa' : '#fde68a'}`,
              background: w.level === 'EMERGENCY' ? '#fef2f2' : w.level === 'HIGH' ? '#fff7ed' : '#fefce8',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: w.level === 'EMERGENCY' ? '#ef4444' : w.level === 'HIGH' ? '#f97316' : '#eab308', flexShrink: 0 }} className="emergency-pulse" />
              <LevelBadge level={w.level} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>{w.area_name}: {w.title.substring(0, 30)}...</span>
            </div>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {statCards.map((card, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.68rem', color: '#9e9282', fontWeight: 500, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</p>
                <p style={{ fontFamily: "'Lora', serif", fontSize: '1.6rem', fontWeight: 600, color: '#2a2520', lineHeight: 1 }}>{card.value}</p>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <card.icon size={18} color={card.color} />
              </div>
            </div>
            <p style={{ fontSize: '0.68rem', color: card.color, fontWeight: 500 }}>{card.change}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Bar chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><TrendingUp size={16} /> Cảnh báo & Cứu hộ theo ngày</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ede8e0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9e9282' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9e9282' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2dbd0', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}
                    labelStyle={{ color: '#2a2520', fontWeight: 600 }}
                  />
                  <Bar dataKey="canhbao" name="Cảnh báo" fill="#a0731a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cuuho" name="Yêu cầu cứu hộ" fill="#4a6fa5" radius={[3, 3, 0, 0]} />
                  <Legend formatter={(v) => <span style={{ fontSize: '0.72rem', color: '#6b6050' }}>{v}</span>} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Activity size={16} /> Trạng thái cứu hộ</span>
          </div>
          <div className="card-body">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: '0.75rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {statusData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0', fontSize: '0.82rem' }}>
                Chưa có dữ liệu
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Recent requests */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><AlertTriangle size={16} /> Yêu cầu cứu hộ mới nhất</span>
            <Link to="/admin/rescue-requests" className="btn btn-ghost btn-sm" style={{ color: '#3b82f6' }}>
              Xem tất cả <ChevronRight size={14} />
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Người yêu cầu</th>
                  <th>Khu vực</th>
                  <th>Mức độ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#0f172a' }}>{r.full_name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{r.phone}</div>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#374151' }}>{r.area_name}</td>
                    <td><LevelBadge level={r.emergency_level} /></td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rescue requests by area */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><Waves size={16} /> Yêu cầu theo khu vực</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={requestsByArea} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem' }} />
                <Bar dataKey="count" name="Yêu cầu" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rescueTeams.slice(0, 4).map(team => (
                <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>{team.team_name.replace('Đội cứu hộ ', '')}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{team.member_count} thành viên</div>
                  </div>
                  <StatusBadge status={team.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
