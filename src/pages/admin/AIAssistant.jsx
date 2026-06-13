import { useState, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { Bot, Send, Loader } from 'lucide-react';
import { getSafeZoneOccupancy } from '../../utils/safeZones';

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    content: '👋 Xin chào! Tôi là **AI Trợ lý FloodGuard Hương Khê**.\n\nTôi có thể giúp bạn:\n- 📊 Tóm tắt tình hình hiện tại\n- 🗺️ Gợi ý khu vực có nguy cơ cao\n- 🛡️ Gợi ý đội cứu hộ phù hợp\n- 📱 Viết nội dung SMS cảnh báo\n- 📈 Phân tích báo cáo nhanh\n\nBạn cần hỗ trợ gì?',
  },
];

function generateAIResponse(message, data) {
  const { rescueRequests, rescueTeams, floodWarnings, safeZones, smsLogs, vulnerableHouseholds } = data;
  const msg = message.toLowerCase();

  if (msg.includes('tình hình') || msg.includes('tổng quan') || msg.includes('summary')) {
    const pending = rescueRequests.filter(r => r.status === 'PENDING').length;
    const active = floodWarnings.filter(w => w.status === 'PUBLISHED').length;
    const available = rescueTeams.filter(t => t.status === 'AVAILABLE').length;
    return `📊 **Tình hình hiện tại - ${new Date().toLocaleString('vi-VN')}**\n\n🌊 **Cảnh báo lũ:** ${active} đang hoạt động\n⚠️ **Yêu cầu cứu hộ chờ xử lý:** ${pending} yêu cầu\n🛡️ **Đội cứu hộ sẵn sàng:** ${available}/${rescueTeams.length} đội\n📱 **SMS đã gửi:** ${smsLogs.filter(s => s.status === 'SENT').length} tin\n\n${pending > 2 ? '🔴 **Khuyến nghị:** Có nhiều yêu cầu chờ xử lý. Cần phân công đội cứu hộ ngay!' : '✅ Tình hình đang được kiểm soát tốt.'}`;
  }

  if (msg.includes('khu vực nguy cơ') || msg.includes('nguy hiểm') || msg.includes('rủi ro')) {
    const areas = [...new Set(rescueRequests.map(r => r.area_name))];
    const areaStats = areas.map(a => ({ name: a, count: rescueRequests.filter(r => r.area_name === a).length })).sort((a, b) => b.count - a.count);
    return `🗺️ **Phân tích khu vực nguy cơ cao:**\n\n${areaStats.map((a, i) => `${i === 0 ? '🔴' : i === 1 ? '🟠' : '🟡'} **${a.name}**: ${a.count} yêu cầu cứu hộ`).join('\n')}\n\n📍 **Hà Linh** đang có cảnh báo khẩn cấp - cần ưu tiên nguồn lực ngay!`;
  }

  if (msg.includes('đội cứu hộ') || msg.includes('phân công') || msg.includes('assign')) {
    const available = rescueTeams.filter(t => t.status === 'AVAILABLE');
    return `🛡️ **Đội cứu hộ sẵn sàng (${available.length}/${rescueTeams.length}):**\n\n${available.map(t => `✅ **${t.team_name}**\n   👤 ${t.leader_name} | 📞 ${t.phone} | 👥 ${t.member_count} người`).join('\n\n')}\n\n💡 **Khuyến nghị:** Ưu tiên đội theo khu vực phụ trách để giảm thời gian di chuyển.`;
  }

  if (msg.includes('sms') || msg.includes('tin nhắn') || msg.includes('nội dung')) {
    return `📱 **Mẫu SMS cảnh báo lũ:**\n\n**🔴 Khẩn cấp:**\nCẢNH BÁO KHẨN CẤP: Lũ đang lên cao. Hãy di tản ngay! Điểm sơ tán: Trường THCS Hương Khê. LH khẩn: 0693851000\n\n**🟠 Mức cao:**\nCẢNH BÁO LŨ: Nước đang dâng, hãy chuẩn bị di tản. Theo dõi tin tức trên loa phát thanh.\n\n**🟡 Theo dõi:**\nCẢNH BÁO: Mực nước các suối đang tăng. Hãy chú ý và sẵn sàng di tản khi có lệnh.\n\n💡 *Gợi ý: Nội dung SMS dưới 160 ký tự để tránh bị tách tin.*`;
  }

  if (msg.includes('thống kê') || msg.includes('báo cáo') || msg.includes('phân tích')) {
    const total = rescueRequests.length;
    const success = rescueRequests.filter(r => ['RESCUED', 'TRANSFERRED_SAFEZONE'].includes(r.status)).length;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;
    return `📈 **Phân tích nhanh hôm nay:**\n\n📊 **Tổng yêu cầu:** ${total}\n✅ **Cứu thành công:** ${success} (${rate}%)\n⚠️ **Hộ dễ tổn thương:** ${vulnerableHouseholds.length} hộ\n🏫 **Điểm sơ tán còn chỗ:** ${safeZones.filter(s => s.status === 'AVAILABLE').length}/${safeZones.length}\n\n${rate < 60 ? '⚠️ Tỷ lệ cứu thành công thấp. Cần kiểm tra lại quy trình phân công.' : '✅ Hiệu suất cứu hộ đang tốt.'}`;
  }

  if (msg.includes('điểm sơ tán') || msg.includes('shelter')) {
    return `🏫 **Tình trạng điểm sơ tán:**\n\n${safeZones.map(sz => {
      const occupancy = getSafeZoneOccupancy(sz);
      return `${occupancy.percent >= 100 ? '🔴' : occupancy.percent >= 75 ? '🟡' : '🟢'} **${occupancy.name}**: ${occupancy.current_people}/${occupancy.capacity || '?'} người (${occupancy.hasCapacity ? `${occupancy.percent}%` : 'thiếu dữ liệu'})`;
    }).join('\n')}\n\n💡 **Khuyến nghị:** Ưu tiên đưa người đến các điểm còn nhiều chỗ trống.`;
  }

  return `🤔 Tôi hiểu câu hỏi của bạn về: **"${message}"**\n\nTôi có thể tư vấn về:\n- **Tình hình hiện tại** - gõ "tóm tắt tình hình"\n- **Khu vực nguy cơ** - gõ "khu vực nguy cơ"\n- **Đội cứu hộ sẵn sàng** - gõ "đội cứu hộ"\n- **Nội dung SMS** - gõ "viết SMS"\n- **Phân tích thống kê** - gõ "thống kê"\n- **Điểm sơ tán** - gõ "điểm sơ tán"\n\nBạn muốn hỏi gì?`;
}

