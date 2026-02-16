import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationAPI } from '../api';
import { useSocket } from '../context/SocketContext';

export default function NotificationBell() {
  const { unreadNotifications, setUnreadNotifications } = useSocket();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch unread count on mount
  useEffect(() => {
    notificationAPI.getUnreadCount()
      .then(res => setUnreadNotifications(res.data.count))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && items.length === 0) {
      setLoading(true);
      try {
        const res = await notificationAPI.getAll({ limit: 8 });
        setItems(res.data.notifications || []);
      } catch {}
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setUnreadNotifications(0);
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const timeSince = (date) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={toggleOpen} className="relative p-2 rounded-lg hover:bg-theme-hover transition-colors" title="Notifications">
        <Bell className="w-5 h-5 text-theme-secondary" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-theme-card border border-theme-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
            <span className="font-semibold text-sm text-theme-primary">Notifications</span>
            {unreadNotifications > 0 && (
              <button onClick={markAllRead} className="text-xs text-amber-500 hover:text-amber-400">Mark all read</button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-theme-muted">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center text-sm text-theme-muted">No notifications yet</div>
            ) : (
              items.map(n => (
                <Link
                  key={n._id}
                  to={n.link || '/notifications'}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 hover:bg-theme-hover transition-colors border-b border-theme-border/50 ${!n.isRead ? 'bg-amber-500/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">{n.title}</p>
                      {n.message && <p className="text-xs text-theme-muted mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[11px] text-theme-dim mt-1">{timeSince(n.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center py-2.5 text-xs font-medium text-amber-500 hover:bg-theme-hover border-t border-theme-border"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
