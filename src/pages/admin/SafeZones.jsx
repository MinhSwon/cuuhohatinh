import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Plus, Edit2, Trash2, Building2, X } from 'lucide-react';
import { AREAS } from '../../data/publicData';
import { getSafeZoneOccupancy, toFiniteNumber } from '../../utils/safeZones';

function SafeZoneForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', area_id: '', address: '', latitude: '', longitude: '',
    capacity: 100, current_people: 0, contact_person: '', contact_phone: '', status: 'AVAILABLE'
  });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tên điểm sơ tán *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="VD: Trường THCS Hương Khê" />
        </div>
        <div>
          <label className="form-label">Khu vực *</label>
          <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} required>
            <option value="">-- Chọn khu vực --</option>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Trạng thái</label>
          <select className="form-input form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="AVAILABLE">Còn chỗ</option>
            <option value="FULL">Đã đầy</option>
            <option value="INACTIVE">Không hoạt động</option>
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Địa chỉ *</label>
          <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
        </div>
        <div>
          <label className="form-label">Vĩ độ (Latitude)</label>
          <input type="number" step="any" className="form-input" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value === '' ? '' : parseFloat(e.target.value) }))} placeholder="18.1833" />
        </div>
        <div>
          <label className="form-label">Kinh độ (Longitude)</label>
          <input type="number" step="any" className="form-input" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value === '' ? '' : parseFloat(e.target.value) }))} placeholder="105.7333" />
        </div>
        <div>
          <label className="form-label">Sức chứa (người)</label>
          <input type="number" min="1" className="form-input" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} />
        </div>
        <div>
          <label className="form-label">Số người hiện tại</label>
          <input type="number" min="0" className="form-input" value={form.current_people} onChange={e => setForm(f => ({ ...f, current_people: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} />
        </div>
        <div>
          <label className="form-label">Người phụ trách</label>
          <input className="form-input" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Điện thoại</label>
          <input className="form-input" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button type="submit" className="btn btn-primary"><Building2 size={16} /> {initial ? 'Cập nhật' : 'Thêm điểm sơ tán'}</button>
      </div>
    </form>
  );
}

export default function SafeZones() {
  const { safeZones, createSafeZone, updateSafeZone, deleteSafeZone } = useData();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterArea, setFilterArea] = useState('');

  const filtered = safeZones.filter(sz => {
    if (filterStatus && sz.status !== filterStatus) return false;
    if (filterArea && sz.area_id !== filterArea) return false;
    return true;
  });

  const totalCapacity = safeZones.reduce((sum, sz) => sum + Math.max(0, toFiniteNumber(sz.capacity)), 0);
  const totalPeople = safeZones.reduce((sum, sz) => sum + Math.max(0, toFiniteNumber(sz.current_people)), 0);
  const totalOccupancy = totalCapacity > 0 ? Math.round((totalPeople / totalCapacity) * 100) : 0;

  const handleSave = (form) => {
    const area = AREAS.find(a => a.id === form.area_id);
    if (editZone) {
      updateSafeZone(editZone.id, { ...form, area_name: area?.old_name });
      toast.success('Đã cập nhật điểm sơ tán!');
    } else {
      createSafeZone({ ...form, area_name: area?.old_name });
      toast.success('Đã thêm điểm sơ tán mới!');
    }
    setShowForm(false); setEditZone(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Điểm sơ tán</h1>
          <p className="page-subtitle">Quản lý các điểm sơ tán và sức chứa</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditZone(null); setShowForm(true); }}>
          <Plus size={16} /> Thêm điểm sơ tán
        </button>
      </div>

      {/* Overall stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Tổng điểm sơ tán', value: safeZones.length, color: '#3b82f6' },
          { label: 'Còn chỗ', value: safeZones.filter(s => s.status === 'AVAILABLE').length, color: '#10b981' },
          { label: 'Đã đầy', value: safeZones.filter(s => s.status === 'FULL').length, color: '#ef4444' },
          { label: `${totalPeople}/${totalCapacity} người`, value: `${totalOccupancy}%`, color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-input form-select" style={{ width: 160 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">Tất cả khu vực</option>
          {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
        </select>
        <select className="form-input form-select" style={{ width: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="AVAILABLE">Còn chỗ</option>
          <option value="FULL">Đã đầy</option>
          <option value="INACTIVE">Không hoạt động</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {filtered.map(sz => {
          const occupancy = getSafeZoneOccupancy(sz);
          const barColor = occupancy.percent >= 95 ? '#ef4444' : occupancy.percent >= 75 ? '#f59e0b' : '#10b981';
          return (
            <div key={sz.id} className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>🏫 {sz.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {sz.area_name}</div>
                </div>
                <StatusBadge status={sz.status} />
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Sức chứa: {occupancy.current_people}/{occupancy.capacity || '?'} người</span>
                    <span style={{ fontWeight: 700, color: barColor }}>{occupancy.hasCapacity ? `${occupancy.percent}%` : 'Thiếu dữ liệu'}</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${occupancy.percent}%`, background: barColor, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', marginBottom: '0.875rem' }}>
                  <div style={{ color: '#64748b' }}>👤 {sz.contact_person || '—'}</div>
                  <a href={`tel:${sz.contact_phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>📞 {sz.contact_phone || '—'}</a>
                  <div style={{ gridColumn: '1/-1', color: '#94a3b8', fontSize: '0.68rem' }}>📍 {sz.address}</div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditZone(sz); setShowForm(true); }}>
                    <Edit2 size={13} /> Sửa
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Xóa điểm sơ tán?')) { deleteSafeZone(sz.id); toast.success('Đã xóa!'); } }}>
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
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{editZone ? 'Cập nhật điểm sơ tán' : 'Thêm điểm sơ tán'}</h3>
              <button onClick={() => { setShowForm(false); setEditZone(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <SafeZoneForm initial={editZone} onSave={handleSave} onClose={() => { setShowForm(false); setEditZone(null); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
