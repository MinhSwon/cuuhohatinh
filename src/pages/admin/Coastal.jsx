import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Anchor, AlertTriangle, Ship, Compass, Waves, Plus, Bell, Clock, MapPin } from 'lucide-react';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';

export default function CoastalWarnings() {
  const { floodWarnings, createWarning, areas } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    content: '',
    level: 'HIGH',
    area_id: '',
    alert_type: 'LANDSLIDE', // LANDSLIDE or COASTAL
    vessels_count: '',
    duration_hours: '24',
  });

  // Filter warnings to display only coastal and landslide alerts
  const coastalAndLandslideAlerts = floodWarnings.filter(w => 
    w.title.includes('sạt lở') || 
    w.title.includes('Bão') || 
    w.title.includes('Tàu thuyền') || 
    w.title.includes('triều cường') ||
    w.title.includes('neo đậu') ||
    w.alert_type === 'COASTAL' ||
    w.alert_type === 'LANDSLIDE'
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.area_id) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc!');
      return;
    }

    const area = areas.find(a => a.id === form.area_id);
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + Number(form.duration_hours) * 60 * 60 * 1000).toISOString();

    const formattedTitle = `${form.alert_type === 'LANDSLIDE' ? '⚠️ [SẠT LỞ/LŨ QUÉT]' : '⚓ [VEN BIỂN/TÀU THUYỀN]'} ${form.title}`;

    createWarning({
      title: formattedTitle,
      content: `${form.content} ${form.vessels_count ? `(Số phương tiện/tàu thuyền bị ảnh hưởng dự kiến: ${form.vessels_count}).` : ''}`,
      level: form.level,
      area_id: form.area_id,
      area_name: area?.old_name || 'Hương Khê',
      start_time: startTime,
      end_time: endTime,
      status: 'PUBLISHED',
      alert_type: form.alert_type,
      created_by: currentUser?.id || 'admin',
    });

    toast.success('Đã xuất bản cảnh báo khẩn cấp mới thành công!');
    setForm({
      title: '',
      content: '',
      level: 'HIGH',
      area_id: '',
      alert_type: 'LANDSLIDE',
      vessels_count: '',
      duration_hours: '24',
    });
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Anchor size={22} color="var(--accent)" /> Cảnh báo sạt lở & Ven biển
          </h1>
          <p className="page-subtitle">Giám sát và phát hành cảnh báo nguy cơ sạt lở núi, lũ quét và tàu thuyền ven biển Hà Tĩnh</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.5rem' }}>
        {/* Left side: Publish form */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            <Plus size={16} /> Phát hành cảnh báo
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label className="form-label">Loại thiên tai *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, alert_type: 'LANDSLIDE' }))}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.alert_type === 'LANDSLIDE' ? 'var(--warning-muted)' : 'var(--border-medium)'}`,
                    background: form.alert_type === 'LANDSLIDE' ? 'var(--warning-light)' : 'var(--bg-surface)',
                    color: form.alert_type === 'LANDSLIDE' ? 'var(--warning)' : 'var(--text-secondary)',
                  }}
                >
                  ⛰️ Sạt lở / Lũ quét
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, alert_type: 'COASTAL' }))}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.alert_type === 'COASTAL' ? 'var(--accent)' : 'var(--border-medium)'}`,
                    background: form.alert_type === 'COASTAL' ? 'var(--accent-light)' : 'var(--bg-surface)',
                    color: form.alert_type === 'COASTAL' ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  ⚓ Ven biển / Tàu thuyền
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Tiêu đề cảnh báo *</label>
              <input
                type="text"
                className="form-input"
                placeholder={form.alert_type === 'LANDSLIDE' ? 'Ví dụ: Nguy cơ sạt lở đồi dốc xã Hà Linh' : 'Ví dụ: Cấm biển, neo đậu thuyền bè phòng bão'}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Khu vực ảnh hưởng *</label>
                <select
                  className="form-input form-select"
                  value={form.area_id}
                  onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}
                  required
                >
                  <option value="">-- Chọn --</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Mức độ khẩn cấp</label>
                <select
                  className="form-input form-select"
                  value={form.level}
                  onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                >
                  <option value="LOW">Mức thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Mức cao</option>
                  <option value="EMERGENCY">Khẩn cấp 🚨</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">
                {form.alert_type === 'LANDSLIDE' ? 'Số hộ dân bị ảnh hưởng (dự kiến)' : 'Số tàu thuyền neo đậu ảnh hưởng'}
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ví dụ: 30 hộ dân hoặc 15 tàu cá"
                value={form.vessels_count}
                onChange={e => setForm(f => ({ ...f, vessels_count: e.target.value }))}
              />
            </div>

            <div>
              <label className="form-label">Thời hạn cảnh báo (Giờ hiệu lực)</label>
              <select
                className="form-input form-select"
                value={form.duration_hours}
                onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
              >
                <option value="12">12 giờ</option>
                <option value="24">24 giờ (1 ngày)</option>
                <option value="48">48 giờ (2 ngày)</option>
                <option value="72">72 giờ (3 ngày)</option>
              </select>
            </div>

            <div>
              <label className="form-label">Nội dung chi tiết cảnh báo *</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Điền hướng dẫn phòng tránh, thông tin đường đi của bão, khu vực đồi núi sạt trượt..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                required
                style={{ resize: 'none' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '0.625rem' }}>
              <Bell size={15} /> Xuất bản cảnh báo
            </button>
          </form>
        </div>

        {/* Right side: Warnings list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} color="var(--warning)" /> Danh sách cảnh báo đặc thù đang hoạt động ({coastalAndLandslideAlerts.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
            {coastalAndLandslideAlerts.map(alert => {
              const isLandslide = alert.title.includes('SẠT LỞ');
              return (
                <div key={alert.id} className="card" style={{ borderLeft: `4px solid ${alert.level === 'EMERGENCY' ? 'var(--danger)' : 'var(--warning)'}` }}>
                  <div style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <LevelBadge level={alert.level} />
                        <span style={{ fontSize: '0.72rem', background: isLandslide ? 'var(--warning-light)' : 'var(--accent-light)', color: isLandslide ? 'var(--warning)' : 'var(--accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          {isLandslide ? '⛰️ SẠT LỞ' : '⚓ VEN BIỂN'}
                        </span>
                        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {alert.title.replace('⚠️ [SẠT LỞ/LŨ QUÉT] ', '').replace('⚓ [VEN BIỂN/TÀU THUYỀN] ', '')}
                        </h4>
                      </div>
                      <StatusBadge status={alert.status} />
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      {alert.content}
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={12} /> {alert.area_name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> Từ: {new Date(alert.start_time).toLocaleString('vi-VN')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> Đến: {new Date(alert.end_time).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {coastalAndLandslideAlerts.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                🏕️ Chưa có tin cảnh báo đặc thù nào đang được xuất bản.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
