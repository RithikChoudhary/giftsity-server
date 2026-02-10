import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Store, Package, ShoppingCart, Settings, CreditCard, Briefcase, Users, LogOut, Gift, Sun, Moon, ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/sellers', icon: Store, label: 'Sellers' },
  { path: '/admin/customers', icon: Users, label: 'Customers' },
  { path: '/admin/products', icon: Package, label: 'Products' },
  { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { path: '/admin/payouts', icon: CreditCard, label: 'Payouts' },
  { path: '/admin/b2b', icon: Briefcase, label: 'B2B Leads' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/auth');
    else if (user.userType !== 'admin') navigate('/');
  }, [user]);

  if (!user || user.userType !== 'admin') return null;

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
