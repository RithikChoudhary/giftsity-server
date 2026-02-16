import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { notificationAPI } from '../../api';
import { useSocket } from '../../context/SocketContext';
import SEO from '../../components/SEO';

export default function Notifications() {
  const { setUnreadNotifications } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchNotifications = async (p = 1) => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll({ page: p, limit: 20 });
      setNotifications(res.data.notifications || []);
      setPages(res.data.pages || 1);
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setUnreadNotifications(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const timeSince = (date) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const typeIcons = {
    order_confirmed: '📦', order_shipped: '🚚', order_delivered: '✅', order_cancelled: '❌',
    new_message: '💬', return_requested: '↩️', return_approved: '✅', return_rejected: '❌', return_refunded: '💰',
    payout_processed: '💰', payout_failed: '⚠️', review_received: '⭐', seller_approved: '🎉', seller_suspended: '🚫',
    general: '🔔'
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <SEO title="Notifications" noIndex />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notifications
        </h1>
        <button onClick={markAllRead} className="flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400 transition-colors">
          <CheckCheck className="w-4 h-4" /> Mark all read
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-theme-muted">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n._id} className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${n.isRead ? 'bg-theme-card border-theme-border/50' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <span className="text-lg flex-shrink-0 mt-0.5">{typeIcons[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                {n.link ? (
                  <Link to={n.link} className="text-sm font-medium text-theme-primary hover:text-amber-500 transition-colors">{n.title}</Link>
                ) : (
                  <p className="text-sm font-medium text-theme-primary">{n.title}</p>
                )}
                {n.message && <p className="text-xs text-theme-muted mt-0.5">{n.message}</p>}
                <p className="text-[11px] text-theme-dim mt-1">{timeSince(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <button onClick={() => markRead(n._id)} className="p-1 text-theme-dim hover:text-amber-500 transition-colors" title="Mark as read">
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => fetchNotifications(i + 1)} className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-amber-500 text-black' : 'bg-theme-card text-theme-muted hover:bg-theme-hover'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
