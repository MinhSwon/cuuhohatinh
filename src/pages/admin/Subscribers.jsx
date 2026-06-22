import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Search, Filter, X } from 'lucide-react';

export default function Subscribers() {
  const { citizenProfiles, users, areas } = useData();
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('');

  const enriched = citizenProfiles.map(cp => {
    const user = users.find(u => u.id === cp.user_id);
    const area = areas.find(a => a.id === cp.area_id);
    return { ...cp, user, area };
  });

  const filtered = enriched.filter(cp => {
    if (filterArea && cp.area_id !== filterArea) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!cp.user?.full_name?.toLowerCase().includes(q) && !cp.user?.phone?.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Quản lý người dân</h1><p className="page-subtitle">Danh sách người đăng ký nhận cảnh báo</p></div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '0.375rem 0.875rem', fontSize: '0.82rem', fontWeight: 600 }}>👥 {citizenProfiles.length} người đăng ký</span>
        </div>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" placeholder="Tìm tên, SĐT..." style={{ paddingLeft: 30, width: 220 }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input form-select" style={{ width: 170 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">Tất cả khu vực</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Số điện thoại</th>
                <th>Khu vực</th>
                <th>Thôn/Xóm</th>
                <th>Nhân khẩu</th>
                <th>Đặc điểm</th>
                <th>Nhận SMS</th>
                <th>Liên hệ khẩn cấp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cp => (
                <tr key={cp.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{cp.user?.full_name || '—'}</div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{cp.user?.email || ''}</div>
                  </td>
                  <td><a href={`tel:${cp.user?.phone}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.78rem' }}>{cp.user?.phone}</a></td>
                  <td style={{ fontSize: '0.78rem' }}>{cp.area?.old_name || '—'}</td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{cp.village_name || '—'}</td>
                  <td style={{ fontSize: '0.78rem', textAlign: 'center', fontWeight: 600 }}>{cp.household_size}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {cp.elderly_count > 0 && <span title={`${cp.elderly_count} người già`} style={{ fontSize: '0.9rem' }}>👴</span>}
                      {cp.children_count > 0 && <span title={`${cp.children_count} trẻ em`} style={{ fontSize: '0.9rem' }}>👶</span>}
                      {cp.disabled_count > 0 && <span title={`${cp.disabled_count} người khuyết tật`} style={{ fontSize: '0.9rem' }}>♿</span>}
                      {cp.medical_note && <span title="Có vấn đề y tế" style={{ fontSize: '0.9rem' }}>🏥</span>}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: cp.sms_opt_in ? '#10b981' : '#94a3b8' }}>
                      {cp.sms_opt_in ? '✅ Có' : '❌ Không'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.72rem' }}>
                    <div>{cp.emergency_contact_name || '—'}</div>
                    <div style={{ color: '#94a3b8' }}>{cp.emergency_contact_phone}</div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
