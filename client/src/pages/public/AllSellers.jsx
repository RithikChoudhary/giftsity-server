import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, Star, MapPin, BadgeCheck, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { storeAPI } from '../../api';
import LoadingSpinner from '../../components/LoadingSpinner';
import SEO from '../../components/SEO';

export default function AllSellers() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState('orders');

  useEffect(() => {
    loadSellers();
  }, [page, sort]);

  const loadSellers = async () => {
    setLoading(true);
    try {
      const { data } = await storeAPI.getAllSellers({ page, limit: 24, sort });
      setSellers(data.sellers || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSort = (val) => {
    setSort(val);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <SEO
        title="All Creators - Giftsity"
        description="Browse all creators on Giftsity. Find unique handcrafted and curated products from verified creators across India."
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary">Our Creators</h1>
          <p className="text-sm text-theme-muted mt-1">{total} creators on Giftsity</p>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-theme-dim" />
          <select
            value={sort}
            onChange={e => handleSort(e.target.value)}
            className="px-3 py-2 bg-card border border-edge/50 rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50"
          >
            <option value="orders">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : sellers.length === 0 ? (
        <div className="text-center py-20">
          <Store className="w-16 h-16 text-theme-dim mx-auto mb-4" />
          <h2 className="text-xl font-bold text-theme-primary mb-2">No creators found</h2>
          <p className="text-theme-muted">Check back later for new creators.</p>
        </div>
      ) : (
        <>
          {/* Sellers Grid -- 3 cols mobile, 4 tablet, 6 desktop */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-6">
            {sellers.map(s => (
              <Link
                key={s._id}
                to={`/store/${s.businessSlug || s._id}`}
                className="group flex flex-col items-center text-center"
              >
                {/* Circle avatar */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-2.5">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-edge/50 group-hover:border-amber-500/50 transition-colors bg-inset shadow-md">
                    {s.avatar?.url ? (
                      <img src={s.avatar.url} alt={s.businessName} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                        <Store className="w-8 h-8 sm:w-10 sm:h-10 text-theme-dim" />
                      </div>
                    )}
                  </div>
                  {/* Verified badge */}
                  {s.isVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[var(--color-base)]">
                      <BadgeCheck className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <p className="text-xs sm:text-sm font-semibold text-theme-primary group-hover:text-amber-400 transition-colors truncate w-full leading-tight">
                  {s.businessName}
                </p>

                {/* Rating */}
                {s.rating > 0 ? (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-[10px] sm:text-xs text-amber-400 font-medium">{s.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-xs text-theme-dim mt-0.5">New</span>
                )}

                {/* City */}
                {s.city && (
                  <p className="text-[10px] text-theme-dim mt-0.5 flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 shrink-0" /> {s.city}
                  </p>
                )}

                {/* Product count */}
                <p className="text-[10px] text-theme-dim mt-0.5">{s.productCount} products</p>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-card border border-edge/50 text-theme-muted hover:text-theme-primary hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-2 text-theme-dim text-sm">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        page === p
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary hover:border-amber-500/50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-2 rounded-lg bg-card border border-edge/50 text-theme-muted hover:text-theme-primary hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
