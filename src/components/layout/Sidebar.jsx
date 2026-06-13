import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  LayoutDashboard, Bell, BellRing, Users, Shield, Map, MessageSquare,
  Navigation, AlertTriangle, FileText, BarChart3, Activity, Bot,
  Settings, LogOut, X, Home, Route, Droplets,
  Building2, ClipboardList, Anchor
} from 'lucide-react';

const adminNavSections = [
  {
    label: 'Tổng quan',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/admin/dispatch', icon: Navigation, label: 'Trung tâm điều phối' },
    ],
  },
  {
    label: 'Cảnh báo & SMS',
    items: [
      { to: '/admin/alerts', icon: BellRing, label: 'Quản lý cảnh báo' },
      { to: '/admin/sms', icon: MessageSquare, label: 'SMS cảnh báo' },
      { to: '/admin/coastal', icon: Anchor, label: 'Cảnh báo ven biển & Sạt lở' },
    ],
  },
  {
    label: 'Cứu hộ',
    items: [
      { to: '/admin/rescue-requests', icon: AlertTriangle, label: 'Yêu cầu cứu hộ' },
      { to: '/admin/rescue-missions', icon: Shield, label: 'Nhiệm vụ cứu hộ' },
      { to: '/admin/rescue-teams', icon: Users, label: 'Đội cứu hộ' },
    ],
  },
  {
    label: 'Cộng đồng',
    items: [
      { to: '/admin/subscribers', icon: Users, label: 'Người dân' },
      { to: '/admin/vulnerable', icon: Home, label: 'Hộ dễ tổn thương' },
    ],
  },
  {
    label: 'Cơ sở hạ tầng',
    items: [
      { to: '/admin/safe-zones', icon: Building2, label: 'Điểm sơ tán' },
      { to: '/admin/rescue-routes', icon: Route, label: 'Tuyến đường cứu hộ' },
      { to: '/admin/dams', icon: Droplets, label: 'Đập/Hồ chứa' },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      { to: '/admin/damage-reports', icon: FileText, label: 'Báo cáo thiệt hại' },
      { to: '/admin/reports', icon: BarChart3, label: 'Thống kê & Báo cáo' },
      { to: '/admin/activity-logs', icon: Activity, label: 'Nhật ký hoạt động' },
    ],
  },
  {
    label: 'Công cụ',
    items: [
      { to: '/admin/ai-assistant', icon: Bot, label: 'AI Trợ lý' },
      { to: '/admin/settings', icon: Settings, label: 'Cài đặt tài khoản' },
    ],
  },
];

/* Shared user chip */
function UserChip({ name, role, avatarColor = '#4a6fa5' }) {
  const initial = name?.[0] || '?';
  return (
    <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: avatarColor, opacity: 0.85,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 600, color: 'white', flexShrink: 0,
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#d8d0c8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
        <div style={{ fontSize: '0.6rem', color: '#6b6360', marginTop: 1 }}>{role}</div>
      </div>
    </div>
  );
}

/* LogoutRow */
function LogoutRow({ onClick }) {
  return (
    <div style={{ padding: '0.625rem 0.625rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={onClick}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.45rem 0.625rem', borderRadius: 6, color: '#9e9282',
          background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#d8d0c8'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9e9282'; }}
      >
        <LogOut size={14} style={{ opacity: 0.7 }} />
        <span>Đăng xuất</span>
      </button>
    </div>
  );
}

function BrandMark() {
  return (
    <img
      src="/logo.svg"
      alt="Cổng thông tin cứu hộ ngập lụt"
      className="brand-logo-image compact"
    />
  );
}

export function AdminSidebar({ isOpen, onClose }) {
  const { currentUser, logout } = useAuth();
  const { notifications, rescueRequests } = useData();
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.is_read && n.user_id === currentUser?.id).length;
  const sosCount = rescueRequests.filter(r => r.sos_mode && r.status === 'PENDING').length;

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <BrandMark />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-logo-title">CỨU HỘ NGẬP LỤT</div>
            <div className="sidebar-logo-subtitle">Cổng thông tin</div>
          </div>
          <button onClick={onClose} style={{ color: '#6b6360', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* User */}
        <UserChip name={currentUser?.full_name} role="Điều phối viên" avatarColor="#4a6fa5" />

        {/* SOS alert */}
        {sosCount > 0 && (
          <button
            onClick={() => { navigate('/admin/rescue-requests'); onClose?.(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.875rem', background: 'rgba(160,64,64,0.18)',
              border: 'none', borderBottom: '1px solid rgba(160,64,64,0.2)',
              cursor: 'pointer', color: '#e8a0a0', fontSize: '0.72rem', fontWeight: 600,
              animation: 'sosBlink 1.2s ease infinite',
            }}
          >
            <span>🆘</span>
            <span>{sosCount} yêu cầu SOS đang chờ xử lý</span>
          </button>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.375rem 0', overflowY: 'auto' }}>
          {adminNavSections.map((section) => (
            <div key={section.label} className="sidebar-section">
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onClose?.()}
                >
                  <item.icon size={14} />
                  <span>{item.label}</span>
                  {item.to === '/admin/rescue-requests' && unreadCount > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#a04040', color: 'white', borderRadius: 3, padding: '0 5px', fontSize: '0.6rem', fontWeight: 700 }}>
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <LogoutRow onClick={() => { logout(); navigate('/login'); }} />
        <style>{`@keyframes sosBlink { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
      </aside>
    </>
  );
}

export function RescueSidebar({ isOpen, onClose }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/rescue', icon: LayoutDashboard, label: 'Dashboard cứu hộ', end: true },
    { to: '/rescue/missions', icon: Shield, label: 'Nhiệm vụ được giao' },
    { to: '/rescue/warnings', icon: Bell, label: 'Cảnh báo lũ' },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{ background: '#212a25' }}>
        <div className="sidebar-logo" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <BrandMark />
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-title">ĐỘI CỨU HỘ</div>
            <div className="sidebar-logo-subtitle">Cứu hộ ngập lụt</div>
          </div>
        </div>

        <UserChip name={currentUser?.full_name} role="Cứu hộ viên" avatarColor="#3a6b4a" />

        <nav style={{ flex: 1, padding: '0.75rem 0.625rem' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onClose?.()}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <LogoutRow onClick={() => { logout(); navigate('/login'); }} />
      </aside>
    </>
  );
}

export function CitizenSidebar({ isOpen, onClose }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/citizen', icon: LayoutDashboard, label: 'Trang chủ', end: true },
    { to: '/citizen/request', icon: AlertTriangle, label: 'Gửi yêu cầu cứu hộ' },
    { to: '/citizen/warnings', icon: Bell, label: 'Cảnh báo lũ' },
    { to: '/citizen/safezones', icon: Building2, label: 'Điểm sơ tán' },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{ background: '#212535' }}>
        <div className="sidebar-logo">
          <BrandMark />
          <div style={{ flex: 1 }}>
            <div className="sidebar-logo-title">CỨU HỘ NGẬP LỤT</div>
            <div className="sidebar-logo-subtitle">Cổng người dân</div>
          </div>
        </div>

        <UserChip name={currentUser?.full_name} role="Người dân" avatarColor="#4a6fa5" />

        <nav style={{ flex: 1, padding: '0.75rem 0.625rem' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onClose?.()}
            >
              <item.icon size={14} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <LogoutRow onClick={() => { logout(); navigate('/login'); }} />
      </aside>
    </>
  );
}
