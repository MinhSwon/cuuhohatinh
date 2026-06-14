import { useEffect, useState } from 'react';
import axios from 'axios';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { Search, X, Send } from 'lucide-react';
import { AREAS } from '../../data/publicData';

function splitPhones(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map(phone => phone.trim())
    .filter(Boolean);
}

function SendSMSModal({ onSend, onClose }) {
  const [form, setForm] = useState({
    target: 'direct',
    area_id: '',
    phones: '',
    custom_message: 'FLOODGUARD: Day la tin nhan kiem tra tu he thong cuu ho. Neu ban nhan duoc tin nay, SMS Gateway da hoat dong.',
  });
  const [loading, setLoading] = useState(false);

  const templateMessages = [
    {
      label: 'Cảnh báo lũ khẩn cấp',
      text: 'FLOODGUARD: Canh bao lu khan cap tai khu vuc cua ban. Hay di chuyen den diem an toan va theo doi huong dan tu doi dieu phoi.',
    },
    {
      label: 'Xác nhận tiếp nhận cứu hộ',
      text: 'FLOODGUARD: Yeu cau cuu ho cua ban da duoc tiep nhan. Hay giu dien thoai, o vi tri an toan va doi doi cuu ho lien he.',
    },
    {
      label: 'Đội cứu hộ đang đến',
      text: 'FLOODGUARD: Doi cuu ho da nhan nhiem vu va dang den vi tri cua ban. Hay ra tin hieu khi thay doi va giu lien lac.',
    },
    {
      label: 'Gửi thử SMS',
      text: 'FLOODGUARD: Day la tin nhan kiem tra tu he thong cuu ho. Neu ban nhan duoc tin nay, SMS Gateway da hoat dong.',
    },
  ];

  const handleSend = async () => {
    setLoading(true);
    try {
      await onSend({
        target: form.target,
        area_id: form.area_id,
        phones: form.target === 'direct' ? splitPhones(form.phones) : undefined,
        custom_message: form.custom_message,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const directPhones = splitPhones(form.phones);
  const canSend = Boolean(form.custom_message.trim()) && (form.target !== 'direct' || directPhones.length > 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Gửi SMS cảnh báo</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Gửi đến</label>
            <select
              className="form-input form-select"
              value={form.target}
              onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
            >
              <option value="direct">Gửi thử tới số điện thoại</option>
              <option value="area">Người dân theo khu vực</option>
              <option value="vulnerable">Hộ dễ bị tổn thương</option>
              <option value="all">Tất cả người đăng ký</option>
            </select>
          </div>

          {form.target === 'direct' && (
            <div>
              <label className="form-label">Số điện thoại nhận SMS *</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.phones}
                onChange={e => setForm(f => ({ ...f, phones: e.target.value }))}
                placeholder="Ví dụ: 0945121566 hoặc +84945121566. Có thể nhập nhiều số, mỗi số một dòng."
                style={{ resize: 'none' }}
              />
              <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#64748b' }}>
                Đã nhập {directPhones.length} số. Hệ thống sẽ tự chuẩn hóa số Việt Nam về dạng 84...
              </div>
            </div>
          )}

          {form.target === 'area' && (
            <div>
              <label className="form-label">Chọn khu vực</label>
              <select
                className="form-input form-select"
                value={form.area_id}
                onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}
              >
                <option value="">Tất cả khu vực</option>
                {AREAS.map(area => (
                  <option key={area.id} value={area.id}>{area.old_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label">Mẫu nội dung nhanh</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {templateMessages.map(template => (
                <button
                  key={template.label}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => setForm(f => ({ ...f, custom_message: template.text }))}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">
              Nội dung SMS * <span style={{ color: '#94a3b8', fontWeight: 400 }}>({form.custom_message.length}/500 ký tự)</span>
            </label>
            <textarea
              className="form-input"
              rows={5}
              maxLength={500}
              value={form.custom_message}
              onChange={e => setForm(f => ({ ...f, custom_message: e.target.value }))}
              style={{ resize: 'none' }}
              placeholder="Nhập nội dung SMS..."
            />
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem', fontSize: '0.78rem', color: '#854d0e' }}>
            Lưu ý: SMS thật sẽ trừ tiền theo chính sách của eSMS. Hãy gửi thử 1 số trước khi gửi hàng loạt.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={!canSend || loading} onClick={handleSend}>
              <Send size={16} /> {loading ? 'Đang gửi...' : 'Gửi SMS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderStatusCard() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    axios.get('/api/notifications/provider-status')
      .then(res => {
        if (mounted) setStatus(res.data);
      })
      .catch(() => {
        if (mounted) setStatus({ error: true });
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!status) return null;

  const smsReady = status.sms_configured;
  return (
    <div
      className="card"
      style={{
        marginBottom: '1rem',
        padding: '1rem',
        borderLeft: `4px solid ${smsReady ? '#10b981' : '#ef4444'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, color: '#1f2937' }}>Trạng thái SMS Gateway</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
            Nhà cung cấp: {status.provider || 'eSMS'} | Chế độ: {status.sandbox ? 'Sandbox/Test' : 'Gửi thật'}
          </div>
        </div>
        <span className={`badge badge-${smsReady ? 'SENT' : 'FAILED'}`}>
          {smsReady ? 'Đã cấu hình' : 'Thiếu cấu hình'}
        </span>
      </div>
      {!smsReady && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#b91c1c' }}>
          Cần bổ sung: {(status.missing_env || ['ESMS_API_KEY', 'ESMS_SECRET_KEY', 'ESMS_BRANDNAME']).join(', ')} trên Render/local .env.
        </div>
      )}
      {smsReady && (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#475569' }}>
          Số điều phối nhận SOS tự động: {status.coordinator_phone_count || 0}. Nếu bằng 0, thêm RESCUE_COORDINATOR_PHONES để điều phối viên nhận SMS khi có yêu cầu cứu hộ mới.
        </div>
      )}
    </div>
  );
}

export default function AlertsAndSMS() {
  const { smsLogs, sendSmsNotification } = useData();
  const toast = useToast();
  const [showSend, setShowSend] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const filtered = smsLogs.filter(sms => {
    const phone = String(sms.phone || '');
    const message = String(sms.message || '');
    if (filterStatus && sms.status !== filterStatus) return false;
    if (search && !phone.includes(search) && !message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSent = smsLogs.filter(sms => sms.status === 'SENT').length;
  const totalFailed = smsLogs.filter(sms => sms.status === 'FAILED').length;

  const handleRealSend = async (form) => {
    try {
      const result = await sendSmsNotification({
        target: form.target,
        area_id: form.area_id,
        phones: form.phones,
        message: form.custom_message,
      });

      if (result.failed > 0) {
        toast.warning(`Đã gửi ${result.sent}/${result.total} tin. ${result.failed} tin thất bại.`);
      } else {
        toast.success(`Đã gửi ${result.sent} SMS thành công.`);
      }
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Không gửi được SMS. Kiểm tra cấu hình eSMS, số dư và Brandname.';
      toast.error(message);
      throw err;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý SMS cảnh báo</h1>
          <p className="page-subtitle">Gửi SMS cứu hộ thật qua eSMS và theo dõi lịch sử gửi tin</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSend(true)}>
          <Send size={16} /> Gửi SMS mới
        </button>
      </div>

      <ProviderStatusCard />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Tổng SMS', value: smsLogs.length, color: '#374151' },
          { label: 'Gửi thành công', value: totalSent, color: '#10b981' },
          { label: 'Thất bại', value: totalFailed, color: '#ef4444' },
          { label: 'Tỷ lệ thành công', value: smsLogs.length > 0 ? `${Math.round((totalSent / smsLogs.length) * 100)}%` : '-', color: '#3b82f6' },
        ].map(item => (
          <div key={item.label} className="stat-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            className="form-input"
            placeholder="Tìm SĐT hoặc nội dung..."
            style={{ paddingLeft: 30, width: 220 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Chưa có SMS nào
                  </td>
                </tr>
              ) : filtered.map(sms => (
                <tr key={sms.id}>
                  <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{sms.phone}</td>
                  <td style={{ maxWidth: 360 }}>
                    <div style={{ fontSize: '0.75rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                      {sms.message}
                    </div>
                    {sms.error && (
                      <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#ef4444' }}>
                        Lỗi: {sms.error}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>{sms.provider}</td>
                  <td>
                    <span className={`badge badge-${sms.status}`}>
                      {sms.status === 'SENT' ? 'Đã gửi' : sms.status === 'FAILED' ? 'Thất bại' : 'Đang gửi'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{sms.cost ? `${sms.cost.toLocaleString()}đ` : '-'}</td>
                  <td style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {sms.sent_at ? new Date(sms.sent_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSend && <SendSMSModal onSend={handleRealSend} onClose={() => setShowSend(false)} />}
    </div>
  );
}
