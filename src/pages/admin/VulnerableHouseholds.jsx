import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Search } from 'lucide-react';
import { AREAS } from '../../data/publicData';

export default function VulnerableHouseholds() {
  const { vulnerableHouseholds, citizenProfiles, users } = useData();
  const [filterArea, setFilterArea] = useState('');
  const [filterType, setFilterType] = useState('');

  const enriched = vulnerableHouseholds.map(vh => {
    const profile = citizenProfiles.find(cp => cp.id === vh.citizen_profile_id);
    const user = profile ? users.find(u => u.id === profile.user_id) : null;
    const area = AREAS.find(a => a.id === vh.area_id);
    return { ...vh, profile, user, area };
  });

  const filtered = enriched.filter(vh => {
    if (filterArea && vh.area_id !== filterArea) return false;
    if (filterType && !vh.risk_types?.includes(filterType)) return false;
    return true;
  });

  const RISK_TYPE_INFO = {
    elderly: { icon: '👴', label: 'Người già', color: '#f59e0b', bg: '#fefce8' },
    children: { icon: '👶', label: 'Trẻ em', color: '#3b82f6', bg: '#eff6ff' },
    disabled: { icon: '♿', label: 'Khuyết tật', color: '#8b5cf6', bg: '#f5f3ff' },
    medical: { icon: '🏥', label: 'Bệnh nhân', color: '#ef4444', bg: '#fef2f2' },
  };

  const PRIORITY_COLORS = { 1: '#ef4444', 2: '#f59e0b', 3: '#3b82f6' };
  const PRIORITY_LABELS = { 1: 'Ưu tiên 1 - Khẩn cấp', 2: 'Ưu tiên 2 - Cao', 3: 'Ưu tiên 3 - Trung bình' };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Hộ dễ bị tổn thương</h1><p className="page-subtitle">Danh sách ưu tiên cứu hộ</p></div>
        <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '0.375rem 0.875rem', fontSize: '0.82rem', fontWeight: 700 }}>
          ⚠️ {vulnerableHouseholds.length} hộ cần ưu tiên
        </span>
      </div>

      {/* Risk type summary */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {Object.entries(RISK_TYPE_INFO).map(([key, info]) => (
          <button key={key} onClick={() => setFilterType(filterType === key ? '' : key)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', borderRadius: 8, border: `2px solid ${filterType === key ? info.color : '#e2e8f0'}`, background: filterType === key ? info.bg : 'white', cursor: 'pointer' }}>
            <span style={{ fontSize: '1rem' }}>{info.icon}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: info.color }}>{info.label}</span>
            <span style={{ background: info.color, color: 'white', borderRadius: '9999px', padding: '0px 6px', fontSize: '0.65rem', fontWeight: 700 }}>
              {vulnerableHouseholds.filter(vh => vh.risk_types?.includes(key)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <select className="form-input form-select" style={{ width: 170 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">Tất cả khu vực</option>
          {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {filtered.sort((a, b) => a.priority_level - b.priority_level).map(vh => (
          <div key={vh.id} className="card" style={{ borderLeft: `4px solid ${PRIORITY_COLORS[vh.priority_level] || '#94a3b8'}` }}>
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{vh.household_name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {vh.area?.old_name || vh.area_name}</div>
                </div>
                <span style={{ background: `${PRIORITY_COLORS[vh.priority_level]}15`, color: PRIORITY_COLORS[vh.priority_level], borderRadius: 8, padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {PRIORITY_LABELS[vh.priority_level]}
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.625rem' }}>📍 {vh.address}</div>

              <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {vh.risk_types?.map(type => {
                  const info = RISK_TYPE_INFO[type];
                  if (!info) return null;
                  return (
                    <span key={type} style={{ background: info.bg, color: info.color, borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 }}>
                      {info.icon} {info.label}
                    </span>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', marginBottom: '0.625rem' }}>
                <div style={{ background: '#f8fafc', borderRadius: 6, padding: '0.375rem 0.625rem' }}>👥 {vh.household_size} nhân khẩu</div>
              </div>

              {vh.note && <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', borderTop: '1px solid #f1f5f9', paddingTop: '0.625rem', marginTop: '0.5rem' }}>📝 {vh.note}</div>}

              {vh.user?.phone && (
                <div style={{ marginTop: '0.75rem' }}>
                  <a href={`tel:${vh.user.phone}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem' }}>📞 {vh.user.phone}</a>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            Không tìm thấy hộ dễ tổn thương nào
          </div>
        )}
      </div>
    </div>
  );
}
