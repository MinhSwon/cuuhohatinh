import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Eye, UserCheck, X, Filter, ChevronDown, AlertTriangle, Phone, MapPin, Users } from 'lucide-react';
import { StatusBadge, LevelBadge } from '../../components/common/StatusBadge';
import {
  getAssignmentWarnings,
  getRequestAddress,
  getRequestName,
  getRequestPhone,
  getTeamRecommendations,
  isNeedsVerification,
} from '../../utils/rescueCoordination';

const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
const STATUS_FILTER_OPTIONS = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'MOVING', 'NEAR_VICTIM', 'ARRIVED_CONFIRMED', 'RESCUING', 'RESCUED', 'UNREACHABLE', 'NEED_SUPPORT', 'CANCELLED'];

function AssignModal({ request, teams, missions = [], onAssign, onClose }) {
  const [selectedTeam, setSelectedTeam] = useState('');
  const availableTeams = teams.filter(t => !['OFFLINE', 'MAINTENANCE', 'INACTIVE'].includes(t.status));
  const recommendations = getTeamRecommendations(teams, request, missions);
  const warnings = getAssignmentWarnings(request, missions, teams, selectedTeam);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Phân công đội cứu hộ</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.875rem', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>{getRequestName(request)}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>📍 {request.address_detail}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>📞 {request.phone}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <LevelBadge level={request.emergency_level} />
              {request.has_elderly && <span className="badge" style={{ background: '#fef9c3', color: '#713f12', fontSize: '0.65rem' }}>👴 Người già</span>}
              {request.has_children && <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.65rem' }}>👶 Trẻ em</span>}
              {request.has_disabled && <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '0.65rem' }}>♿ Khuyết tật</span>}
              {request.has_medical_case && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.65rem' }}>🏥 Bệnh nhân</span>}
              {request.need_food_water && <span className="badge" style={{ background: '#f5e8d5', color: '#7a4a15', fontSize: '0.65rem' }}>🥫 Tiếp tế</span>}
            </div>
          </div>

          <label className="form-label">Chọn đội cứu hộ *</label>
          {(request.requester_type !== 'SELF' || isNeedsVerification(request) || warnings.length > 0) && (
            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
              {request.requester_type !== 'SELF' && (
                <div style={{ padding: '0.65rem', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '0.72rem' }}>
                  Báo hộ: {request.reporter_name || 'Người báo'} - {request.reporter_phone || 'chưa có SĐT'}
                </div>
              )}
              {warnings.map((warning, index) => (
                <div key={`${warning.type}-${index}`} style={{ padding: '0.65rem', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: '0.72rem', fontWeight: 700 }}>
                  {warning.message}
                </div>
              ))}
            </div>
          )}

          {availableTeams.length === 0 ? (
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: 8, color: '#dc2626', fontSize: '0.82rem' }}>
              ⚠️ Không có đội cứu hộ nào sẵn sàng
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recommendations.map(({ team, activeCount, maxActive, distanceLabel, overCapacity, unavailable }, index) => (
                <label key={team.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', borderRadius: 8,
                  border: `2px solid ${selectedTeam === team.id ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedTeam === team.id ? '#eff6ff' : 'white',
                  cursor: unavailable ? 'not-allowed' : 'pointer',
                  opacity: unavailable ? 0.5 : 1,
                }}>
                  <input
                    type="radio"
                    name="team"
                    value={team.id}
                    disabled={unavailable}
                    checked={selectedTeam === team.id}
                    onChange={e => setSelectedTeam(e.target.value)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {team.team_name || 'Đội cứu hộ chưa đặt tên'} {index === 0 && <span style={{ color: '#16a34a', fontSize: '0.65rem' }}>Gợi ý</span>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>👤 {team.leader_name || 'Chưa có trưởng đội'} · 📞 {team.phone || 'Chưa có SĐT'} · {team.member_count || 0} thành viên</div>
                    <div style={{ fontSize: '0.68rem', color: overCapacity ? '#dc2626' : '#64748b', marginTop: 2 }}>
                      Tải hiện tại: {activeCount}/{maxActive} nhiệm vụ đang xử lý - {distanceLabel}
                    </div>
                  </div>
                  <StatusBadge status={team.status} />
                </label>
              ))}
            </div>
          )}

        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.96)', boxShadow: '0 -8px 24px rgba(15,23,42,0.06)', flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={!selectedTeam} onClick={() => onAssign(selectedTeam, warnings)}>
            <UserCheck size={16} /> Xác nhận phân công
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ request, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Chi tiết yêu cầu cứu hộ</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <LevelBadge level={request.emergency_level} />
            <StatusBadge status={request.status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>Họ tên</div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{request.full_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>Số điện thoại</div>
              <a href={`tel:${request.phone}`} style={{ fontWeight: 600, fontSize: '0.88rem', color: '#2563eb', textDecoration: 'none' }}>📞 {request.phone}</a>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>Khu vực</div>
              <div style={{ fontSize: '0.82rem' }}>{request.area_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>Số người cần cứu</div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ef4444' }}>{request.number_of_people} người</div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>Địa chỉ</div>
            <div style={{ fontSize: '0.82rem' }}>📍 {request.address_detail}</div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {request.has_elderly && <span className="badge" style={{ background: '#fef9c3', color: '#713f12' }}>👴 Người già</span>}
            {request.has_children && <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>👶 Trẻ em</span>}
            {request.has_disabled && <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>♿ Khuyết tật</span>}
            {request.has_medical_case && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>🏥 Bệnh nhân</span>}
            {request.need_food_water && <span className="badge" style={{ background: '#f5e8d5', color: '#7a4a15' }}>🥫 Tiếp tế lương thực</span>}
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>Mô tả tình trạng</div>
            <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>{request.description}</div>
          </div>

          {request.assigned_team_name && (
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>Đội cứu hộ được phân công</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1d4ed8' }}>🛡️ {request.assigned_team_name}</div>
            </div>
          )}

          <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            <div>📅 Gửi lúc: {new Date(request.created_at).toLocaleString('vi-VN')}</div>
            {request.accepted_at && <div>✅ Tiếp nhận: {new Date(request.accepted_at).toLocaleString('vi-VN')}</div>}
            {request.completed_at && <div>✅ Hoàn thành: {new Date(request.completed_at).toLocaleString('vi-VN')}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RescueRequests() {
  const { rescueRequests, rescueTeams, rescueMissions, assignTeamToRequest, updateRescueRequest, searchSemantics, areas } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [filterArea, setFilterArea] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSOS, setFilterSOS] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);

  // Semantic Vector Search states
  const [semanticQuery, setSemanticQuery] = useState('');
  const [isSemanticActive, setIsSemanticActive] = useState(false);
  const [semanticResults, setSemanticResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSemanticSearch = async (e) => {
    if (e) e.preventDefault();
    if (!semanticQuery.trim()) {
      setIsSemanticActive(false);
      return;
    }
    setSearching(true);
    const results = await searchSemantics(semanticQuery, 'requests');
    setSemanticResults(results);
    setIsSemanticActive(true);
    setSearching(false);
  };

  const handleClearSemantic = () => {
    setSemanticQuery('');
    setIsSemanticActive(false);
    setSemanticResults([]);
  };

  // If semantic search is active, use the ranked semantic results, otherwise standard list
  const baseList = isSemanticActive ? semanticResults : rescueRequests;

  const filtered = baseList.filter(r => {
    if (filterArea && r.area_id !== filterArea) return false;
    if (filterLevel && r.emergency_level !== filterLevel) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterSOS && !r.sos_mode) return false;
    return true;
  });

  const sosCount = rescueRequests.filter(r => r.sos_mode && r.status === 'PENDING').length;

  const handleAssign = async (teamId, warnings = []) => {
    const team = rescueTeams.find(t => t.id === teamId);
    if (warnings.length > 0) {
      const ok = window.confirm(`Có ${warnings.length} cảnh báo điều phối. Bạn vẫn muốn phân công ${team?.team_name}?`);
      if (!ok) return;
    }
    try {
      const result = await assignTeamToRequest(assignModal.id, teamId, team?.team_name, currentUser);
      if (result?.assignment_warnings?.length) {
        toast.warning(`Kèm ${result.assignment_warnings.length} cảnh báo điều phối.`);
      }
      toast.success(`Đã phân công ${team?.team_name} cho ${assignModal.full_name}!`);
      setAssignModal(null);
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Không phân công được. Yêu cầu có thể đã được đội khác nhận, vui lòng tải lại.';
      toast.error(message);
      setAssignModal(null);
    }
  };

  const handleCancel = (r) => {
    if (window.confirm('Hủy yêu cầu cứu hộ này?')) {
      updateRescueRequest(r.id, { status: 'CANCELLED' });
      toast.warning('Đã hủy yêu cầu cứu hộ.');
    }
  };

  const pendingCount = rescueRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Yêu cầu cứu hộ</h1>
          <p className="page-subtitle">Tiếp nhận và phân công đội cứu hộ</p>
        </div>
        {pendingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.5rem 0.875rem' }}>
            <AlertTriangle size={16} color="#dc2626" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>{pendingCount} yêu cầu đang chờ phân công!</span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Tổng', count: rescueRequests.length, color: '#374151', bg: '#f8fafc' },
          { label: 'Chờ tiếp nhận', count: rescueRequests.filter(r => r.status === 'PENDING').length, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Đang xử lý', count: rescueRequests.filter(r => ['ASSIGNED','ACCEPTED','MOVING','NEAR_VICTIM','ARRIVED_CONFIRMED','RESCUING'].includes(r.status)).length, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Cứu thành công', count: rescueRequests.filter(r => ['RESCUED','TRANSFERRED_SAFEZONE'].includes(r.status)).length, color: '#10b981', bg: '#f0fdf4' },
          { label: '🆘 SOS chờ xử lý', count: sosCount, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Can xac minh', count: rescueRequests.filter(isNeedsVerification).length, color: '#d97706', bg: '#fffbeb' },
          { label: 'Gần nhiệm vụ khác', count: rescueRequests.filter(r => r.nearby_active_mission_id || r.duplicate_group_id).length, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}20`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Vector Semantic Search Bar */}
      <form onSubmit={handleSemanticSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#fcfaf7', border: '1px solid #e5dfd5', padding: '0.75rem', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, position: 'relative' }}>
          <span style={{ fontSize: '1.2rem', marginLeft: '0.25rem' }}>🧠</span>
          <input
            type="text"
            className="form-input"
            placeholder="Tìm kiếm ngữ nghĩa bằng AI Vector... (Ví dụ: Cần tiếp tế đồ ăn gấp cho cụ già)"
            value={semanticQuery}
            onChange={e => setSemanticQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '0.5rem', border: '1px solid #c8c0b5', background: 'white' }}
          />
          {isSemanticActive && (
            <button
              type="button"
              onClick={handleClearSemantic}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem'
              }}
            >
              ❌ Hủy
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }} disabled={searching}>
          {searching ? 'Đang tìm...' : 'Tìm kiếm AI'}
        </button>
      </form>

      {/* Filters */}
      <div className="filter-bar">
        <button
          onClick={() => setFilterSOS(!filterSOS)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.375rem 0.875rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
            background: filterSOS ? '#fef2f2' : '#f1f5f9',
            border: `2px solid ${filterSOS ? '#fca5a5' : '#e2e8f0'}`,
            color: filterSOS ? '#dc2626' : '#374151',
          }}
        >
          🆘 {filterSOS ? `SOS (${sosCount})` : 'Lọc SOS'}
        </button>
        <select className="form-input form-select" style={{ width: 160 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="">Tất cả khu vực</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
        </select>
        <select className="form-input form-select" style={{ width: 150 }} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          <option value="">Tất cả mức độ</option>
          {URGENCY_LEVELS.map(l => <option key={l} value={l}>{l === 'LOW' ? 'Thấp' : l === 'MEDIUM' ? 'Trung bình' : l === 'HIGH' ? 'Cao' : 'Khẩn cấp'}</option>)}
        </select>
        <select className="form-input form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {STATUS_FILTER_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Người yêu cầu</th>
                <th>Khu vực & Địa chỉ</th>
                <th>Mức độ</th>
                <th>Đặc biệt</th>
                <th>Đội phụ trách</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Không có yêu cầu nào</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} style={{ background: r.sos_mode && r.status === 'PENDING' ? '#fff5f5' : r.status === 'PENDING' && r.emergency_level === 'EMERGENCY' ? '#fef8f8' : 'white', borderLeft: r.sos_mode ? '3px solid #ef4444' : 'none' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: 2 }}>
                      {r.sos_mode && <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontSize: '0.62rem', fontWeight: 800, border: '1px solid #fecaca' }}>🆘 SOS</span>}
                      <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#0f172a' }}>{getRequestName(r)}</span>
                      {isSemanticActive && r.similarity !== undefined && (
                        <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '1px 5px', fontSize: '0.65rem', fontWeight: 700 }} title="Độ tương hợp ngữ nghĩa AI">
                          🧠 {Math.round(r.similarity * 100)}%
                        </span>
                      )}
                    </div>
                    <a href={`tel:${r.phone}`} style={{ fontSize: '0.72rem', color: '#3b82f6', textDecoration: 'none' }}>{r.phone}</a>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>👥 {r.number_of_people} người</div>
                    {r.requester_type !== 'SELF' && <div style={{ fontSize: '0.66rem', color: '#92400e', fontWeight: 700 }}>Báo hộ: {r.reporter_phone || 'chưa có SĐT'}</div>}
                    {isNeedsVerification(r) && <div style={{ fontSize: '0.66rem', color: '#dc2626', fontWeight: 700 }}>Can xac minh vi tri</div>}
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 500 }}>{r.area_name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{getRequestAddress(r)?.substring(0, 35)}...</div>
                  </td>
                  <td><LevelBadge level={r.emergency_level} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {r.has_elderly && <span title="Người già" style={{ fontSize: '0.9rem' }}>👴</span>}
                      {r.has_children && <span title="Trẻ em" style={{ fontSize: '0.9rem' }}>👶</span>}
                      {r.has_disabled && <span title="Khuyết tật" style={{ fontSize: '0.9rem' }}>♿</span>}
                      {r.has_medical_case && <span title="Bệnh nhân" style={{ fontSize: '0.9rem' }}>🏥</span>}
                      {r.need_food_water && <span title="Cần tiếp tế lương thực" style={{ fontSize: '0.9rem' }}>🥫</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>
                    {r.assigned_team_name
                      ? <span style={{ color: '#1d4ed8', fontWeight: 600 }}>🛡️ {r.assigned_team_name}</span>
                      : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa phân công</span>
                    }
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {new Date(r.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDetailModal(r)} title="Xem chi tiết"><Eye size={14} /></button>
                      {r.status === 'PENDING' && (
                        <button className="btn btn-primary btn-sm" onClick={() => setAssignModal(r)}>
                          <UserCheck size={14} /> Phân công
                        </button>
                      )}
                      {!['RESCUED', 'TRANSFERRED_SAFEZONE', 'CANCELLED'].includes(r.status) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleCancel(r)} style={{ color: '#ef4444' }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assignModal && <AssignModal request={assignModal} teams={rescueTeams} missions={rescueMissions} onAssign={handleAssign} onClose={() => setAssignModal(null)} />}
      {detailModal && <DetailModal request={detailModal} onClose={() => setDetailModal(null)} />}
    </div>
  );
}
