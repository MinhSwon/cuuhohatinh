import { useData } from '../../contexts/DataContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { BarChart3, Download, TrendingUp } from 'lucide-react';
import { AREAS } from '../../data/publicData';

export default function Reports() {
  const { rescueRequests, rescueMissions, rescueTeams, floodWarnings, smsLogs, vulnerableHouseholds } = useData();

  const byArea = AREAS.map(a => ({
    name: a.old_name.replace('Thị trấn ', 'TT.').replace('Xã ', ''),
    total: rescueRequests.filter(r => r.area_id === a.id).length,
    rescued: rescueRequests.filter(r => r.area_id === a.id && ['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(r.status)).length,
    pending: rescueRequests.filter(r => r.area_id === a.id && r.status === 'PENDING').length,
  }));

  const byStatus = [
    { name: 'Chờ tiếp nhận', value: rescueRequests.filter(r => r.status === 'PENDING').length, color: '#94a3b8' },
    { name: 'Đang xử lý', value: rescueRequests.filter(r => ['ASSIGNED','ACCEPTED','MOVING','NEAR_VICTIM','ARRIVED_CONFIRMED','RESCUING'].includes(r.status)).length, color: '#3b82f6' },
    { name: 'Cứu thành công', value: rescueRequests.filter(r => ['RESCUED','TRANSFERRED_SAFEZONE'].includes(r.status)).length, color: '#10b981' },
    { name: 'Không liên lạc', value: rescueRequests.filter(r => r.status === 'UNREACHABLE').length, color: '#ef4444' },
    { name: 'Cần hỗ trợ', value: rescueRequests.filter(r => r.status === 'NEED_SUPPORT').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const teamPerformance = rescueTeams.map(team => ({
    name: team.team_name.replace('Đội cứu hộ ', '').replace('Đội ', ''),
    total: rescueMissions.filter(m => m.rescue_team_id === team.id).length,
    success: rescueMissions.filter(m => m.rescue_team_id === team.id && ['RESCUED','TRANSFERRED_SAFEZONE'].includes(m.status)).length,
  }));

  const smsSummary = {
    total: smsLogs.length,
    sent: smsLogs.filter(s => s.status === 'SENT').length,
    failed: smsLogs.filter(s => s.status === 'FAILED').length,
    rate: smsLogs.length > 0 ? Math.round((smsLogs.filter(s => s.status === 'SENT').length / smsLogs.length) * 100) : 0,
  };

  const keyStats = [
    { label: 'Tổng yêu cầu cứu hộ', value: rescueRequests.length },
    { label: 'Ca cứu thành công', value: rescueRequests.filter(r => ['RESCUED','TRANSFERRED_SAFEZONE'].includes(r.status)).length },
    { label: 'Tỷ lệ cứu thành công', value: `${rescueRequests.length > 0 ? Math.round((rescueRequests.filter(r => ['RESCUED','TRANSFERRED_SAFEZONE'].includes(r.status)).length / rescueRequests.length) * 100) : 0}%` },
    { label: 'Tổng SMS đã gửi', value: smsSummary.sent },
    { label: 'Tỷ lệ SMS thành công', value: `${smsSummary.rate}%` },
    { label: 'Tổng cảnh báo', value: floodWarnings.length },
    { label: 'Hộ dễ tổn thương', value: vulnerableHouseholds.length },
    { label: 'Đội cứu hộ', value: rescueTeams.length },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Thống kê & Báo cáo</h1><p className="page-subtitle">Tổng hợp dữ liệu hoạt động hệ thống</p></div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => alert('Tính năng xuất PDF sẽ được tích hợp trong phiên bản backend!')}>
            <Download size={14} /> Xuất PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => alert('Tính năng xuất Excel sẽ được tích hợp trong phiên bản backend!')}>
            <Download size={14} /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Key Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {keyStats.map((s, i) => (
          <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* By Area */}
        <div className="card">
          <div className="card-header"><span className="card-title"><BarChart3 size={16} /> Yêu cầu cứu hộ theo khu vực</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byArea} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: '0.78rem' }} />
                <Bar dataKey="total" name="Tổng" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="rescued" name="Cứu thành công" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="pending" name="Đang chờ" fill="#f59e0b" radius={[4,4,0,0]} />
                <Legend formatter={(v) => <span style={{ fontSize: '0.72rem' }}>{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie */}
        <div className="card">
          <div className="card-header"><span className="card-title"><TrendingUp size={16} /> Phân bổ trạng thái</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3} label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {byStatus.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
              {byStatus.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Performance */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header"><span className="card-title">🛡️ Hiệu suất đội cứu hộ</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {teamPerformance.map((team, i) => {
              const rate = team.total > 0 ? Math.round((team.success / team.total) * 100) : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 140, fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>{team.name}</div>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${rate}%`, background: rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#374151', width: 100, flexShrink: 0, textAlign: 'right' }}>
                    {team.success}/{team.total} ({rate}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SMS Stats */}
      <div className="card">
        <div className="card-header"><span className="card-title">📱 Thống kê SMS</span></div>
        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: 10 }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#374151' }}>{smsSummary.total}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Tổng tin nhắn</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: 10 }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{smsSummary.sent}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Gửi thành công</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: '#fef2f2', borderRadius: 10 }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>{smsSummary.failed}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Thất bại</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1rem', background: '#eff6ff', borderRadius: 10 }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6' }}>{smsSummary.rate}%</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Tỷ lệ thành công</div>
          </div>
        </div>
      </div>
    </div>
  );
}
