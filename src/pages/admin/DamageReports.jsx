import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Plus, X, Home, Users, Wheat, Landmark, ShieldAlert } from 'lucide-react';

const DAMAGE_TYPES = ['Nhà cửa', 'Tài sản', 'Đường sá', 'Cầu cống', 'Nông nghiệp', 'Người bị thương', 'Thủy lợi/Hồ chứa'];
const SEVERITY_LABELS = { LOW: 'Nhẹ', MEDIUM: 'Trung bình', HIGH: 'Nặng', EMERGENCY: 'Nghiêm trọng' };
const SEVERITY_COLORS = { LOW: '#3b82f6', MEDIUM: '#f59e0b', HIGH: '#f97316', EMERGENCY: '#ef4444' };

export default function DamageReports() {
  const { damageReports, createDamageReport, areas } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  
  const [form, setForm] = useState({
    area_id: '',
    damage_type: '',
    description: '',
    severity: 'MEDIUM',
    reporter_name: '',
    house_collapsed: 0,
    house_flooded: 0,
    crop_flooded_ha: 0,
    casualties_deceased: 0,
    casualties_missing: 0,
    casualties_injured: 0,
    estimated_loss_billion: 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.area_id || !form.damage_type || !form.description.trim()) {
      toast.error('Vui lòng nhập đầy đủ các thông tin bắt buộc!');
      return;
    }

    const area = areas.find(a => a.id === form.area_id);
    createDamageReport({
      ...form,
      area_name: area?.old_name || 'Hương Khê',
      reporter_id: currentUser?.id,
      reporter_name: currentUser?.full_name || form.reporter_name || 'Ẩn danh',
    });

    toast.success('Đã xuất bản báo cáo thiệt hại định lượng thành công!');
    setShowForm(false);
    setForm({
      area_id: '',
      damage_type: '',
      description: '',
      severity: 'MEDIUM',
      reporter_name: '',
      house_collapsed: 0,
      house_flooded: 0,
      crop_flooded_ha: 0,
      casualties_deceased: 0,
      casualties_missing: 0,
      casualties_injured: 0,
      estimated_loss_billion: 0,
    });
  };

  // Compute aggregated totals
  const totalCollapsed = damageReports.reduce((sum, dr) => sum + (Number(dr.house_collapsed) || 0), 0);
  const totalFlooded = damageReports.reduce((sum, dr) => sum + (Number(dr.house_flooded) || 0), 0);
  const totalCropHa = damageReports.reduce((sum, dr) => sum + (Number(dr.crop_flooded_ha) || 0), 0);
  const totalDeceased = damageReports.reduce((sum, dr) => sum + (Number(dr.casualties_deceased) || 0), 0);
  const totalMissing = damageReports.reduce((sum, dr) => sum + (Number(dr.casualties_missing) || 0), 0);
  const totalInjured = damageReports.reduce((sum, dr) => sum + (Number(dr.casualties_injured) || 0), 0);
  const totalLoss = damageReports.reduce((sum, dr) => sum + (Number(dr.estimated_loss_billion) || 0), 0);

  const stats = [
    { label: 'Tổng thương vong', value: `${totalDeceased + totalMissing + totalInjured} người`, subtext: `${totalDeceased} chết, ${totalMissing} mất tích, ${totalInjured} bị thương`, icon: Users, color: '#ef4444', bg: '#fef2f2' },
    { label: 'Nhà cửa bị hại', value: `${totalCollapsed + totalFlooded} căn`, subtext: `${totalCollapsed} sập hoàn toàn, ${totalFlooded} bị ngập`, icon: Home, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Nông nghiệp thiệt hại', value: `${totalCropHa} ha`, subtext: 'Diện tích hoa màu bị ngập úng', icon: Wheat, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Giá trị thiệt hại', value: `${totalLoss} tỷ VNĐ`, subtext: 'Ước tính giá trị thiệt hại kinh tế', icon: Landmark, color: '#a0731a', bg: '#fefce8' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo thiệt hại thiên tai</h1>
          <p className="page-subtitle">Ghi nhận và tổng hợp số liệu thiệt hại định lượng của toàn huyện Hương Khê</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Thêm báo cáo thiệt hại
        </button>
      </div>

      {/* Aggregate Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {stats.map((s, idx) => (
          <div key={idx} className="stat-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                  {s.label}
                </p>
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {s.value}
                </p>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {s.subtext}
                </p>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyCenter: 'center', flexShrink: 0, alignSelf: 'center', justifyContent: 'center' }}>
                <s.icon size={20} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {damageReports.map(dr => {
          const color = SEVERITY_COLORS[dr.severity] || '#374151';
          const hasQuantitativeData = dr.house_collapsed > 0 || dr.house_flooded > 0 || dr.crop_flooded_ha > 0 || dr.casualties_deceased > 0 || dr.casualties_missing > 0 || dr.casualties_injured > 0 || dr.estimated_loss_billion > 0;
          
          return (
            <div key={dr.id} className="card" style={{ borderLeft: `4px solid ${color}` }}>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', fontFamily: 'var(--font-heading)' }}>{dr.damage_type}</span>
                  <span style={{ background: `${color}15`, color, borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{SEVERITY_LABELS[dr.severity]}</span>
                  <span style={{ background: dr.status === 'CONFIRMED' ? '#d1fae5' : '#f1f5f9', color: dr.status === 'CONFIRMED' ? '#065f46' : '#64748b', borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem' }}>
                    {dr.status === 'CONFIRMED' ? '✅ Đã xác nhận' : '⏳ Chờ xử lý'}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  {dr.description}
                </p>

                {/* Show quantitative metrics box */}
                {hasQuantitativeData && (
                  <div style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    fontSize: '0.75rem'
                  }}>
                    {((dr.casualties_deceased || 0) + (dr.casualties_missing || 0) + (dr.casualties_injured || 0)) > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>👥 Thương vong:</span>
                        <div style={{ fontWeight: 600, color: '#ef4444' }}>
                          {dr.casualties_deceased || 0} chết, {dr.casualties_missing || 0} mất tích, {dr.casualties_injured || 0} bị thương
                        </div>
                      </div>
                    )}
                    {((dr.house_collapsed || 0) + (dr.house_flooded || 0)) > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>🏠 Nhà cửa hại:</span>
                        <div style={{ fontWeight: 600 }}>
                          {dr.house_collapsed || 0} sập, {dr.house_flooded || 0} ngập
                        </div>
                      </div>
                    )}
                    {(dr.crop_flooded_ha || 0) > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>🌾 Hoa màu ngập:</span>
                        <div style={{ fontWeight: 600, color: '#10b981' }}>
                          {dr.crop_flooded_ha} ha
                        </div>
                      </div>
                    )}
                    {(dr.estimated_loss_billion || 0) > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>💰 Thiệt hại kinh tế:</span>
                        <div style={{ fontWeight: 600, color: 'var(--warning)' }}>
                          {dr.estimated_loss_billion} tỷ VNĐ
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>📍 {dr.area_name}</span>
                  <span>👤 {dr.reporter_name}</span>
                  <span>🕐 {new Date(dr.created_at).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>
          );
        })}
        {damageReports.length === 0 && (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có báo cáo thiệt hại nào</div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>Khai báo thiệt hại định lượng mới</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="form-label">Khu vực xảy ra *</label>
                  <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} required>
                    <option value="">-- Chọn khu vực --</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Loại thiệt hại chính *</label>
                  <select className="form-input form-select" value={form.damage_type} onChange={e => setForm(f => ({ ...f, damage_type: e.target.value }))} required>
                    <option value="">-- Chọn loại --</option>
                    {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="form-label">Mức độ thiệt hại</label>
                  <select className="form-input form-select" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                    {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Họ tên người báo cáo</label>
                  <input className="form-input" value={form.reporter_name} onChange={e => setForm(f => ({ ...f, reporter_name: e.target.value }))} placeholder="Bỏ trống nếu báo cáo ẩn danh" />
                </div>
              </div>

              {/* Quantitative Metrics Section */}
              <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <ShieldAlert size={14} color="var(--warning)" /> Số liệu định lượng (nếu có)
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">Số nhà sập hoàn toàn</label>
                    <input type="number" min="0" className="form-input" value={form.house_collapsed} onChange={e => setForm(f => ({ ...f, house_collapsed: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="form-label">Số nhà bị ngập</label>
                    <input type="number" min="0" className="form-input" value={form.house_flooded} onChange={e => setForm(f => ({ ...f, house_flooded: Number(e.target.value) }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">Hoa màu ngập úng (ha)</label>
                    <input type="number" step="0.1" min="0" className="form-input" value={form.crop_flooded_ha} onChange={e => setForm(f => ({ ...f, crop_flooded_ha: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="form-label">Ước tính thiệt hại (tỷ VNĐ)</label>
                    <input type="number" step="0.01" min="0" className="form-input" value={form.estimated_loss_billion} onChange={e => setForm(f => ({ ...f, estimated_loss_billion: Number(e.target.value) }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="form-label" style={{ color: '#ef4444' }}>Số người chết</label>
                    <input type="number" min="0" className="form-input" value={form.casualties_deceased} onChange={e => setForm(f => ({ ...f, casualties_deceased: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="form-label" style={{ color: '#f97316' }}>Số người mất tích</label>
                    <input type="number" min="0" className="form-input" value={form.casualties_missing} onChange={e => setForm(f => ({ ...f, casualties_missing: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="form-label" style={{ color: '#3b82f6' }}>Số người bị thương</label>
                    <input type="number" min="0" className="form-input" value={form.casualties_injured} onChange={e => setForm(f => ({ ...f, casualties_injured: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Mô tả tình trạng chi tiết *</label>
                <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="Mô tả cụ thể vị trí, tình trạng thiệt hại và kiến nghị hỗ trợ..." style={{ resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Xuất bản báo cáo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