export default function AIAssistant() {
  const data = useData();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickPrompts = [
    'Tóm tắt tình hình hiện tại',
    'Khu vực nào có nguy cơ cao?',
    'Đội cứu hộ nào đang sẵn sàng?',
    'Viết nội dung SMS cảnh báo',
    'Phân tích thống kê hôm nay',
    'Tình trạng điểm sơ tán?',
  ];

  const handleSend = (text) => {
    const msg = text || input;
    if (!msg.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    setTimeout(() => {
      const response = generateAIResponse(msg, data);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setLoading(false);
    }, 800 + Math.random() * 600);
  };

  const formatContent = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot size={24} color="#8b5cf6" /> AI Trợ lý FloodGuard
          </h1>
          <p className="page-subtitle">Hỗ trợ phân tích và ra quyết định trong công tác cứu hộ</p>
        </div>
        <span style={{ background: '#f5f3ff', color: '#7c3aed', borderRadius: 8, padding: '0.375rem 0.875rem', fontSize: '0.75rem', fontWeight: 600 }}>
          🤖 Đang hoạt động
        </span>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={16} color="white" />
                </div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '0.875rem 1rem',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'white',
                color: msg.role === 'user' ? 'white' : '#374151',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: msg.role === 'assistant' ? '1px solid #f1f5f9' : 'none',
              }}>
                <span dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
              </div>
              {msg.role === 'user' && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontSize: '0.8rem', fontWeight: 700 }}>
                  A
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} color="white" />
              </div>
              <div style={{ padding: '0.875rem 1rem', borderRadius: '16px 16px 16px 4px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Loader size={14} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>AI đang phân tích...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f8fafc', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {quickPrompts.map((p, i) => (
            <button key={i} className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem' }} onClick={() => handleSend(p)}>
              {p}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem' }}>
          <input
            className="form-input"
            placeholder="Hỏi AI trợ lý về tình hình lũ lụt, đội cứu hộ..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={() => handleSend()} disabled={!input.trim() || loading}>
            <Send size={16} />
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
