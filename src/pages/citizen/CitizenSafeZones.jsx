import { useData } from '../../contexts/DataContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Building2, Phone } from 'lucide-react';
import { getPublicSafeZones, getSafeZoneOccupancy } from '../../utils/safeZones';

export default function CitizenSafeZones() {
  const { safeZones } = useData();
  const publicSafeZones = getPublicSafeZones(safeZones);
  const available = publicSafeZones.filter(s => s.status === 'AVAILABLE');

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title"><Building2 size={22} color="#10b981" /> Điểm sơ tán</h1><p className="page-subtitle">Tìm điểm sơ tán an toàn gần bạn</p></div>
        <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 8, padding: '0.375rem 0.875rem', fontSize: '0.82rem', fontWeight: 600 }}>
          🏫 {available.length}/{publicSafeZones.length} điểm còn chỗ
        </span>
      </div>

      {available.length === 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#dc2626' }}>
          ⚠️ Tất cả điểm sơ tán hiện đã đầy. Hãy liên hệ Ban PCTT để được hỗ trợ: <strong>0693 851 000</strong>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {publicSafeZones.map(sz => {
          const occupancy = getSafeZoneOccupancy(sz);
          const barColor = occupancy.percent >= 95 ? '#ef4444' : occupancy.percent >= 75 ? '#f59e0b' : '#10b981';
          return (
            <div key={sz.id} className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>🏫 {sz.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {sz.area_name}</div>
                </div>
                <StatusBadge status={sz.status} />
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Đang có: {occupancy.current_people}/{occupancy.capacity} người</span>
                    <span style={{ fontWeight: 700, color: barColor }}>{occupancy.percent}%</span>
                  </div>
                  <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${occupancy.percent}%`, background: barColor, borderRadius: 5 }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>📍 {sz.address}</div>
                {sz.contact_phone && (
                  <a href={`tel:${sz.contact_phone}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex' }}>
                    <Phone size={13} /> {sz.contact_phone}
                  </a>
                )}
                {sz.status === 'AVAILABLE' && (
                  <div style={{ marginTop: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.625rem', fontSize: '0.75rem', color: '#15803d' }}>
                    ✅ Còn {occupancy.availableSlots} chỗ trống
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
