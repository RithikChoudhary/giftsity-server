import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gift, ArrowRight, Sparkles, Store, Star, TrendingUp, ShoppingBag, Truck, Shield, Heart } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [recent, setRecent] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [featRes, recRes, sellerRes, catRes] = await Promise.all([
        API.get('/api/products?featured=true&limit=4').catch(() => ({ data: { products: [] } })),
        API.get('/api/products?limit=8&sort=newest').catch(() => ({ data: { products: [] } })),
        API.get('/api/store/top-sellers').catch(() => ({ data: [] })),
        API.get('/api/products/categories').catch(() => ({ data: [] }))
      ]);
      setFeatured(featRes.data.products || []);
      setRecent(recRes.data.products || []);
      setTopSellers(Array.isArray(sellerRes.data) ? sellerRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-surface via-card to-surface">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-medium mb-6">
              <Sparkles className="w-3 h-3" /> The Gift Marketplace
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
              Find the <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Perfect Gift</span> for Every Occasion
            </h1>
            <p className="text-lg text-theme-muted mb-8 max-w-xl">
              Discover handpicked gifts from hundreds of independent sellers. From tech gadgets to artisan crafts.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold transition-colors">
                Explore Gifts <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/b2b" className="inline-flex items-center gap-2 px-6 py-3 bg-card border border-edge hover:border-edge-strong text-theme-primary rounded-xl font-semibold transition-colors">
                Corporate Gifting
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-edge/50 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: ShoppingBag, title: 'Curated Gifts', sub: 'Handpicked quality' },
              { icon: Truck, title: 'Fast Delivery', sub: 'Pan India shipping' },
              { icon: Shield, title: 'Secure Payment', sub: 'Cashfree powered' },
              { icon: Heart, title: '0% Platform Fee', sub: 'Best prices guaranteed' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <b.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{b.title}</p>
                  <p className="text-xs text-theme-muted">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-theme-primary">Shop by Category</h2>
            <Link to="/shop" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.slice(0, 10).map(cat => (
              <Link key={cat._id || cat.slug} to={`/shop?category=${cat.slug}`} className="group bg-card border border-edge/50 rounded-xl p-4 text-center hover:border-amber-500/30 hover:bg-amber-500/5 transition-all">
                <div className="text-2xl mb-2">{cat.icon || '🎁'}</div>
                <p className="text-sm font-medium text-theme-secondary group-hover:text-amber-400 transition-colors">{cat.name}</p>
                {cat.productCount > 0 && <p className="text-xs text-theme-dim mt-1">{cat.productCount} items</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" /> Featured Gifts
            </h2>
            <Link to="/shop" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" /> New Arrivals
            </h2>
            <Link to="/shop" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recent.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        </section>
      )}

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-400" /> Top Sellers
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {topSellers.map(s => (
              <Link key={s._id} to={`/store/${s.sellerProfile?.slug || s._id}`} className="bg-card border border-edge/50 rounded-xl p-4 hover:border-amber-500/30 transition-all group">
                <div className="flex items-center gap-3">
                  {s.sellerProfile?.profilePhoto ? (
                    <img src={s.sellerProfile.profilePhoto} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
                      <Store className="w-6 h-6 text-amber-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-theme-primary group-hover:text-amber-400 transition-colors truncate">{s.sellerProfile?.businessName}</p>
                    <p className="text-xs text-theme-muted">{s.sellerProfile?.totalOrders || 0} sales</p>
                  </div>
                  {s.sellerProfile?.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Star className="w-3 h-3 fill-current" /> {s.sellerProfile.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-y border-edge/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-theme-primary mb-4">Start Selling on Giftsity</h2>
          <p className="text-theme-muted mb-6 max-w-lg mx-auto">0% platform fee for a limited time. List your products and reach thousands of gift buyers.</p>
          <Link to="/seller/join" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold transition-colors">
            Join as Seller <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
