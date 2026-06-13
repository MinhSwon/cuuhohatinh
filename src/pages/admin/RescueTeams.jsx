import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Plus, Edit2, Trash2, Users, Phone, X, ChevronDown } from 'lucide-react';
import { AREAS } from '../../data/publicData';

function TeamForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    team_name: '', area_id: '', leader_name: '', phone: '',
    vehicle_type: '', member_count: 5, max_active_missions: 2,
    max_people_per_trip: 6, vehicle_capacity: 6, service_radius_km: 10,
    status: 'AVAILABLE', note: ''
  });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tên đội *</label>
          <input className="form-input" value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} required placeholder="VD: Đội cứu hộ Hà Linh" />
        </div>
        <div>
          <label className="form-label">Khu vực phụ trách *</label>
          <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} required>
            <option value="">-- Chọn khu vực --</option>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Trưởng đội</label>
          <input className="form-input" value={form.leader_name} onChange={e => setForm(f => ({ ...f, leader_name: e.target.value }))} placeholder="Họ tên trưởng đội" />
        </div>
        <div>
          <label className="form-label">Số điện thoại *</label>
          <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="Số điện thoại" />
        </div>
        <div>
          <label className="form-label">Phương tiện</label>
          <input className="form-input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} placeholder="Xuồng máy, xe tải..." />
        </div>
        <div>
          <label className="form-label">Số thành viên</label>
          <input type="number" min="1" className="form-input" value={form.member_count} onChange={e => setForm(f => ({ ...f, member_count: parseInt(e.target.value) }))} />
        </div>
        <div>
          <label className="form-label">Nhiem vu dong thoi</label>
          <input type="number" min="1" className="form-input" value={form.max_active_missions || 2} onChange={e => setForm(f => ({ ...f, max_active_missions: parseInt(e.target.value) }))} />
        </div>
        <div>
          <label className="form-label">Suc cho moi chuyen</label>
          <input type="number" min="1" className="form-input" value={form.max_people_per_trip || form.vehicle_capacity || 1} onChange={e => setForm(f => ({ ...f, max_people_per_trip: parseInt(e.target.value), vehicle_capacity: parseInt(e.target.value) }))} />
        </div>
        <div>
          <label className="form-label">Ban kinh phuc vu (km)</label>
          <input type="number" min="1" className="form-input" value={form.service_radius_km || 10} onChange={e => setForm(f => ({ ...f, service_radius_km: parseInt(e.target.value) }))} />
        </div>
        <div>
          <label className="form-label">Trạng thái</label>
          <select className="form-input form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="AVAILABLE">Sẵn sàng</option>
            <option value="BUSY">Đang làm nhiệm vụ</option>
            <option value="OFFLINE">Không hoạt động</option>
            <option value="INACTIVE">Ngưng hoạt động</option>
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Ghi chú</label>
          <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ resize: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button type="submit" className="btn btn-primary"><Users size={16} /> {initial ? 'Cập nhật' : 'Tạo đội'}</button>
      </div>
    </form>
  );
}

export default function RescueTeams() {
  const { rescueTeams, createTeam, updateTeam, deleteTeam, rescueMissions } = useData();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = filterStatus ? rescueTeams.filter(t => t.status === filterStatus) : rescueTeams;

  const activeStatuses = ['ASSIGNED','ACCEPTED','MOVING','NEAR_VICTIM','ARRIVED_CONFIRMED','RESCUING','NEED_SUPPORT'];
  const getMissionCount = (teamId) => rescueMissions.filter(m => m.rescue_team_id === teamId).length;
  const getActiveMissionCount = (teamId) => rescueMissions.filter(m => m.rescue_team_id === teamId && activeStatuses.includes(m.status)).length;
  const getSuccessCount = (teamId) => rescueMissions.filter(m => m.rescue_team_id === teamId && ['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(m.status)).length;

  const handleSave = (form) => {
    const area = AREAS.find(a => a.id === form.area_id);
    if (editTeam) {
      updateTeam(editTeam.id, { ...form, area_name: area?.old_name });
      toast.success('Đã cập nhật đội cứu hộ!');
    } else {
      createTeam({ ...form, area_name: area?.old_name });
      toast.success('Đã tạo đội cứu hộ mới!');
    }
    setShowForm(false); setEditTeam(null);
  };

  const handleDelete = (t) => {
    if (window.confirm(`Xóa đội "${t.team_name}"?`)) {
      deleteTeam(t.id);
      toast.success('Đã xóa đội cứu hộ!');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý đội cứu hộ</h1>
          <p className="page-subtitle">Quản lý thông tin và trạng thái các đội cứu hộ</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTeam(null); setShowForm(true); }}>
          <Plus size={16} /> Tạo đội mới
        </button>
      </div>

      {/* Status filter */}
      <div className="filter-bar">
        {['', 'AVAILABLE', 'BUSY', 'OFFLINE', 'INACTIVE'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}>
            {s === '' ? `Tất cả (${rescueTeams.length})` : `${s === 'AVAILABLE' ? 'Sẵn sàng' : s === 'BUSY' ? 'Đang nhiệm vụ' : s === 'OFFLINE' ? 'Không hoạt động' : 'Ngưng'} (${rescueTeams.filter(t => t.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Team cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {filtered.map(team => {
          const missions = getMissionCount(team.id);
          const activeMissions = getActiveMissionCount(team.id);
          const success = getSuccessCount(team.id);
          return (
            <div key={team.id} className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: 4 }}>{team.team_name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {team.area_name || AREAS.find(a => a.id === team.area_id)?.old_name}</div>
                </div>
                <StatusBadge status={team.status} />
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1rem', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Trưởng đội</span>
                    <div style={{ fontWeight: 600 }}>👤 {team.leader_name || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Điện thoại</span>
                    <a href={`tel:${team.phone}`} style={{ display: 'block', fontWeight: 600, color: '#3b82f6', textDecoration: 'none' }}>📞 {team.phone}</a>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Thành viên</span>
                    <div style={{ fontWeight: 600 }}>👥 {team.member_count} người</div>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>Phương tiện</span>
                    <div style={{ fontWeight: 600 }}>🚤 {team.vehicle_type || '—'}</div>
                  </div>
                </div>

                <div style={{ background: activeMissions >= (team.max_active_missions || 2) ? '#fef2f2' : '#eff6ff', borderRadius: 8, padding: '0.625rem', marginBottom: '1rem', fontSize: '0.78rem', color: activeMissions >= (team.max_active_missions || 2) ? '#b91c1c' : '#1d4ed8', fontWeight: 700 }}>
                  Tai dieu phoi: {activeMissions}/{team.max_active_missions || 2} nhiem vu dang xu ly · Suc cho: {team.max_people_per_trip || team.vehicle_capacity || 'chua cau hinh'} nguoi/chuyen
                </div>

                {/* Performance */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{missions}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Tổng nhiệm vụ</div>
                  </div>
                  <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{success}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Cứu thành công</div>
                  </div>
                  <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#374151' }}>{missions > 0 ? Math.round((success / missions) * 100) : 0}%</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Hiệu suất</div>
                  </div>
                </div>

                {team.note && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.75rem', fontStyle: 'italic' }}>📝 {team.note}</div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditTeam(team); setShowForm(true); }}>
                    <Edit2 size={13} /> Sửa
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(team)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{editTeam ? 'Cập nhật đội cứu hộ' : 'Tạo đội cứu hộ mới'}</h3>
              <button onClick={() => { setShowForm(false); setEditTeam(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <TeamForm initial={editTeam} onSave={handleSave} onClose={() => { setShowForm(false); setEditTeam(null); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
