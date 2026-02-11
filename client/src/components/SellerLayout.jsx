import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../api';
import { LayoutDashboard, Package, ShoppingCart, CreditCard, Megaphone, Settings, LogOut, Gift, Sun, Moon, ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const navItems = [
  { path: '/seller', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/seller/products', icon: Package, label: 'Products' },
  { path: '/seller/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/seller/payouts', icon: CreditCard, label: 'Payouts' },
  { path: '/seller/marketing', icon: Megaphone, label: 'Marketing' },
  { path: '/seller/settings', icon: Settings, label: 'Settings' },
];

export default function SellerLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!user) { navigate('/auth'); return; }
      if (user.userType !== 'seller') { navigate('/'); return; }
      try {
        const { data } = await authAPI.me();
        if (cancelled) return;
        if (data.user?.userType === 'seller') { setVerified(true); }
        else { logout(); navigate('/auth'); }
      } catch {
        if (!cancelled) { logout(); navigate('/auth'); }
      } finally { if (!cancelled) setChecking(false); }
    };
    verify();
    return () => { cancelled = true; };
  }, [user]);

  if (checking || !verified) return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
    </div>
  );

  const isPending = user.status === 'pending';
  const isSuspended = user.status === 'suspended';

  return (
    <div className="flex min-h-screen bg-surface text-theme-primary">
      <aside className="w-64 bg-card border-r border-edge/50 flex flex-col shrink-0">
        <div className="p-5 border-b border-edge/50">
          <Link to="/" className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-amber-400" />
            <span className="text-lg font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Giftsity</span>
          </Link>
          <p className="text-xs text-theme-dim mt-1">Seller Dashboard</p>
        </div>

        {isPending && (
          <div className="mx-3 mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-xs text-yellow-400 font-medium">Account Pending Approval</p>
            <p className="text-xs text-theme-muted mt-1">Your account is under review by admin.</p>
          </div>
        )}

        {isSuspended && (
          <div className="mx-3 mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400 font-medium">Account Suspended</p>
            <p className="text-xs text-theme-muted mt-1">Your listings are hidden. Go to Settings to request reactivation.</p>
          </div>
        )}

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path ? 'bg-amber-500/10 text-amber-400' : 'text-theme-muted hover:text-theme-primary hover:bg-inset/50'}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-edge/50 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-theme-muted hover:text-theme-primary hover:bg-inset/50 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Site
          </Link>
          <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-theme-muted hover:text-theme-primary hover:bg-inset/50 transition-colors w-full">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-inset/50 transition-colors w-full">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
