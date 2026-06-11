import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Filter, X, Send, MessageSquare } from 'lucide-react';
import { AREAS } from '../../data/publicData';

function SendSMSModal({ onSend, onClose }) {
  const { floodWarnings, rescueTeams } = useData();
  const [form, setForm] = useState({ message: '', target: 'area', area_id: '', custom_message: '' });
  const [loading, setLoading] = useState(false);

  const templateMessages = [
    { label: 'Cảnh báo lũ khẩn cấp', text: 'CANH BAO KHAN CAP: Lu dang len cao tai khu vuc cua ban. Hay di tan ngay den diem an toan! Lien he: 0693851000' },
    { label: 'Yêu cầu cứu hộ được tiếp nhận', text: 'FLOODGUARD: Yeu cau cuu ho cua ban da duoc tiep nhan. Doi cuu ho dang tren duong den. Giu lien lac!' },
    { label: 'Đội cứu hộ đang đến', text: 'FLOODGUARD: Doi cuu ho dang tiep can vi tri cua ban. Xin hay o yen tai cho va ra tin hieu!' },
    { label: 'Cứu hộ hoàn tất', text: 'FLOODGUARD: Cam on ban da su dung he thong. Chuc ban va gia dinh binh an!' },
  ];

  const handleSend = () => {
    setLoading(true);
    setTimeout(() => {
      onSend(form);
      setLoading(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>📱 Gửi SMS cảnh báo</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Gửi đến</label>
            <select className="form-input form-select" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}>
              <option value="area">Người dân theo khu vực</option>
              <option value="vulnerable">Hộ dễ bị tổn thương</option>
              <option value="all">Tất cả người đăng ký</option>
            </select>
          </div>
          {form.target === 'area' && (
            <div>
              <label className="form-label">Chọn khu vực</label>
              <select className="form-input form-select" value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}>
                <option value="">Tất cả khu vực</option>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.old_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Mẫu nội dung nhanh</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {templateMessages.map((t, i) => (
                <button key={i} type="button" className="btn btn-secondary btn-sm" style={{ textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setForm(f => ({ ...f, custom_message: t.text }))}>
                  📝 {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Nội dung SMS * <span style={{ color: '#94a3b8', fontWeight: 400 }}>({form.custom_message.length}/160 ký tự)</span></label>
            <textarea className="form-input" rows={4} maxLength={160} value={form.custom_message} onChange={e => setForm(f => ({ ...f, custom_message: e.target.value }))} style={{ resize: 'none' }} placeholder="Nhập nội dung SMS..." />
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem', fontSize: '0.78rem', color: '#854d0e' }}>
            ⚠️ Lưu ý: Chi phí gửi SMS do đơn vị triển khai tự quản lý theo chính sách nhà cung cấp.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={!form.custom_message || loading} onClick={handleSend}>
              <Send size={16} /> {loading ? 'Đang gửi...' : 'Gửi SMS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsAndSMS() {
  const { smsLogs, addSmsLog, floodWarnings } = useData();
  const { currentUser } = useAuth();
  const toast = useToast();
  const [showSend, setShowSend] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const filtered = smsLogs.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (search && !s.phone.includes(search) && !s.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSent = smsLogs.filter(s => s.status === 'SENT').length;
  const totalFailed = smsLogs.filter(s => s.status === 'FAILED').length;
  const totalCost = smsLogs.filter(s => s.status === 'SENT').reduce((sum, s) => sum + (s.cost || 0), 0);

  const handleSend = (form) => {
    const recipientCount = form.target === 'all' ? 7 : 4;
    const phones = Array.from({ length: recipientCount }, (_, index) => `recipient-${index + 1}`);
    phones.forEach(phone => {
      addSmsLog({ phone, message: form.custom_message, provider: 'Viettel SMS', status: Math.random() > 0.08 ? 'SENT' : 'FAILED', cost: 500, related_warning_id: null, related_request_id: null });
    });
    toast.success(`Đã gửi ${phones.length} SMS!`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Quản lý SMS cảnh báo</h1><p className="page-subtitle">Gửi và theo dõi lịch sử tin nhắn SMS</p></div>
        <button className="btn btn-primary" onClick={() => setShowSend(true)}><Send size={16} /> Gửi SMS mới</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Tổng SMS', value: smsLogs.length, color: '#374151' },
          { label: 'Gửi thành công', value: totalSent, color: '#10b981' },
          { label: 'Thất bại', value: totalFailed, color: '#ef4444' },
          { label: 'Tỷ lệ thành công', value: smsLogs.length > 0 ? `${Math.round((totalSent/smsLogs.length)*100)}%` : '—', color: '#3b82f6' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" placeholder="Tìm SĐT hoặc nội dung..." style={{ paddingLeft: 30, width: 220 }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input form-select" style={{ width: 150 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="SENT">Đã gửi</option>
          <option value="FAILED">Thất bại</option>
          <option value="PENDING">Đang gửi</option>
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Số điện thoại</th>
                <th>Nội dung</th>
                <th>Nhà cung cấp</th>
                <th>Trạng thái</th>
                <th>Chi phí</th>
                <th>Thời gian gửi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Không có SMS nào</td></tr>
              ) : filtered.map(sms => (
                <tr key={sms.id}>
                  <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{sms.phone}</td>
                  <td style={{ maxWidth: 300 }}>
                    <div style={{ fontSize: '0.75rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{sms.message}</div>
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{sms.provider}</td>
                  <td>
                    <span className={`badge badge-${sms.status}`}>{sms.status === 'SENT' ? '✅ Đã gửi' : sms.status === 'FAILED' ? '❌ Thất bại' : '⏳ Đang gửi'}</span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{sms.cost ? `${sms.cost.toLocaleString()}đ` : '—'}</td>
                  <td style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(sms.sent_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSend && <SendSMSModal onSend={handleSend} onClose={() => setShowSend(false)} />}
    </div>
  );
}
