import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState('newest');
  const [priceRange, setPriceRange] = useState([0, 50000]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadProducts(); }, [page, category, sort, search]);

  const loadCategories = async () => {
    try {
      const { data } = await API.get('/api/products/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 12);
      if (category) params.set('category', category);
      if (sort) params.set('sort', sort);
      if (search) params.set('search', search);
      if (priceRange[0] > 0) params.set('minPrice', priceRange[0]);
      if (priceRange[1] < 50000) params.set('maxPrice', priceRange[1]);
      const { data } = await API.get(`/api/products?${params}`);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const pages = Math.ceil(total / 12);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-theme-primary mb-2">Gift Shop</h1>
        <p className="text-theme-muted">Discover unique gifts from our sellers</p>
      </div>

      {/* Search & filters bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search gifts..." className="w-full pl-10 pr-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
        </form>
        <div className="flex gap-3">
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="px-3 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-secondary focus:outline-none focus:border-amber-500/50">
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-secondary hover:border-edge-strong transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-card border border-edge rounded-xl p-4 mb-6 animate-fade-in">
          <div className="flex flex-wrap gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-theme-muted font-medium mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setCategory(''); setPage(1); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!category ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-secondary'}`}>All</button>
                {categories.map(c => (
                  <button key={c._id || c.slug} onClick={() => { setCategory(c.slug); setPage(1); }} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === c.slug ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-secondary'}`}>{c.name}</button>
                ))}
              </div>
            </div>
            <div className="min-w-[200px]">
              <label className="text-xs text-theme-muted font-medium mb-2 block">Price Range</label>
              <div className="flex items-center gap-2">
                <input type="number" value={priceRange[0]} onChange={e => setPriceRange([+e.target.value, priceRange[1]])} placeholder="Min" className="w-24 px-2 py-1 bg-inset border border-edge rounded-lg text-sm text-theme-primary" />
                <span className="text-theme-dim">-</span>
                <input type="number" value={priceRange[1]} onChange={e => setPriceRange([priceRange[0], +e.target.value])} placeholder="Max" className="w-24 px-2 py-1 bg-inset border border-edge rounded-lg text-sm text-theme-primary" />
                <button onClick={() => { setPage(1); loadProducts(); }} className="px-3 py-1 bg-amber-500 text-zinc-950 rounded-lg text-sm font-medium">Go</button>
              </div>
            </div>
          </div>
          {category && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-theme-dim">Active:</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded-full">
                {categories.find(c => c.slug === category)?.name || category}
                <button onClick={() => { setCategory(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Products */}
      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-theme-muted">No products found. Try a different search or filter.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-theme-muted mb-4">{total} gift{total !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-amber-500 text-zinc-950' : 'bg-card border border-edge text-theme-muted hover:text-theme-primary'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
