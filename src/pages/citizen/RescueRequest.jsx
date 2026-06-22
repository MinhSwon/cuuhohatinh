import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MapPin, Send } from 'lucide-react';
import OfflineStatusBanner from '../../components/common/OfflineStatusBanner';
import EmergencyFallbackActions from '../../components/common/EmergencyFallbackActions';

export default function RescueRequest() {
  const { currentUser } = useAuth();
  const { createRescueRequest, citizenProfiles, addNotification, areas } = useData();
  const toast = useToast();
  const navigate = useNavigate();

  const myProfile = citizenProfiles.find(cp => cp.user_id === currentUser?.id);

  const [form, setForm] = useState({
    full_name: currentUser?.full_name || '',
    phone: currentUser?.phone || '',
    requester_type: 'SELF',
    reporter_name: currentUser?.full_name || '',
    reporter_phone: currentUser?.phone || '',
    reporter_relationship: '',
    victim_name: currentUser?.full_name || '',
    victim_phone: currentUser?.phone || '',
    area_id: myProfile?.area_id || '',
    address_detail: myProfile?.address_detail || '',
    description: '',
    number_of_people: myProfile?.household_size || 1,
    emergency_level: 'HIGH',
    has_elderly: (myProfile?.elderly_count || 0) > 0,
    has_children: (myProfile?.children_count || 0) > 0,
    has_disabled: (myProfile?.disabled_count || 0) > 0,
    has_medical_case: false,
    need_food_water: false,
    latitude: null,
    longitude: null,
  });
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const selectedArea = areas.find(a => a.id === form.area_id);
  const fallbackPayload = {
    ...form,
    area_name: selectedArea?.old_name || '',
    victim_area_name: selectedArea?.old_name || '',
    victim_address_detail: form.address_detail,
    victim_latitude: form.latitude,
    victim_longitude: form.longitude,
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
          toast.success('Đã lấy vị trí GPS thành công!');
        },
        () => toast.error('Không thể lấy vị trí GPS. Vui lòng nhập địa chỉ thủ công.')
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const area = areas.find(a => a.id === form.area_id);
    const isRemoteReport = form.requester_type !== 'SELF';
    const payload = {
      ...form,
      full_name: isRemoteReport ? (form.victim_name || 'Người cần cứu hộ') : form.full_name,
      phone: isRemoteReport ? (form.victim_phone || form.phone) : form.phone,
      area_name: area?.old_name,
      user_id: currentUser?.id,
      reporter_name: isRemoteReport ? (form.reporter_name || currentUser?.full_name || form.full_name) : form.full_name,
      reporter_phone: isRemoteReport ? (form.reporter_phone || currentUser?.phone || form.phone) : form.phone,
      reporter_relationship: isRemoteReport ? (form.reporter_relationship || 'Người thân') : 'SELF',
      victim_name: isRemoteReport ? (form.victim_name || 'Người cần cứu hộ') : form.full_name,
      victim_phone: isRemoteReport ? form.victim_phone : form.phone,
      victim_area_id: form.area_id,
      victim_area_name: area?.old_name,
      victim_address_detail: form.address_detail,
      victim_latitude: form.latitude,
      victim_longitude: form.longitude,
    };
    try {
      const req = await createRescueRequest(payload);
      setSubmittedRequest(req);
      addNotification(null, '🆘 Yêu cầu cứu hộ mới!', `${form.full_name} cần hỗ trợ tại ${area?.old_name}`, 'RESCUE_REQUEST', req.id);
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit rescue request:', err);
      toast.error('Không gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container">
        <div className="card" style={{ maxWidth: 480, margin: '2rem auto', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
            Yêu cầu đã được gửi!
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.5rem' }}>
            Đội cứu hộ sẽ liên hệ với bạn trong thời gian sớm nhất. Hãy ở yên tại chỗ và giữ điện thoại.
          </p>
          {submittedRequest?.offline_status === 'QUEUED' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '0.875rem', marginBottom: '1rem', color: '#92400e', fontSize: '0.82rem', fontWeight: 700 }}>
              Đã lưu tạm trên thiết bị. Yêu cầu sẽ tự gửi lại khi có internet.
            </div>
          )}
          <EmergencyFallbackActions payload={submittedRequest || fallbackPayload} />
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>🚨 Trong khi chờ đợi:</p>
            <ul style={{ fontSize: '0.78rem', color: '#b91c1c', textAlign: 'left', paddingLeft: '1.25rem' }}>
              <li>Tắt các thiết bị điện</li>
              <li>Di chuyển lên tầng cao nếu có</li>
              <li>Ra hiệu bằng đèn pin, vải sáng</li>
              <li>Giữ trẻ em và người già gần mình</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => { setSubmitted(false); setSubmittedRequest(null); setForm(f => ({ ...f, description: '' })); }}>Gửi yêu cầu khác</button>
            <button className="btn btn-primary" onClick={() => navigate('/citizen')}>Về trang chủ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={24} color="#dc2626" /> Gửi yêu cầu cứu hộ
          </h1>
          <p className="page-subtitle">Điền đầy đủ thông tin để đội cứu hộ đến nhanh nhất</p>
        </div>
      </div>

      <OfflineStatusBanner />

      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <EmergencyFallbackActions payload={fallbackPayload} />
            {/* Urgency */}
            <div>
              <label className="form-label">Mức độ khẩn cấp *</label>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                {[
                  { value: 'LOW', label: '🟡 Không khẩn cấp', color: '#eab308' },
                  { value: 'MEDIUM', label: '🟠 Cần hỗ trợ', color: '#f97316' },
                  { value: 'HIGH', label: '🔴 Khẩn cấp', color: '#ef4444' },
                  { value: 'EMERGENCY', label: '🚨 Nguy hiểm tính mạng', color: '#dc2626' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, emergency_level: opt.value }))}
                    style={{
                      flex: 1, padding: '0.625rem 0.25rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                      border: `2px solid ${form.emergency_level === opt.value ? opt.color : '#e2e8f0'}`,
                      background: form.emergency_level === opt.value ? `${opt.color}15` : 'white',
                      color: form.emergency_level === opt.value ? opt.color : '#64748b',
                      cursor: 'pointer',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Ai đang cần cứu hộ? *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                {[
                  { value: 'SELF', label: 'Toi / ho gia dinh toi' },
                  { value: 'RELATIVE', label: 'Báo hộ người thân' },
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      requester_type: option.value,
                      reporter_name: option.value === 'SELF' ? f.full_name : (f.reporter_name || currentUser?.full_name || ''),
                      reporter_phone: option.value === 'SELF' ? f.phone : (f.reporter_phone || currentUser?.phone || ''),
                    }))}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 10,
                      border: `2px solid ${form.requester_type === option.value ? '#dc2626' : '#e2e8f0'}`,
                      background: form.requester_type === option.value ? '#fef2f2' : 'white',
                      color: form.requester_type === option.value ? '#b91c1c' : '#475569',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {form.requester_type !== 'SELF' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '0.875rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 700, marginBottom: '0.625rem' }}>
                  Thông tin báo hộ và người cần cứu
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <input className="form-input" placeholder="Tên người cần cứu *" value={form.victim_name} onChange={e => setForm(f => ({ ...f, victim_name: e.target.value }))} required />
                  <input className="form-input" placeholder="SĐT người cần cứu nếu có" value={form.victim_phone} onChange={e => setForm(f => ({ ...f, victim_phone: e.target.value }))} />
                  <input className="form-input" placeholder="Tên người báo" value={form.reporter_name} onChange={e => setForm(f => ({ ...f, reporter_name: e.target.value }))} />
                  <input className="form-input" placeholder="SĐT người báo" value={form.reporter_phone} onChange={e => setForm(f => ({ ...f, reporter_phone: e.target.value }))} />
                  <input className="form-input" placeholder="Moi quan he" value={form.reporter_relationship} onChange={e => setForm(f => ({ ...f, reporter_relationship: e.target.value }))} />
                  <div style={{ fontSize: '0.72rem', color: '#92400e', display: 'flex', alignItems: 'center' }}>
                    Địa chỉ bên dưới là của người cần cứu.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Họ và tên *</label>
                <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Số điện thoại *</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Khu vực *</label>
                <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} required>
                  <option value="">-- Chọn khu vực --</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Số người cần cứu *</label>
                <input type="number" min="1" className="form-input" value={form.number_of_people} onChange={e => setForm(f => ({ ...f, number_of_people: parseInt(e.target.value) }))} required />
              </div>
            </div>

            <div>
              <label className="form-label">Địa chỉ cụ thể *</label>
              <input className="form-input" value={form.address_detail} onChange={e => setForm(f => ({ ...f, address_detail: e.target.value }))} required placeholder="Số nhà, thôn/xóm, điểm đặc biệt gần đó..." />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Vị trí GPS</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={getLocation}>
                  <MapPin size={13} /> Lấy vị trí hiện tại
                </button>
              </div>
              {form.latitude ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.625rem', fontSize: '0.78rem', color: '#15803d' }}>
                  ✅ GPS: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.625rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Chưa có vị trí GPS (nên lấy để đội cứu hộ đến nhanh hơn)
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Đặc điểm người cần cứu</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'has_elderly', label: '👴 Người già' },
                  { key: 'has_children', label: '👶 Trẻ em' },
                  { key: 'has_disabled', label: '♿ Khuyết tật' },
                  { key: 'has_medical_case', label: '🏥 Bệnh nhân cấp cứu' },
                  { key: 'need_food_water', label: '🥫 Cần tiếp tế lương thực' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input type="checkbox" checked={form[opt.key]} onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))} style={{ accentColor: '#2563eb' }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Mô tả tình trạng *</label>
              <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="VD: Nhà ngập 1.5m, có 3 người già không đi được, cần thuyền đến cứu ngay..." style={{ resize: 'none' }} />
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.875rem', fontSize: '0.78rem', color: '#991b1b' }}>
              ⚠️ Khi gửi yêu cầu: Hãy bật điện thoại và chờ cuộc gọi từ đội cứu hộ. Ở yên tại vị trí an toàn nhất có thể.
            </div>

            <button type="submit" className="btn btn-danger" style={{ padding: '0.875rem', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 700 }} disabled={loading}>
              <Send size={18} /> {loading ? 'Đang gửi yêu cầu...' : '🆘 Gửi yêu cầu cứu hộ ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
