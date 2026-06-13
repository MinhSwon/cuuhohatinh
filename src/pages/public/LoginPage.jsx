import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Phone, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [form, setForm] = useState({ emailOrPhone: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(async () => {
      const result = await login(form.emailOrPhone, form.password);
      if (result.success) {
        toast.success('Đăng nhập thành công!');
        const role = result.user.role;
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') navigate('/admin');
        else if (role === 'RESCUE_LEADER' || role === 'RESCUE_MEMBER') navigate('/rescue');
        else navigate('/citizen');
      } else {
        toast.error(result.message);
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f1eb',
      display: 'flex',
    }}>
      {/* Left decorative panel */}
      <div style={{
        flex: '0 0 420px',
        background: '#2d2825',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '3rem 2.5rem',
        position: 'relative', overflow: 'hidden',
      }} className="hide-mobile">
        {/* Subtle pattern */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.5) 30px, rgba(255,255,255,0.5) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.5) 30px, rgba(255,255,255,0.5) 31px)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 320 }}>
          <img src="/logo.svg" alt="Cổng thông tin cứu hộ ngập lụt" className="login-brand-logo" />
          <h1 style={{ fontFamily: "'Lora', serif", color: '#f0ece5', fontSize: '1.6rem', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '0.625rem' }}>
            CỨU HỘ NGẬP LỤT
          </h1>
          <p style={{ color: '#8a8278', fontSize: '0.82rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            Hệ thống cảnh báo lũ lụt & điều phối cứu hộ cho khu vực Hương Khê, Hà Tĩnh.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
            {[
              { icon: '🌊', text: 'Theo dõi cảnh báo lũ theo thời gian thực' },
              { icon: '🆘', text: 'Điều phối cứu hộ và xử lý yêu cầu khẩn cấp' },
              { icon: '📱', text: 'Gửi SMS cảnh báo hàng loạt đến người dân' },
              { icon: '🗺️', text: 'Quản lý tuyến đường và điểm sơ tán' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <span style={{ fontSize: '0.78rem', color: '#9e9282', lineHeight: 1.5 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Mobile logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'none' }} className="show-mobile">
            <img src="/logo.svg" alt="Cổng thông tin cứu hộ ngập lụt" className="login-brand-logo mobile" />
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.25rem', color: '#2a2520', fontWeight: 600 }}>CỨU HỘ NGẬP LỤT</h1>
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.35rem', fontWeight: 600, color: '#2a2520', marginBottom: '0.375rem' }}>
              Đăng nhập
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#9e9282' }}>Vui lòng đăng nhập để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Email hoặc số điện thoại</label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#b8afa5' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Email hoặc số điện thoại"
                  value={form.emailOrPhone}
                  onChange={e => setForm(f => ({ ...f, emailOrPhone: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#b8afa5' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: 32, paddingRight: 36 }}
                  placeholder="Mật khẩu"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#b8afa5', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/" style={{ fontSize: '0.75rem', color: '#9e9282', textDecoration: 'none' }}>← Trang chủ</Link>
            <Link to="/register" style={{ fontSize: '0.75rem', color: '#4a6fa5', textDecoration: 'none', fontWeight: 500 }}>Đăng ký →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
