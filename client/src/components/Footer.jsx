import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-edge/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-3">Giftsity</h3>
            <p className="text-sm text-theme-muted">The gift marketplace. Find the perfect gift from hundreds of sellers.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-3">Shop</h4>
            <div className="space-y-2">
              <Link to="/shop" className="block text-sm text-theme-muted hover:text-theme-secondary transition-colors">All Gifts</Link>
              <Link to="/shop?category=tech-gadgets" className="block text-sm text-theme-muted hover:text-theme-secondary transition-colors">Tech Gadgets</Link>
              <Link to="/shop?category=gift-hampers" className="block text-sm text-theme-muted hover:text-theme-secondary transition-colors">Gift Hampers</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-3">Business</h4>
            <div className="space-y-2">
              <Link to="/b2b" className="block text-sm text-theme-muted hover:text-theme-secondary transition-colors">Corporate Gifting</Link>
              <Link to="/seller/join" className="block text-sm text-theme-muted hover:text-theme-secondary transition-colors">Sell on Giftsity</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-theme-secondary mb-3">Support</h4>
            <div className="space-y-2">
              <a href="mailto:burnt776@gmail.com" className="block text-sm text-theme-muted hover:text-theme-secondary transition-colors">Contact Us</a>
            </div>
          </div>
        </div>
        <div className="border-t border-edge/50 mt-8 pt-6 text-center">
          <p className="text-xs text-theme-dim">&copy; {new Date().getFullYear()} Giftsity. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
