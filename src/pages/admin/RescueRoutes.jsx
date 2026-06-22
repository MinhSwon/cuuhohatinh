import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

function RouteForm({ initial, onSave, onClose, areas }) {
  const [form, setForm] = useState(initial || {
    name: '', area_id: '', start_point: '', end_point: '',
    safety_level: 'SAFE', status: 'OPEN', note: ''
  });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tên tuyến đường *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="form-label">Khu vực</label>
          <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}>
            <option value="">-- Chọn khu vực --</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Mức độ an toàn</label>
          <select className="form-input form-select" value={form.safety_level} onChange={e => setForm(f => ({ ...f, safety_level: e.target.value }))}>
            <option value="SAFE">An toàn</option>
            <option value="MEDIUM">Cẩn thận</option>
            <option value="DANGEROUS">Nguy hiểm</option>
          </select>
        </div>
        <div>
          <label className="form-label">Trạng thái</label>
          <select className="form-input form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="OPEN">Thông thoáng</option>
            <option value="CAUTION">Cảnh báo</option>
            <option value="FLOODED">Bị ngập</option>
          </select>
        </div>
        <div>
          <label className="form-label">Điểm bắt đầu</label>
          <input className="form-input" value={form.start_point} onChange={e => setForm(f => ({ ...f, start_point: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Điểm kết thúc</label>
          <input className="form-input" value={form.end_point} onChange={e => setForm(f => ({ ...f, end_point: e.target.value }))} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Ghi chú</label>
          <textarea className="form-input" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ resize: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button type="submit" className="btn btn-primary">{initial ? 'Cập nhật' : 'Thêm tuyến'}</button>
      </div>
    </form>
  );
}

export default function RescueRoutes() {
  const { rescueRoutes, createRoute, updateRoute, deleteRoute, areas } = useData();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editRoute, setEditRoute] = useState(null);

  const SAFETY_COLORS = { SAFE: '#10b981', MEDIUM: '#f59e0b', DANGEROUS: '#ef4444' };
  const STATUS_DISPLAY = { OPEN: { label: '🟢 Thông thoáng', bg: '#f0fdf4', color: '#15803d' }, CAUTION: { label: '🟡 Cẩn thận', bg: '#fefce8', color: '#854d0e' }, FLOODED: { label: '🔴 Bị ngập', bg: '#fef2f2', color: '#991b1b' } };

  const handleSave = (form) => {
    const area = areas.find(a => a.id === form.area_id);
    if (editRoute) { updateRoute(editRoute.id, { ...form, area_name: area?.old_name }); toast.success('Đã cập nhật!'); }
    else { createRoute({ ...form, area_name: area?.old_name }); toast.success('Đã thêm tuyến!'); }
    setShowForm(false); setEditRoute(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Tuyến đường cứu hộ</h1><p className="page-subtitle">Quản lý và theo dõi trạng thái tuyến đường</p></div>
        <button className="btn btn-primary" onClick={() => { setEditRoute(null); setShowForm(true); }}><Plus size={16} /> Thêm tuyến đường</button>
      </div>

      <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
        {rescueRoutes.map(route => {
          const st = STATUS_DISPLAY[route.status] || STATUS_DISPLAY.OPEN;
          return (
            <div key={route.id} className="card" style={{ flex: '1 1 300px', maxWidth: 400 }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>🛣️ {route.name}</div>
                <span style={{ background: st.bg, color: st.color, borderRadius: '9999px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 600 }}>{st.label}</span>
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>📍 {route.area_name}</div>
                <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>Từ:</span> {route.start_point} → {route.end_point}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: `${SAFETY_COLORS[route.safety_level]}15`, marginBottom: '0.75rem' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: SAFETY_COLORS[route.safety_level] }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: SAFETY_COLORS[route.safety_level] }}>{route.safety_level === 'SAFE' ? 'An toàn' : route.safety_level === 'MEDIUM' ? 'Cẩn thận' : 'Nguy hiểm'}</span>
                </div>
                {route.note && <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginBottom: '0.75rem' }}>📝 {route.note}</div>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditRoute(route); setShowForm(true); }}><Edit2 size={13} /> Sửa</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('Xóa tuyến đường?')) { deleteRoute(route.id); toast.success('Đã xóa!'); } }}><Trash2 size={13} /></button>
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
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{editRoute ? 'Cập nhật tuyến' : 'Thêm tuyến đường'}</h3>
              <button onClick={() => { setShowForm(false); setEditRoute(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <RouteForm initial={editRoute} onSave={handleSave} onClose={() => { setShowForm(false); setEditRoute(null); }} areas={areas} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
