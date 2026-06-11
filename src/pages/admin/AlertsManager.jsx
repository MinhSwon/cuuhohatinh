import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Edit2, Trash2, Bell, Send, Eye, Filter, Search, X } from 'lucide-react';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import { AREAS } from '../../data/publicData';

const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
const LEVEL_LABELS = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', EMERGENCY: 'Khẩn cấp' };
const STATUS_LABELS_W = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', EXPIRED: 'Hết hiệu lực', CANCELLED: 'Đã hủy' };

function WarningForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    title: '', content: '', level: 'MEDIUM', area_id: '', status: 'DRAFT',
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tiêu đề cảnh báo *</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="VD: Cảnh báo lũ khẩn cấp tại Hà Linh" />
        </div>
        <div>
          <label className="form-label">Khu vực ảnh hưởng *</label>
          <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} required>
            <option value="">-- Chọn khu vực --</option>
            {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Mức độ cảnh báo *</label>
          <select className="form-input form-select" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
            {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Thời gian bắt đầu</label>
          <input type="datetime-local" className="form-input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Thời gian kết thúc</label>
          <input type="datetime-local" className="form-input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Nội dung cảnh báo *</label>
          <textarea className="form-input" rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required placeholder="Mô tả tình trạng lũ lụt và hướng dẫn cho người dân..." style={{ resize: 'vertical' }} />
        </div>
        <div>
          <label className="form-label">Trạng thái</label>
          <select className="form-input form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Công bố ngay</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
        <button type="submit" className="btn btn-primary">
          <Bell size={16} /> {initial ? 'Cập nhật' : 'Tạo cảnh báo'}
        </button>
      </div>
    </form>
  );
}

