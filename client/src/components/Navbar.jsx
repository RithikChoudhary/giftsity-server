import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { ShoppingBag, User, Menu, X, LogOut, Package, Sun, Moon, Gift, Search } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const isCustomer = !user || user.userType === 'customer';
  const isSeller = user?.userType === 'seller';
  const isAdmin = user?.userType === 'admin';

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-edge/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <Gift className="w-6 h-6 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span className="text-lg font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Giftsity</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/shop" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Shop</Link>
            {!isCustomer && !isSeller && (
              <Link to="/b2b" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Corporate</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Admin</Link>
            )}
            {isSeller && (
              <Link to="/seller" className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Dashboard</Link>
            )}
            {!isCustomer || isAdmin ? (
              <Link to="/seller/join" className="text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium">Sell on Giftsity</Link>
            ) : null}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
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
                <button onClick={() => setUserMenu(!userMenu)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-inset/50 text-theme-muted hover:text-theme-primary transition-all">
                  <User className="w-5 h-5" />
                  <span className="hidden sm:block text-sm">{user.name?.split(' ')[0]}</span>
                </button>
                {userMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-edge rounded-xl shadow-xl py-1 animate-fade-in z-50">
                    <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link to="/orders" className="flex items-center gap-2 px-4 py-2 text-sm text-theme-secondary hover:bg-inset/50" onClick={() => setUserMenu(false)}>
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
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
            <Link to="/shop" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>Shop</Link>
            {!isCustomer && (
              <>
                <Link to="/b2b" className="block py-2 text-sm text-theme-secondary hover:text-theme-primary" onClick={() => setMenuOpen(false)}>Corporate</Link>
                <Link to="/seller/join" className="block py-2 text-sm text-amber-400" onClick={() => setMenuOpen(false)}>Sell on Giftsity</Link>
              </>
            )}
            {isSeller && <Link to="/seller" className="block py-2 text-sm text-theme-secondary" onClick={() => setMenuOpen(false)}>Seller Dashboard</Link>}
            {isAdmin && <Link to="/admin" className="block py-2 text-sm text-theme-secondary" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>}
          </div>
        </div>
      )}
    </nav>
  );
}
