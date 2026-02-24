import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, CheckCircle, Package, Truck, XCircle, Calendar, ShoppingCart, Play, Store, Grid3X3, Instagram, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { storeAPI } from '../../api';
import { useCart, needsCustomization } from '../../context/CartContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SEO from '../../components/SEO';
import toast from 'react-hot-toast';

export default function SellerStore() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      storeAPI.getStore(slug),
      storeAPI.getProducts(slug, { limit: 200 }),
      storeAPI.getReviews(slug)
    ])
      .then(([storeRes, prodsRes, revsRes]) => {
        setStore(storeRes.data.store);
        const prods = prodsRes.data.products || [];
        setAllProducts(prods);
        setProducts(prods);
        setReviews(revsRes.data.reviews || []);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setFilterCat('all'); setSortBy('newest'); });
  }, [slug]);

  // Derive unique categories from products
  const sellerCategories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];

  // Apply filter + sort
  useEffect(() => {
    let filtered = [...allProducts];
    if (filterCat !== 'all') {
      filtered = filtered.filter(p => p.category === filterCat);
    }
    switch (sortBy) {
      case 'price-asc': filtered.sort((a, b) => a.price - b.price); break;
      case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
      case 'rating': filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
      case 'newest':
      default: filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }
    setProducts(filtered);
  }, [filterCat, sortBy, allProducts]);

  if (loading) return <LoadingSpinner />;
  if (!store) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <p className="text-theme-muted text-lg">Store not found</p>
    </div>
  );

  const stats = [
    { label: 'Products', value: store.productCount, icon: Package },
    { label: 'Delivered', value: store.deliveredOrders, icon: Truck },
    { label: 'Failed', value: store.failedOrders, icon: XCircle },
    { label: 'Rating', value: store.rating > 0 ? `${store.rating}★` : 'New', icon: Star },
  ];

  const tabs = [
    { id: 'products', label: 'Products', count: store.productCount },
    { id: 'reviews', label: 'Reviews', count: reviews.length },
  ];

  return (
    <div className="min-h-screen bg-base">
      <SEO
        title={store.businessName || store.name}
        description={`Shop gifts from ${store.businessName || store.name} on Giftsity. ${store.productCount} products available.`}
        image={store.avatar?.url || store.profilePhoto}
        type="profile"
      />

      {/* Cover Image */}
      <div className="relative h-48 sm:h-64 md:h-72 overflow-hidden">
        {store.coverImage?.url ? (
          <img src={store.coverImage.url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-base)] via-[var(--color-base)]/50 to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-6">
          {/* Avatar */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[var(--color-base)] overflow-hidden bg-inset shrink-0 shadow-xl">
            {(store.avatar?.url || store.profilePhoto) ? (
              <img src={store.avatar?.url || store.profilePhoto} alt={store.businessName} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-theme-dim">
                {store.businessName?.[0] || '?'}
              </div>
            )}
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-theme-primary truncate">{store.businessName}</h1>
              {store.isVerified && (
                <CheckCircle className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" />
              )}
            </div>
            {store.bio && (
              <p className="text-sm text-theme-secondary mb-2 line-clamp-2">{store.bio}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-theme-dim">
              {(store.city || store.state) && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{store.city}{store.state ? `, ${store.state}` : ''}</span>
              )}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined {new Date(store.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
              {store.instagramUsername && (
                <a href={`https://instagram.com/${store.instagramUsername.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-pink-400 hover:text-pink-300 transition-colors">
                  <Instagram className="w-3.5 h-3.5" /> {store.instagramUsername}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {stats.map(s => (
            <div key={s.label} className="text-center p-3 rounded-xl bg-card border border-edge/50">
              <s.icon className={`w-4 h-4 mx-auto mb-1 ${
                s.label === 'Delivered' ? 'text-green-400' :
                s.label === 'Failed' ? 'text-red-400' :
                s.label === 'Rating' ? 'text-amber-400' : 'text-theme-muted'
              }`} />
              <p className="text-lg sm:text-xl font-bold text-theme-primary">{s.value}</p>
              <p className="text-[10px] sm:text-xs text-theme-dim">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-edge/50 mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
                tab === t.id ? 'border-amber-500 text-theme-primary' : 'border-transparent text-theme-muted hover:text-theme-secondary'
              }`}>
              {t.label} {t.count > 0 && <span className="text-theme-dim ml-1">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Products Tab — Instagram-style grid */}
        {tab === 'products' && (
          <>
            {/* Filter bar */}
            {allProducts.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-theme-dim shrink-0" />
                  <button
                    onClick={() => setFilterCat('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterCat === 'all' ? 'bg-amber-500 text-zinc-950' : 'bg-card border border-edge/50 text-theme-muted hover:border-amber-500/50 hover:text-theme-primary'}`}
                  >
                    All ({allProducts.length})
                  </button>
                  {sellerCategories.map(cat => {
                    const count = allProducts.filter(p => p.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilterCat(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap capitalize transition-colors ${filterCat === cat ? 'bg-amber-500 text-zinc-950' : 'bg-card border border-edge/50 text-theme-muted hover:border-amber-500/50 hover:text-theme-primary'}`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-theme-dim" />
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="px-2.5 py-1.5 bg-card border border-edge/50 rounded-lg text-xs text-theme-primary focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="newest">Newest</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                  </select>
                </div>
              </div>
            )}

            {products.length === 0 ? (
              <div className="text-center py-16 text-theme-muted">
                <Package className="w-12 h-12 mx-auto mb-3 text-theme-dim" />
                {filterCat !== 'all' ? (
                  <p>No products in this category. <button onClick={() => setFilterCat('all')} className="text-amber-400 hover:text-amber-300 underline">Show all</button></p>
                ) : <p>No products listed yet</p>}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 sm:gap-2 pb-16">
                {products.map(p => {
                  const isVideo = p.media?.[0]?.type === 'video';
                  const thumb = p.media?.[0]?.thumbnailUrl || p.images?.[0]?.url || '';
                  const isHovered = hoveredProduct === p._id;

                  return (
                    <div key={p._id} className="relative group"
                      onMouseEnter={() => setHoveredProduct(p._id)}
                      onMouseLeave={() => setHoveredProduct(null)}>
                      <Link to={`/product/${p.slug || p._id}`}>
                        <div className="aspect-square bg-inset overflow-hidden rounded-lg sm:rounded-xl">
                          {thumb ? (
                            <img src={thumb} alt={p.title} loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl text-theme-dim">🎁</div>
                          )}
                        </div>
                      </Link>

                      {/* Video indicator */}
                      {isVideo && (
                        <div className="absolute top-2 right-2 p-1 bg-black/60 rounded-full">
                          <Play className="w-3 h-3 text-white fill-white" />
                        </div>
                      )}

                      {/* Hover overlay with details */}
                      <Link to={`/product/${p.slug || p._id}`} className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg sm:rounded-xl transition-opacity duration-200 ${
                        isHovered ? 'opacity-100' : 'opacity-0'
                      } pointer-events-none sm:pointer-events-auto`}>
                        <p className="text-white text-sm font-semibold text-center px-2 mb-1 line-clamp-2">{p.title}</p>
                        <p className="text-amber-400 font-bold text-lg">Rs.{p.price?.toLocaleString('en-IN')}</p>
                        {p.comparePrice && p.comparePrice > p.price && (
                          <p className="text-xs text-zinc-400 line-through">Rs.{p.comparePrice.toLocaleString('en-IN')}</p>
                        )}
                        {p.averageRating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs text-zinc-300">{p.averageRating}</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (needsCustomization(p)) {
                              toast('Customization required — redirecting to product page', { icon: '✏️' });
                              navigate(`/product/${p.slug || p._id}`);
                              return;
                            }
                            addItem({ ...p, sellerId: { _id: store._id, sellerProfile: { businessName: store.businessName } } });
                          }}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-zinc-950 text-xs font-bold rounded-lg pointer-events-auto hover:bg-amber-400 transition-colors">
                          <ShoppingCart className="w-3 h-3" /> Add
                        </button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Reviews Tab */}
        {tab === 'reviews' && (
          reviews.length === 0 ? (
            <div className="text-center py-16 text-theme-muted">
              <Star className="w-12 h-12 mx-auto mb-3 text-theme-dim" />
              <p>No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-3 pb-16">
              {reviews.map(r => (
                <div key={r._id} className="p-4 rounded-xl bg-card border border-edge/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-theme-dim'}`} />
                      ))}
                    </div>
                    <span className="text-sm text-theme-secondary">{r.customerId?.name || 'Customer'}</span>
                    <span className="text-xs text-theme-dim">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.productId && (
                    <Link to={`/product/${r.productId.slug || r.productId._id}`} className="text-xs text-amber-400/70 hover:text-amber-400 mb-2 block">
                      on {r.productId.title}
                    </Link>
                  )}
                  {r.reviewText && <p className="text-sm text-theme-secondary">{r.reviewText}</p>}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
