import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { ShoppingBag, User, Menu, X, LogOut, Package, Sun, Moon, Search, Heart, ArrowLeftRight, MessageCircle, RotateCcw, Bell } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { notificationAPI } from '../api';

export default function Navbar() {
  const { user, logout, availableRoles, switchRole } = useAuth();
  const { items } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { unreadNotifications, setUnreadNotifications } = useSocket();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [switchingRole, setSwitchingRole] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (user) {
      notificationAPI.getUnreadCount()
        .then(res => setUnreadNotifications(res.data.count))
        .catch(() => {});
    }
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
      setMenuOpen(false);
    }
  };

  const isCustomer = !user || user.userType === 'customer';
  const isSeller = user?.userType === 'seller';
  const isAdmin = user?.userType === 'admin';
  const canSwitchRole = availableRoles.length > 1;

  const handleSwitchRole = async (targetRole) => {
    if (switchingRole) return;
    setSwitchingRole(true);
    try {
      await switchRole(targetRole);
      setUserMenu(false);
      setMenuOpen(false);
      if (targetRole === 'seller') navigate('/seller');
      else if (targetRole === 'admin') navigate('/admin');
      else navigate('/');
    } catch (err) {
      console.error('Role switch failed:', err);
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-edge/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/logo.png" alt="Giftsity" className="h-10 w-10 rounded-lg object-contain group-hover:scale-105 transition-transform" />
            <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Giftsity</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/shop" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Shop</Link>
            <Link to="/sellers" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Creators</Link>
            <Link to="/about" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">About</Link>
            {(!user || isAdmin) && (
              <Link to="/b2b" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Corporate</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Admin</Link>
            )}
            {isSeller && (
              <Link to="/seller" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Dashboard</Link>
            )}
            {(!user || isAdmin) && (
              <Link to="/seller/join" className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium">Sell on Giftsity</Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                    placeholder="Search gifts..."
                    className="w-48 px-3 py-1.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1.5 text-theme-dim hover:text-theme-primary ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <button onClick={() => setSearchOpen(true)} className="p-2 rounded-lg hover:bg-inset/50 text-theme-muted hover:text-theme-primary transition-all" title="Search">
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Theme toggle */}
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-inset/50 text-theme-muted hover:text-theme-primary transition-all" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Cart */}
            <Link to="/cart" className="relative p-2 rounded-lg hover:bg-inset/50 text-theme-muted hover:text-theme-primary transition-all">
              <ShoppingBag className="w-5 h-5" />
              {items.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-zinc-950 rounded-full text-[10px] flex items-center justify-center font-bold">{items.length}</span>
              )}
            </Link>

            {/* User */}
            {user ? (
              <div className="relative">
                <button onClick={() => setUserMenu(!userMenu)} className="relative flex items-center gap-2 p-2 rounded-lg hover:bg-inset/50 text-theme-muted hover:text-theme-primary transition-all">
                  <User className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface" />
                  )}
                  <span className="hidden sm:block text-sm">{user.name?.split(' ')[0]}</span>
                </button>
                {userMenu && (
                  <div className="absolute right-0 mt-2 w-52 bg-card border border-edge rounded-xl shadow-xl py-1 animate-fade-in z-50">
                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link to="/orders" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
                    <Link to="/wishlist" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <Heart className="w-4 h-4" /> Wishlist
                    </Link>
                    <Link to={user.role === 'seller' ? '/seller/chat' : '/chat'} className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <MessageCircle className="w-4 h-4" /> Messages
                    </Link>
                    <Link to="/notifications" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <Bell className="w-4 h-4" /> Notifications
                      {unreadNotifications > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {unreadNotifications > 99 ? '99+' : unreadNotifications}
                        </span>
                      )}
                    </Link>
                    <Link to="/returns" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <RotateCcw className="w-4 h-4" /> Returns
                    </Link>
                    {canSwitchRole && (
                      <>
                        <div className="border-t border-edge/50 my-1" />
                        <div className="px-4 py-1.5">
                          <span className="text-[11px] uppercase tracking-wider text-theme-dim font-medium">Switch to</span>
                        </div>
                        {availableRoles.filter(r => r !== (user?.role || user?.userType)).map(targetRole => (
                          <button
                            key={targetRole}
                            onClick={() => handleSwitchRole(targetRole)}
                            disabled={switchingRole}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-inset/50 w-full text-left disabled:opacity-50"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                            {targetRole === 'seller' ? 'Creator Dashboard' : targetRole === 'admin' ? 'Admin Dashboard' : 'Customer'}
                          </button>
                        ))}
                      </>
                    )}
                    <div className="border-t border-edge/50 my-1" />
                    <button onClick={() => { logout(); setUserMenu(false); navigate('/'); }} className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-inset/50 w-full text-left">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold transition-colors">Sign In</Link>
            )}

            {/* Mobile menu */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-theme-muted hover:text-theme-primary">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-edge bg-card animate-fade-in">
          <div className="px-4 py-3 space-y-2">
            <form onSubmit={handleSearch} className="flex gap-2 mb-2">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search gifts..." className="flex-1 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <button type="submit" className="px-3 py-2 bg-amber-500 text-zinc-950 rounded-lg"><Search className="w-4 h-4" /></button>
            </form>
            <Link to="/shop" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>Shop</Link>
            <Link to="/sellers" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>Creators</Link>
            <Link to="/about" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>About</Link>
            <Link to="/contact" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>Contact</Link>
            {(!user || isAdmin) && (
              <>
                <Link to="/b2b" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>Corporate</Link>
                <Link to="/seller/join" className="block py-2 text-sm text-amber-400" onClick={() => setMenuOpen(false)}>Sell on Giftsity</Link>
              </>
            )}
            {isSeller && <Link to="/seller" className="block py-2 text-sm text-theme-secondary" onClick={() => setMenuOpen(false)}>Creator Dashboard</Link>}
            {isAdmin && <Link to="/admin" className="block py-2 text-sm text-theme-secondary" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>}
            {canSwitchRole && (
              <>
                <div className="border-t border-edge/50 my-2" />
                <p className="text-[11px] uppercase tracking-wider text-theme-dim font-medium pb-1">Switch to</p>
                {availableRoles.filter(r => r !== (user?.role || user?.userType)).map(targetRole => (
                  <button
                    key={targetRole}
                    onClick={() => handleSwitchRole(targetRole)}
                    disabled={switchingRole}
                    className="flex items-center gap-2 py-2 text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50 w-full text-left"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    {targetRole === 'seller' ? 'Creator Dashboard' : targetRole === 'admin' ? 'Admin Dashboard' : 'Customer'}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
