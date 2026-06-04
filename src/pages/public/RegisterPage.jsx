import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { Phone, Lock, User, MapPin } from 'lucide-react';
import { AREAS } from '../../data/mockData';

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', password: '', confirm_password: '',
    area_id: '', address_detail: '', household_size: 1,
    has_elderly: false, has_children: false, has_disabled: false,
    emergency_contact_name: '', emergency_contact_phone: '',
  });
  const [loading, setLoading] = useState(false);
  const { setUsers, setCitizenProfiles } = useData();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Mật khẩu xác nhận không khớp!');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const userId = `user-${Date.now()}`;
      const newUser = {
        id: userId,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        password_hash: form.password,
        role: 'CITIZEN',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      };
      setUsers(prev => [...prev, newUser]);

      if (form.area_id) {
        const profile = {
          id: `cp-${Date.now()}`,
          user_id: userId,
          area_id: form.area_id,
          village_name: '',
          address_detail: form.address_detail,
          household_size: parseInt(form.household_size),
          elderly_count: form.has_elderly ? 1 : 0,
          children_count: form.has_children ? 1 : 0,
          disabled_count: form.has_disabled ? 1 : 0,
          medical_note: '',
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
          latitude: null,
          longitude: null,
          sms_opt_in: true,
        };
        setCitizenProfiles(prev => [...prev, profile]);
      }

      toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      navigate('/login');
      setLoading(false);
    }, 800);
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
          <img src="/logo.svg" alt="Cong thong tin cuu ho ngap lu" className="login-brand-logo mobile" />
          <h1 style={{ fontFamily: "'Lora', serif", color: '#2a2520', fontSize: '1.45rem', fontWeight: 600, letterSpacing: '-0.01em' }}>CUU HO NGAP LU</h1>
          <p style={{ color: '#9e9282', fontSize: '0.78rem', marginTop: 4 }}>CONG DANG KY NHAN CANH BAO LU & HO TRO</p>
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
                <input className="form-input" placeholder="0912345678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
            </div>

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
                <input className="form-input" placeholder="0912345678" value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
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
