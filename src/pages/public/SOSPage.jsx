import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { AlertTriangle, Phone, MapPin, Loader, CheckCircle, X, ChevronDown } from 'lucide-react';
import { AREAS } from '../../data/publicData';
import OfflineStatusBanner from '../../components/common/OfflineStatusBanner';
import EmergencyFallbackActions from '../../components/common/EmergencyFallbackActions';

const EMERGENCY_TYPES = [
  { emoji: '🏠', label: 'Nhà bị ngập', desc: 'Nước dâng vào nhà' },
  { emoji: '🚤', label: 'Mắc kẹt trên mái', desc: 'Cần xuồng cứu nạn' },
  { emoji: '🌾', label: 'Hộ bị cô lập', desc: 'Bị chia cắt hoàn toàn' },
  { emoji: '🥫', label: 'Thiếu lương thực', desc: 'Cần tiếp tế ăn uống, nước' },
  { emoji: '🚑', label: 'Cấp cứu / Y tế', desc: 'Cần chuyển viện, thuốc men' },
  { emoji: '👴', label: 'Người già/Trẻ nhỏ', desc: 'Cần ưu tiên di tản trước' },
  { emoji: '🆘', label: 'Nguy kịch tính mạng', desc: 'Đang gặp nguy hiểm cực lớn' },
  { emoji: '📵', label: 'Yêu cầu khác', desc: 'Cần hỗ trợ khác' },
];

