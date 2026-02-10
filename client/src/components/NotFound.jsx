import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">404</div>
        <h1 className="text-2xl font-bold text-theme-primary mb-2">Page Not Found</h1>
        <p className="text-theme-muted mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold text-sm transition-colors">
            <Home className="w-4 h-4" /> Go Home
          </Link>
          <Link to="/shop" className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border border-edge hover:border-edge-strong text-theme-primary rounded-xl font-semibold text-sm transition-colors">
            <Search className="w-4 h-4" /> Browse Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
