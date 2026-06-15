import { WifiOff, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';

export default function OfflineStatusBanner({ dark = false }) {
  const { isOnline, offlineQueueCount, offlineSyncing, syncOfflineQueue } = useData();

  if (isOnline && offlineQueueCount === 0 && !offlineSyncing) return null;

  const bg = dark ? 'rgba(251,191,36,0.12)' : '#fffbeb';
  const border = dark ? 'rgba(251,191,36,0.35)' : '#fde68a';
  const color = dark ? '#fde68a' : '#92400e';
  const muted = dark ? '#fbbf24' : '#a16207';

  let text = 'Đang offline. Dữ liệu mới sẽ được lưu tạm trên thiết bị.';
  if (offlineSyncing) text = 'Đang đồng bộ dữ liệu đã lưu tạm...';
  else if (isOnline && offlineQueueCount > 0) text = 'Đã có mạng lại. Hệ thống sẽ tự gửi dữ liệu đã lưu tạm.';
  else if (offlineQueueCount > 0) text = `Đã lưu tạm ${offlineQueueCount} tác vụ. Sẽ tự gửi lại khi có mạng.`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      padding: '0.75rem 0.875rem',
      color,
      fontSize: '0.78rem',
      fontWeight: 700,
      marginBottom: '0.875rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <WifiOff size={16} />
        <span>{text}</span>
      </div>
      {isOnline && offlineQueueCount > 0 && (
        <button
          type="button"
          onClick={syncOfflineQueue}
          disabled={offlineSyncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: `1px solid ${border}`,
            background: dark ? 'rgba(255,255,255,0.08)' : 'white',
            color: muted,
            borderRadius: 8,
            padding: '0.35rem 0.6rem',
            cursor: offlineSyncing ? 'not-allowed' : 'pointer',
            fontWeight: 800,
            fontSize: '0.72rem',
          }}
        >
          <RefreshCw size={13} /> Đồng bộ
        </button>
      )}
    </div>
  );
}