export default function SOSPage() {
  const { createRescueRequest, addNotification } = useData();

  const [step, setStep] = useState('TYPE'); // TYPE → PHONE → LOCATION → SENDING → DONE
  const [selectedType, setSelectedType] = useState(null);
  const [requesterType, setRequesterType] = useState('SELF');
  const [phone, setPhone] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [victimName, setVictimName] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [areaId, setAreaId] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [sendError, setSendError] = useState('');
  const timerRef = useRef(null);
  const currentArea = AREAS.find(a => a.id === areaId);
  const emergencyPayload = {
    full_name: requesterType !== 'SELF' ? (victimName || 'Nguoi can cuu ho') : 'Nguoi dung SOS',
    phone: requesterType !== 'SELF' ? (victimPhone || phone) : phone,
    victim_name: requesterType !== 'SELF' ? (victimName || 'Nguoi can cuu ho') : 'Nguoi dung SOS',
    victim_phone: requesterType !== 'SELF' ? (victimPhone || phone) : phone,
    area_name: currentArea?.old_name || '',
    victim_area_name: currentArea?.old_name || '',
    address_detail: addressNote || '',
    victim_address_detail: addressNote || '',
    number_of_people: peopleCount,
    latitude: gps?.lat || null,
    longitude: gps?.lon || null,
    victim_latitude: requesterType === 'SELF' ? (gps?.lat || null) : null,
    victim_longitude: requesterType === 'SELF' ? (gps?.lon || null) : null,
  };

  // Auto-grab GPS when entering LOCATION step
  useEffect(() => {
    if (step === 'LOCATION') {
      grabGPS();
    }
  }, [step]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function grabGPS() {
    setGpsLoading(true);
    setGpsError(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
          setGpsLoading(false);
        },
        () => {
          setGpsError(true);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsError(true);
      setGpsLoading(false);
    }
  };

  const handleSend = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSendError('');
    setStep('SENDING');
    let count = 3;
    setCountdown(count);
    timerRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timerRef.current);
        submitRequest();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStep('LOCATION');
    setCountdown(null);
  };

  const submitRequest = async () => {
    const area = AREAS.find(a => a.id === areaId);
    const isRemoteReport = requesterType !== 'SELF';
    const victimDisplayName = isRemoteReport ? (victimName || 'Người cần cứu hộ') : 'Người dùng SOS';
    const victimContactPhone = isRemoteReport ? victimPhone : phone;
    const victimLat = isRemoteReport ? null : (gps?.lat || null);
    const victimLng = isRemoteReport ? null : (gps?.lon || null);
    const reporterLat = isRemoteReport ? (gps?.lat || null) : null;
    const reporterLng = isRemoteReport ? (gps?.lon || null) : null;
    const rescueIdentityPayload = {
      full_name: victimDisplayName,
      phone: victimContactPhone || phone,
      area_id: areaId || '',
      area_name: area?.old_name || 'Chua xac dinh',
      address_detail: addressNote || (gps && !isRemoteReport ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'Can xac minh vi tri'),
      description: `SOS khẩn cấp qua nút SOS. Loại: ${selectedType?.label}. ${isRemoteReport ? 'Người báo hộ đang báo thay người thân. ' : ''}${addressNote ? 'Ghi chú: ' + addressNote : ''}`,
      latitude: victimLat,
      longitude: victimLng,
      requester_type: requesterType,
      reporter_name: isRemoteReport ? (reporterName || 'Người báo hộ') : victimDisplayName,
      reporter_phone: phone,
      reporter_relationship: isRemoteReport ? 'Báo hộ người thân' : 'SELF',
      reporter_latitude: reporterLat,
      reporter_longitude: reporterLng,
      victim_name: victimDisplayName,
      victim_phone: victimContactPhone || phone,
      victim_area_id: areaId || '',
      victim_area_name: area?.old_name || 'Chua xac dinh',
      victim_address_detail: addressNote || (gps && !isRemoteReport ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'Can xac minh vi tri'),
      victim_latitude: victimLat,
      victim_longitude: victimLng,
    };
    try {
      const req = await createRescueRequest({
        full_name: 'Người dùng SOS',
        phone,
        area_id: areaId || '',
        area_name: area?.old_name || 'Chưa xác định',
        address_detail: addressNote || `GPS: ${gps?.lat?.toFixed(5)}, ${gps?.lon?.toFixed(5)}`,
        description: `🆘 YÊU CẦU CỨU HỘ KHẨN CẤP qua nút SOS. Loại: ${selectedType?.label}. ${addressNote ? 'Ghi chú: ' + addressNote : ''}`,
        number_of_people: peopleCount,
        emergency_level: 'EMERGENCY',
        latitude: gps?.lat || null,
        longitude: gps?.lon || null,
        has_elderly: selectedType?.emoji === '👴',
        has_children: selectedType?.emoji === '👨‍👩‍👧',
        has_disabled: false,
        has_medical_case: selectedType?.emoji === '👴',
        sos_mode: true,
        ...rescueIdentityPayload,
      });
      addNotification(null, '🆘 SOS KHẨN CẤP!', `${phone} cần cứu hộ — ${selectedType?.label}${gps ? ` (GPS: ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)})` : ''}`, 'RESCUE_REQUEST', req.id);
      setResult(req);
      setStep('DONE');
    } catch (err) {
      console.error('Failed to submit SOS request:', err);
      setSendError('Không gửi được yêu cầu. Vui lòng thử lại hoặc gọi trực tiếp 114/115.');
      setStep('LOCATION');
    } finally {
      timerRef.current = null;
      setCountdown(null);
    }
  };

  const canSendRequest = requesterType === 'SELF'
    ? Boolean(gps || areaId)
    : Boolean(areaId && addressNote.trim());

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f172a 0%, #1a0a0a 50%, #2d0a0a 100%)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background ripple effect */}
      {step !== 'DONE' && (
        <>
          <div style={{ position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.08)', animation: 'sosRipple 3s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', width: 450, height: 450, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.1)', animation: 'sosRipple 3s ease-in-out infinite 0.5s', pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(239,68,68,0.14)', animation: 'sosRipple 3s ease-in-out infinite 1s', pointerEvents: 'none' }} />
        </>
      )}

      <style>{`
        @keyframes sosRipple {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
          50% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
        }
        @keyframes sosPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          50% { box-shadow: 0 0 0 24px rgba(239,68,68,0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
          <img src="/logo.svg" alt="Cổng thông tin cứu hộ ngập lụt" className="brand-logo-image compact" />
          <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>CỨU HỘ NGẬP LỤT</span>
        </Link>
        <Link to="/login" style={{ color: '#64748b', fontSize: '0.75rem', textDecoration: 'none' }}>Đăng nhập</Link>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 1.25rem', position: 'relative', zIndex: 10, animation: 'fadeUp 0.4s ease' }}>

        {/* ── STEP: TYPE ── */}
        {step === 'TYPE' && (
          <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
            <OfflineStatusBanner dark />
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1rem',
                background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', animation: 'sosPulse 2s ease infinite',
                boxShadow: '0 0 30px rgba(220,38,38,0.5)',
              }}>
                🆘
              </div>
              <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
                CỨU HỘ KHẨN CẤP
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chọn loại tình huống của bạn</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {EMERGENCY_TYPES.map((type, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedType(type); setStep('PHONE'); }}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    padding: '1rem 0.75rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.375rem' }}>{type.emoji}</div>
                  <div style={{ color: 'white', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>{type.label}</div>
                  <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{type.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ padding: '0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: '1rem' }}>
              <p style={{ color: '#fca5a5', fontSize: '0.75rem' }}>
                📞 Gọi ngay nếu cần: <a href="tel:0693851000" style={{ color: '#f87171', fontWeight: 800, textDecoration: 'none' }}>0693 851 000</a>
                <span style={{ color: '#64748b' }}> · </span>
                <a href="tel:114" style={{ color: '#f87171', fontWeight: 800, textDecoration: 'none' }}>114</a>
                <span style={{ color: '#64748b' }}> · </span>
                <a href="tel:115" style={{ color: '#f87171', fontWeight: 800, textDecoration: 'none' }}>115</a>
              </p>
            </div>
            <EmergencyFallbackActions payload={emergencyPayload} dark compact />
          </div>
        )}

        {/* ── STEP: PHONE ── */}
        {step === 'PHONE' && (
          <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
            <OfflineStatusBanner dark />
            <button onClick={() => setStep('TYPE')} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', margin: '0 auto 1.5rem' }}>
              ← Quay lại
            </button>

            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{selectedType?.emoji}</div>
            <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.375rem' }}>{selectedType?.label}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '2rem' }}>Nhập số điện thoại để đội cứu hộ liên lạc</p>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(239,68,68,0.4)', borderRadius: 14, overflow: 'hidden', padding: '0.5rem 1rem' }}>
                <Phone size={20} color="#f87171" style={{ flexShrink: 0, marginRight: '0.75rem' }} />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Số điện thoại của bạn"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  autoFocus
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'white', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              {[
                { value: 'SELF', label: 'Toi can cuu' },
                { value: 'RELATIVE', label: 'Báo hộ người thân' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRequesterType(option.value)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: 10,
                    border: `1px solid ${requesterType === option.value ? '#f87171' : 'rgba(255,255,255,0.12)'}`,
                    background: requesterType === option.value ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)',
                    color: requesterType === option.value ? '#fecaca' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {requesterType !== 'SELF' && (
              <div style={{ display: 'grid', gap: '0.625rem', marginBottom: '1rem', textAlign: 'left' }}>
                <input
                  type="text"
                  placeholder="Tên người cần cứu"
                  value={victimName}
                  onChange={e => setVictimName(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.625rem 0.875rem', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Số điện thoại người cần cứu nếu có"
                  value={victimPhone}
                  onChange={e => setVictimPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.625rem 0.875rem', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Tên người báo nếu muốn để lại"
                  value={reporterName}
                  onChange={e => setReporterName(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '0.625rem 0.875rem', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                />
                <p style={{ color: '#fbbf24', fontSize: '0.68rem', lineHeight: 1.5, margin: 0 }}>
                  GPS hiện tại chỉ được lưu là vị trí người báo. Hãy nhập khu vực và địa chỉ của người cần cứu ở bước tiếp theo.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem', marginBottom: '0.375rem' }}>Số người cần cứu</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))} style={{ padding: '0.5rem 0.875rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem' }}>−</button>
                  <span style={{ flex: 1, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '1rem' }}>{peopleCount}</span>
                  <button onClick={() => setPeopleCount(Math.min(20, peopleCount + 1))} style={{ padding: '0.5rem 0.875rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem' }}>+</button>
                </div>
              </div>
            </div>

            {sendError && <p style={{ color: '#fca5a5', fontSize: '0.75rem', marginBottom: '1rem', fontWeight: 700 }}>{sendError}</p>}
            <button
              onClick={() => phone.length >= 9 ? setStep('LOCATION') : null}
              disabled={phone.length < 9}
              style={{
                width: '100%', padding: '1rem', borderRadius: 14, border: 'none',
                background: phone.length >= 9 ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'rgba(255,255,255,0.1)',
                color: 'white', fontSize: '1rem', fontWeight: 800, cursor: phone.length >= 9 ? 'pointer' : 'not-allowed',
                boxShadow: phone.length >= 9 ? '0 8px 24px rgba(220,38,38,0.4)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              Tiếp tục →
            </button>
          </div>
        )}

        {/* ── STEP: LOCATION ── */}
        {step === 'LOCATION' && (
          <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
            <OfflineStatusBanner dark />
            <EmergencyFallbackActions payload={emergencyPayload} dark compact />
            <button onClick={() => setStep('PHONE')} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', margin: '0 auto 1.5rem' }}>
              ← Quay lại
            </button>

            {/* GPS Status */}
            <div style={{
              background: gps ? 'rgba(16,185,129,0.1)' : gpsError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)',
              border: `2px solid ${gps ? 'rgba(16,185,129,0.4)' : gpsError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 16, padding: '1.5rem', marginBottom: '1.25rem',
            }}>
              {gpsLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <Loader size={36} color="#60a5fa" style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Đang lấy vị trí GPS...</div>
                </div>
              )}
              {gps && !gpsLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={28} color="#34d399" />
                  </div>
                  <div style={{ color: '#34d399', fontWeight: 800, fontSize: '1rem' }}>✅ Đã xác định vị trí!</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                    {gps.lat.toFixed(6)}, {gps.lon.toFixed(6)}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Độ chính xác: ±{gps.accuracy}m</div>
                </div>
              )}
              {gpsError && !gpsLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>📍</div>
                  <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.9rem' }}>Không lấy được GPS</div>
                  <button onClick={grabGPS} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.375rem 0.875rem', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer' }}>
                    Thử lại
                  </button>
                  <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Hãy chọn khu vực thủ công bên dưới</div>
                </div>
              )}
            </div>

            {/* Area selector */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem', marginBottom: '0.375rem', textAlign: 'left' }}>Khu vực (bắt buộc nếu không có GPS)</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={areaId}
                  onChange={e => setAreaId(e.target.value)}
                  style={{
                    width: '100%', appearance: 'none',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10, padding: '0.625rem 2rem 0.625rem 0.875rem',
                    color: 'white', fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="" style={{ background: '#1e293b' }}>-- Chọn khu vực --</option>
                  {AREAS.map(a => <option key={a.id} value={a.id} style={{ background: '#1e293b' }}>{a.old_name}</option>)}
                </select>
                <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Address note */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.72rem', marginBottom: '0.375rem', textAlign: 'left' }}>Mô tả nhanh vị trí (tuỳ chọn)</label>
              <input
                type="text"
                placeholder="VD: Thôn 3, gần nhà văn hoá, mái ngói đỏ..."
                value={addressNote}
                onChange={e => setAddressNote(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10, padding: '0.625rem 0.875rem',
                  color: 'white', fontSize: '0.85rem', outline: 'none',
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSendRequest}
              style={{
                width: '100%', padding: '1.125rem', borderRadius: 14, border: 'none',
                background: canSendRequest ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'rgba(255,255,255,0.08)',
                color: 'white', fontSize: '1.1rem', fontWeight: 900, cursor: canSendRequest ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                boxShadow: canSendRequest ? '0 8px 30px rgba(220,38,38,0.5)' : 'none',
                animation: canSendRequest ? 'sosPulse 2s infinite' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <AlertTriangle size={22} />
              🆘 GỬI CỨU HỘ NGAY
            </button>
            {sendError && <p style={{ color: '#fca5a5', fontSize: '0.75rem', marginTop: '0.75rem', fontWeight: 700 }}>{sendError}</p>}
            <p style={{ color: '#475569', fontSize: '0.68rem', marginTop: '0.75rem' }}>
              Nhấn nút sẽ đếm ngược 3 giây. Bạn có thể hủy trước khi gửi.
            </p>
          </div>
        )}

        {/* ── STEP: SENDING (countdown) ── */}
        {step === 'SENDING' && (
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
            <div style={{
              width: 140, height: 140, borderRadius: '50%', margin: '0 auto 1.5rem',
              background: 'rgba(220,38,38,0.15)',
              border: '4px solid rgba(220,38,38,0.5)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>{countdown}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 4 }}>giây</div>
            </div>
            <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Đang gửi yêu cầu...</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '2rem' }}>Đang liên hệ đội cứu hộ</p>
            <button
              onClick={cancelCountdown}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10, padding: '0.625rem 1.25rem', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              <X size={16} /> Hủy gửi
            </button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'DONE' && (
          <div style={{ textAlign: 'center', maxWidth: 400, animation: 'fadeUp 0.4s ease' }}>
            <OfflineStatusBanner dark />
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '3px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={52} color="#34d399" />
            </div>
            <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
              ✅ Đã gửi thành công!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Yêu cầu cứu hộ của bạn đã được tiếp nhận.<br />
              Đội cứu hộ đang được điều phối ngay lập tức.
            </p>

            {result?.offline_status === 'QUEUED' && (
              <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 12, padding: '0.875rem', marginBottom: '1rem', color: '#fde68a', fontSize: '0.82rem', fontWeight: 800 }}>
                Đã lưu tạm trên thiết bị. Yêu cầu sẽ tự gửi lại khi có internet. Nếu còn sóng di động, hãy gọi hoặc gửi SMS dự phòng bên dưới.
              </div>
            )}
            <EmergencyFallbackActions payload={result || emergencyPayload} dark compact />

            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>Thông tin yêu cầu</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Mã yêu cầu</span>
                  <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>#{result?.id?.toUpperCase().substring(0, 10)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Loại</span>
                  <span style={{ color: 'white', fontWeight: 600 }}>{selectedType?.emoji} {selectedType?.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Điện thoại</span>
                  <span style={{ color: '#60a5fa', fontWeight: 700 }}>📞 {phone}</span>
                </div>
                {gps && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Vị trí GPS</span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>✅ Đã gửi</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>📋 Trong khi chờ đội cứu hộ:</div>
              <ul style={{ color: '#f87171', fontSize: '0.75rem', paddingLeft: '1.25rem', lineHeight: 1.8, textAlign: 'left' }}>
                <li>Giữ điện thoại luôn bật và tiếp nhận cuộc gọi</li>
                <li>Di chuyển lên nơi cao nhất có thể</li>
                <li>Tắt nguồn điện, bếp gas</li>
                <li>Ra hiệu bằng đèn pin, vải màu sáng</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <a href="tel:0693851000" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '0.75rem', color: '#f87171', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem' }}>
                  📞 Ban PCTT
                </a>
                <a href="tel:114" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '0.75rem', color: '#f87171', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem' }}>
                  📞 114
                </a>
                <a href="tel:115" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '0.75rem', color: '#f87171', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem' }}>
                  📞 115
                </a>
              </div>
              <button
                onClick={() => { setStep('TYPE'); setRequesterType('SELF'); setPhone(''); setReporterName(''); setVictimName(''); setVictimPhone(''); setGps(null); setAreaId(''); setAddressNote(''); setPeopleCount(1); setResult(null); }}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Gửi yêu cầu khác
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step indicator (bottom) */}
      {step !== 'DONE' && step !== 'SENDING' && (
        <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'center', gap: '0.375rem', position: 'relative', zIndex: 10 }}>
          {['TYPE', 'PHONE', 'LOCATION'].map((s) => (
            <div key={s} style={{ width: step === s ? 24 : 8, height: 8, borderRadius: 4, background: step === s ? '#ef4444' : 'rgba(255,255,255,0.15)', transition: 'all 0.3s' }} />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
