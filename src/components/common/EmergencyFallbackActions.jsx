import { Phone, MessageSquare } from 'lucide-react';
import { buildEmergencySmsBody, buildSmsHref } from '../../lib/offlineQueue';

const DEFAULT_COORDINATOR_PHONE = '0693851000';

export default function EmergencyFallbackActions({ payload = {}, dark = false, compact = false }) {
  const coordinatorPhone = import.meta.env.VITE_RESCUE_COORDINATOR_PHONE || DEFAULT_COORDINATOR_PHONE;
  const smsBody = buildEmergencySmsBody(payload);
  const smsHref = buildSmsHref(coordinatorPhone, smsBody);

  const cardBg = dark ? 'rgba(239,68,68,0.08)' : '#fef2f2';
  const border = dark ? 'rgba(239,68,68,0.25)' : '#fecaca';
  const text = dark ? '#fecaca' : '#991b1b';
  const buttonBg = dark ? 'rgba(239,68,68,0.18)' : '#fff';

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: compact ? '0.75rem' : '0.875rem',
      color: text,
      marginBottom: compact ? '0.75rem' : '1rem',
    }}>
      <div style={{ fontWeight: 900, fontSize: compact ? '0.76rem' : '0.82rem', marginBottom: '0.6rem' }}>
        Kênh dự phòng khi mất internet
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {[
          ['114', 'Cứu nạn'],
          ['115', 'Cấp cứu'],
          [coordinatorPhone, 'Điều phối'],
        ].map(([phone, label]) => (
          <a
            key={phone}
            href={`tel:${phone}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '0.55rem 0.35rem',
              borderRadius: 9,
              background: buttonBg,
              border: `1px solid ${border}`,
              color: text,
              textDecoration: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
            }}
          >
            <Phone size={13} /> {label}
          </a>
        ))}
      </div>
      <a
        href={smsHref}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '0.65rem',
          borderRadius: 9,
          background: '#dc2626',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 900,
          fontSize: '0.78rem',
        }}
      >
        <MessageSquare size={15} /> Soạn SMS SOS thủ công
      </a>
      <div style={{ fontSize: '0.68rem', lineHeight: 1.45, marginTop: '0.5rem', opacity: 0.85 }}>
        Nút SMS sẽ mở ứng dụng tin nhắn của điện thoại. Bạn cần bấm gửi trong ứng dụng SMS.
      </div>
    </div>
  );
}
