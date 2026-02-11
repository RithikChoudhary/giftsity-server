import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { corporateAPI } from '../../api';
import { Search, ShoppingCart, Filter, Tag, Loader2, Package } from 'lucide-react';

export default function CorporateCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [tags, setTags] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '');

  // Cart state (localStorage-based)
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('giftsity_corporate_cart') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('giftsity_corporate_cart', JSON.stringify(cart));
  }, [cart]);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 24 };
      if (search) params.search = search;
      if (selectedTag) params.tag = selectedTag;
      if (sort) params.sort = sort;
      const res = await corporateAPI.getCatalog(params);
      setProducts(res.data.products || []);
      setTags(res.data.tags || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalog(); }, [page, selectedTag, sort]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCatalog();
  };

  const addToCart = (product) => {
    const existing = cart.find(c => c.productId === product._id);
    if (existing) return;
    setCart([...cart, {
      productId: product._id,
      title: product.title,
      image: product.images?.[0]?.url || '',
      unitPrice: product.corporatePrice || product.price,
      quantity: product.minOrderQty || 10,
      minOrderQty: product.minOrderQty || 10,
      maxOrderQty: product.maxOrderQty || 10000
    }]);
  };

  const isInCart = (id) => cart.some(c => c.productId === id);
  const cartCount = cart.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Corporate Catalog</h1>
          <p className="text-sm text-theme-muted">{total} products available for bulk gifting</p>
        </div>
        <Link to="/corporate/cart" className="relative flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
          <ShoppingCart className="w-4 h-4" />
          Cart
          {cartCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>}
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-edge/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </form>
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-card border border-edge/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
          <option value="">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="popular">Popular</option>
        </select>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setSelectedTag(''); setPage(1); }}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${!selectedTag ? 'bg-amber-500 text-white' : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary'}`}>
            All
          </button>
          {tags.map(tag => (
            <button key={tag} onClick={() => { setSelectedTag(tag); setPage(1); }}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedTag === tag ? 'bg-amber-500 text-white' : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary'}`}>
              <Tag className="w-3 h-3" /> {tag}
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(product => (
            <div key={product._id} className="bg-card border border-edge/50 rounded-xl overflow-hidden group hover:border-amber-400/30 transition-colors">
              <div className="aspect-square bg-inset relative overflow-hidden">
                {product.images?.[0]?.url ? (
                  <img src={product.images[0].url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="flex items-center justify-center h-full text-theme-dim"><Package className="w-8 h-8" /></div>
                )}
                {product.corporatePrice && product.corporatePrice < product.price && (
                  <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {Math.round((1 - product.corporatePrice / product.price) * 100)}% off
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold line-clamp-2 mb-1">{product.title}</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold text-amber-400">Rs. {(product.corporatePrice || product.price)?.toLocaleString()}</span>
                  {product.corporatePrice && product.corporatePrice < product.price && (
                    <span className="text-xs text-theme-dim line-through">Rs. {product.price?.toLocaleString()}</span>
                  )}
                </div>
                <p className="text-xs text-theme-dim mb-3">Min qty: {product.minOrderQty || 10}</p>
                {product.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] bg-inset px-1.5 py-0.5 rounded text-theme-dim">{tag}</span>
                    ))}
                  </div>
                )}
                <button onClick={() => addToCart(product)} disabled={isInCart(product._id)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${isInCart(product._id) ? 'bg-green-500/10 text-green-400 cursor-default' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}>
                  {isInCart(product._id) ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${page === i + 1 ? 'bg-amber-500 text-white' : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