export default function AlertsManager() {
  const { floodWarnings, createWarning, updateWarning, deleteWarning, addSmsLog, addLog } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editWarning, setEditWarning] = useState(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [search, setSearch] = useState('');
  const [viewWarning, setViewWarning] = useState(null);

  const filtered = floodWarnings.filter(w => {
    if (filterLevel && w.level !== filterLevel) return false;
    if (filterStatus && w.status !== filterStatus) return false;
    if (filterArea && w.area_id !== filterArea) return false;
    if (search && !w.title.toLowerCase().includes(search.toLowerCase()) && !w.area_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (form) => {
    const area = AREAS.find(a => a.id === form.area_id);
    if (editWarning) {
      await updateWarning(editWarning.id, { ...form, area_name: area?.old_name });
      toast.success('Đã cập nhật cảnh báo!');
      addLog(currentUser?.id, currentUser?.full_name, 'Cập nhật cảnh báo', 'flood_warnings', editWarning.id, `Cập nhật: ${form.title}`);
    } else {
      const w = await createWarning({ ...form, area_name: area?.old_name, created_by: currentUser?.id });
      toast.success('Đã tạo cảnh báo mới!');
      addLog(currentUser?.id, currentUser?.full_name, 'Tạo cảnh báo', 'flood_warnings', w.id, form.title);
    }
    setShowForm(false);
    setEditWarning(null);
  };

  const handlePublish = (w) => {
    updateWarning(w.id, { status: 'PUBLISHED' });
    toast.success('Đã công bố cảnh báo!');
    addLog(currentUser?.id, currentUser?.full_name, 'Công bố cảnh báo', 'flood_warnings', w.id, w.title);
  };

  const handleSendSMS = (w) => {
    const mockPhones = Array.from({ length: 5 }, (_, index) => `recipient-${index + 1}`);
    mockPhones.forEach(phone => {
      addSmsLog({
        phone,
        message: `CANH BAO LU [${w.level}]: ${w.title.substring(0, 60)}. Khu vuc: ${w.area_name}. Thoi gian: ${new Date(w.start_time).toLocaleString('vi-VN')}`,
        provider: 'Viettel SMS',
        status: Math.random() > 0.1 ? 'SENT' : 'FAILED',
        cost: 500,
        related_warning_id: w.id,
        related_request_id: null,
      });
    });
    updateWarning(w.id, { sms_sent: true, sms_count: (w.sms_count || 0) + mockPhones.length });
    toast.success(`Đã gửi SMS cho ${mockPhones.length} người dân!`);
    addLog(currentUser?.id, currentUser?.full_name, 'Gửi SMS cảnh báo', 'sms_logs', w.id, `Gửi ${mockPhones.length} SMS cho ${w.area_name}`);
  };

  const handleDelete = (w) => {
    if (window.confirm('Xóa cảnh báo này?')) {
      deleteWarning(w.id);
      toast.success('Đã xóa cảnh báo!');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý cảnh báo lũ</h1>
          <p className="page-subtitle">Tạo và quản lý cảnh báo lũ cho các khu vực Hương Khê</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditWarning(null); setShowForm(true); }}>
          <Plus size={16} /> Tạo cảnh báo mới
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" placeholder="Tìm kiếm..." style={{ paddingLeft: 30, width: 200 }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input form-select" style={{ width: 150 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">Tất cả khu vực</option>
          {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
        </select>
        <select className="form-input form-select" style={{ width: 150 }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Tất cả mức độ</option>
          {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
        <select className="form-input form-select" style={{ width: 150 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS_W).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filterLevel || filterStatus || filterArea || search) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilterLevel(''); setFilterStatus(''); setFilterArea(''); setSearch(''); }}>
            <X size={14} /> Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Đang công bố', count: floodWarnings.filter(w => w.status === 'PUBLISHED').length, color: '#3b82f6' },
          { label: 'Bản nháp', count: floodWarnings.filter(w => w.status === 'DRAFT').length, color: '#94a3b8' },
          { label: 'Hết hiệu lực', count: floodWarnings.filter(w => w.status === 'EXPIRED').length, color: '#d1d5db' },
          { label: 'Tổng', count: floodWarnings.length, color: '#374151' },
        ].map(s => (
          <div key={s.label} style={{ padding: '0.5rem 0.875rem', background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.count}</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tiêu đề cảnh báo</th>
                <th>Khu vực</th>
                <th>Mức độ</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>SMS</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Không có cảnh báo nào</td></tr>
              ) : filtered.map(w => (
                <tr key={w.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0f172a', maxWidth: 240 }}>{w.title}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{w.id.toUpperCase()}</div>
                  </td>
                  <td style={{ fontSize: '0.78rem' }}>{w.area_name}</td>
                  <td><LevelBadge level={w.level} /></td>
                  <td><StatusBadge status={w.status} /></td>
                  <td style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    <div>{new Date(w.start_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    <div style={{ color: '#94a3b8' }}>→ {new Date(w.end_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
                  </td>
                  <td>
                    {w.sms_sent
                      ? <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>✅ {w.sms_count} tin</span>
                      : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Chưa gửi</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewWarning(w)} title="Xem"><Eye size={14} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditWarning(w); setShowForm(true); }} title="Sửa"><Edit2 size={14} /></button>
                      {w.status === 'DRAFT' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handlePublish(w)} title="Công bố"><Bell size={14} /> Công bố</button>
                      )}
                      {w.status === 'PUBLISHED' && (
                        <button className="btn btn-warning btn-sm" onClick={() => handleSendSMS(w)} title="Gửi SMS"><Send size={14} /> SMS</button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(w)} title="Xóa"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{editWarning ? 'Cập nhật cảnh báo' : 'Tạo cảnh báo mới'}</h3>
              <button onClick={() => { setShowForm(false); setEditWarning(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <WarningForm initial={editWarning} onSave={handleSave} onClose={() => { setShowForm(false); setEditWarning(null); }} />
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewWarning && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewWarning(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Chi tiết cảnh báo</h3>
              <button onClick={() => setViewWarning(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <LevelBadge level={viewWarning.level} />
                <StatusBadge status={viewWarning.status} />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {viewWarning.area_name}</span>
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>{viewWarning.title}</h2>
              <p style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.6, marginBottom: '1rem' }}>{viewWarning.content}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                <div>🕐 Bắt đầu: <strong>{new Date(viewWarning.start_time).toLocaleString('vi-VN')}</strong></div>
                <div>🕐 Kết thúc: <strong>{new Date(viewWarning.end_time).toLocaleString('vi-VN')}</strong></div>
                <div>📱 SMS đã gửi: <strong style={{ color: viewWarning.sms_sent ? '#10b981' : '#94a3b8' }}>{viewWarning.sms_sent ? `${viewWarning.sms_count} tin` : 'Chưa gửi'}</strong></div>
                <div>📅 Tạo lúc: <strong>{new Date(viewWarning.created_at).toLocaleString('vi-VN')}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
