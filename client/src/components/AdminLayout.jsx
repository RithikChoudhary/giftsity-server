import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../api';
import { LayoutDashboard, Store, Package, ShoppingCart, Settings, CreditCard, Briefcase, Users, LogOut, Gift, Sun, Moon, ArrowLeft, FolderTree, Building2, ShoppingBag, FileText, ScrollText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/sellers', icon: Store, label: 'Sellers' },
  { path: '/admin/customers', icon: Users, label: 'Customers' },
  { path: '/admin/products', icon: Package, label: 'Products' },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/admin/payouts', icon: CreditCard, label: 'Payouts' },
  { path: '/admin/categories', icon: FolderTree, label: 'Categories' },
  { path: '/admin/coupons', icon: FolderTree, label: 'Coupons' },
  { path: '/admin/b2b', icon: Briefcase, label: 'B2B Leads' },
  { path: '/admin/corporate/users', icon: Building2, label: 'Corp Users' },
  { path: '/admin/corporate/catalog', icon: ShoppingBag, label: 'Corp Catalog' },
  { path: '/admin/corporate/quotes', icon: FileText, label: 'Corp Quotes' },
  { path: '/admin/logs', icon: ScrollText, label: 'Audit Logs' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout() {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return; // wait for auth hydration
    let cancelled = false;
    const verify = async () => {
      if (!user) { navigate('/auth'); return; }
      if (user.userType !== 'admin') { navigate('/'); return; }
      try {
        const { data } = await authAPI.me();
        if (cancelled) return;
        if (data.user?.userType === 'admin') { setVerified(true); }
        else { logout(); navigate('/auth'); }
      } catch {
        if (!cancelled) { logout(); navigate('/auth'); }
      } finally { if (!cancelled) setChecking(false); }
    };
    verify();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (checking || !verified) return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface text-theme-primary">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-edge/50 flex flex-col shrink-0">
        <div className="p-5 border-b border-edge/50">
          <Link to="/" className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-amber-400" />
            <span className="text-lg font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Giftsity</span>
          </Link>
          <p className="text-xs text-theme-dim mt-1">Admin Panel</p>
        </div>
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
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
