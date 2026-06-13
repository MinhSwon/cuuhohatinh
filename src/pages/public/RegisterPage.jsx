import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { Phone, Lock, User, MapPin } from 'lucide-react';
import { AREAS } from '../../data/publicData';
import { sendPhoneOtp, verifyPhoneOtp, resetRecaptchaVerifier } from '../../lib/firebasePhoneAuth';

function toFirebasePhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('84')) return `+${digits}`;
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`;
  if (digits.startsWith('9') || digits.startsWith('8') || digits.startsWith('7') || digits.startsWith('5') || digits.startsWith('3')) {
    return `+84${digits}`;
  }
  return `+${digits}`;
}

function getOtpErrorMessage(err) {
  const code = err?.code || '';
  if (code.includes('invalid-phone-number')) return 'Số điện thoại không hợp lệ. Hãy nhập dạng 09... hoặc +84...';
  if (code.includes('too-many-requests')) return 'Gửi OTP quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.';
  if (code.includes('invalid-verification-code')) return 'Mã OTP không đúng. Vui lòng kiểm tra lại.';
  if (code.includes('captcha-check-failed')) return 'reCAPTCHA không hợp lệ. Tải lại trang và thử lại.';
  return err?.message || 'Không gửi/xác thực được OTP Firebase.';
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', password: '', confirm_password: '',
    area_id: '', address_detail: '', household_size: 1,
    has_elderly: false, has_children: false, has_disabled: false,
    emergency_contact_name: '', emergency_contact_phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [firebaseIdToken, setFirebaseIdToken] = useState('');
  const { setUsers, setCitizenProfiles } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const isPhoneVerified = Boolean(firebaseIdToken && verifiedPhone === form.phone);

  const handlePhoneChange = (e) => {
    const nextPhone = e.target.value;
    setForm(f => ({ ...f, phone: nextPhone }));
    if (verifiedPhone || confirmationResult) {
      setVerifiedPhone('');
      setFirebaseIdToken('');
      setConfirmationResult(null);
      setOtpCode('');
      resetRecaptchaVerifier();
    }
  };

  const handleSendOtp = async () => {
    const firebasePhone = toFirebasePhoneNumber(form.phone);
    if (firebasePhone.length < 10) {
      toast.error('Vui lòng nhập số điện thoại hợp lệ trước khi gửi OTP.');
      return;
    }

    setOtpLoading(true);
    try {
      resetRecaptchaVerifier();
      const result = await sendPhoneOtp(firebasePhone);
      setConfirmationResult(result);
      setOtpCode('');
      toast.success(`Đã gửi mã OTP đến ${firebasePhone}.`);
    } catch (err) {
      resetRecaptchaVerifier();
      toast.error(getOtpErrorMessage(err));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error('Vui lòng nhập mã OTP.');
      return;
    }

    setOtpVerifying(true);
    try {
      const result = await verifyPhoneOtp(confirmationResult, otpCode.trim());
      setFirebaseIdToken(result.idToken);
      setVerifiedPhone(form.phone);
      toast.success('Số điện thoại đã được xác thực.');
    } catch (err) {
      toast.error(getOtpErrorMessage(err));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Mật khẩu xác nhận không khớp!');
      return;
    }
    if (!isPhoneVerified) {
      toast.error('Vui lòng xác thực số điện thoại bằng OTP trước khi đăng ký.');
      return;
    }
    setLoading(true);
    try {
      const selectedArea = AREAS.find(area => area.id === form.area_id);
      const res = await axios.post('/api/auth/register', {
        ...form,
        area_name: selectedArea?.old_name || selectedArea?.current_name || '',
        firebase_id_token: firebaseIdToken,
        phone_verified: true,
      });

      if (res.data?.success) {
        if (res.data.user) {
          setUsers(prev => [...prev.filter(user => user.id !== res.data.user.id), res.data.user]);
        }
        if (res.data.profile) {
          setCitizenProfiles(prev => [...prev.filter(profile => profile.id !== res.data.profile.id), res.data.profile]);
        }
        toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
        navigate('/login');
      } else {
        toast.error(res.data?.message || 'Đăng ký không thành công!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f1eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.5rem',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img src="/logo.svg" alt="Cổng thông tin cứu hộ ngập lụt" className="login-brand-logo mobile" />
          <h1 style={{ fontFamily: "'Lora', serif", color: '#2a2520', fontSize: '1.45rem', fontWeight: 600, letterSpacing: '-0.01em' }}>CỨU HỘ NGẬP LỤT</h1>
          <p style={{ color: '#9e9282', fontSize: '0.78rem', marginTop: 4 }}>CỔNG ĐĂNG KÝ NHẬN CẢNH BÁO LŨ & HỖ TRỢ</p>
        </div>

        <div style={{
          background: '#fdfcf8',
          borderRadius: 14,
          padding: '1.75rem',
          boxShadow: '0 8px 24px rgba(42,37,32,0.05)',
          border: '1px solid #e2dbd0'
        }}>
          <h2 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '1.15rem', fontWeight: 600, color: '#2a2520', marginBottom: '1.25rem', borderBottom: '1px solid #e2dbd0', paddingBottom: '0.5rem' }}>
            Tạo tài khoản người dân
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="form-label">Họ và tên *</label>
                <input className="form-input" placeholder="Nguyễn Văn A" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Số điện thoại *</label>
                <input className="form-input" placeholder="Số điện thoại" value={form.phone} onChange={handlePhoneChange} required />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 8, justifyContent: 'center', padding: '0.5rem' }}
                  onClick={handleSendOtp}
                  disabled={otpLoading || loading || !form.phone || isPhoneVerified}
                >
                  {isPhoneVerified ? 'Đã xác thực SĐT' : otpLoading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
                </button>
              </div>
            </div>

            <div id="recaptcha-container" />

            {confirmationResult && !isPhoneVerified && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Mã OTP *</label>
                  <input
                    className="form-input"
                    placeholder="Nhập mã OTP Firebase"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ alignSelf: 'end', padding: '0.65rem 0.85rem' }}
                  onClick={handleVerifyOtp}
                  disabled={otpVerifying || loading}
                >
                  {otpVerifying ? 'Đang xác thực...' : 'Xác thực'}
                </button>
              </div>
            )}

            <div style={{ marginBottom: '0.75rem' }}>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="form-label">Mật khẩu *</label>
                <input type="password" className="form-input" placeholder="Mật khẩu" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Xác nhận mật khẩu *</label>
                <input type="password" className="form-input" placeholder="Nhập lại" value={form.confirm_password} onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="form-label">Khu vực *</label>
                <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} required>
                  <option value="">-- Chọn khu vực --</option>
                  {AREAS.map(a => (
                    <option key={a.id} value={a.id}>{a.old_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Số người trong hộ</label>
                <input type="number" min="1" max="20" className="form-input" value={form.household_size} onChange={e => setForm(f => ({ ...f, household_size: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label className="form-label">Địa chỉ cụ thể</label>
              <input className="form-input" placeholder="Số nhà, đường, thôn/xóm..." value={form.address_detail} onChange={e => setForm(f => ({ ...f, address_detail: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label className="form-label">Đặc điểm hộ gia đình</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'has_elderly', label: '👴 Người già' },
                  { key: 'has_children', label: '👶 Trẻ em' },
                  { key: 'has_disabled', label: '♿ Người khuyết tật' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input
                      type="checkbox"
                      checked={form[opt.key]}
                      onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                      style={{ accentColor: '#2563eb' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label">Người liên hệ khẩn cấp</label>
                <input className="form-input" placeholder="Họ tên" value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">SĐT liên hệ khẩn cấp</label>
                <input className="form-input" placeholder="Số điện thoại" value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} disabled={loading}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký nhận cảnh báo'}
            </button>
          </form>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Đã có tài khoản? </span>
            <Link to="/login" style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
