import { useState, useEffect } from 'react';
import { Package, Star, Eye, EyeOff, Trash2, Search, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { loadProducts(); }, [page, search]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      const { data } = await API.get(`/admin/products?${params}`);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const toggleFeatured = async (id, featured) => {
    try {
      await API.put(`/admin/products/${id}/feature`);
      toast.success(featured ? 'Removed from featured' : 'Featured!');
      loadProducts();
    } catch (e) { toast.error('Failed'); }
  };

  const toggleActive = async (id, active) => {
    try {
      await API.put(`/admin/products/${id}/toggle`);
      toast.success(active ? 'Hidden' : 'Visible');
      loadProducts();
    } catch (e) { toast.error('Failed'); }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await API.delete(`/admin/products/${id}`);
      toast.success('Deleted');
      loadProducts();
    } catch (e) { toast.error('Failed'); }
  };

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Products ({total})</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search products..." className="w-full pl-10 pr-4 py-2 bg-card border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
        </div>
      </div>

      {loading ? <LoadingSpinner /> : products.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Package className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No products found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p._id} className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 bg-inset rounded-lg overflow-hidden shrink-0">
                {p.images?.[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <Image className="w-5 h-5 text-theme-dim m-auto mt-4.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-theme-primary truncate">{p.title}</h3>
                  {p.isFeatured && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-medium rounded">Featured</span>}
                  {!p.isActive && <span className="px-1.5 py-0.5 bg-inset text-theme-dim text-[10px] rounded">Hidden</span>}
                </div>
                <p className="text-xs text-theme-muted">
                  {p.sellerId?.sellerProfile?.businessName || 'Unknown seller'} &middot; Rs. {p.price?.toLocaleString('en-IN')} &middot; Stock: {p.stock} &middot; {p.category}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => toggleFeatured(p._id, p.isFeatured)} className={`p-2 rounded-lg ${p.isFeatured ? 'bg-amber-500/10 text-amber-400' : 'bg-inset text-theme-muted'} hover:text-amber-400`} title="Feature">
                  <Star className={`w-4 h-4 ${p.isFeatured ? 'fill-current' : ''}`} />
                </button>
                <button onClick={() => toggleActive(p._id, p.isActive)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-theme-primary" title={p.isActive ? 'Hide' : 'Show'}>
                  {p.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteProduct(p._id)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-red-400" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-lg text-sm font-medium ${page === i + 1 ? 'bg-amber-500 text-zinc-950' : 'bg-card border border-edge text-theme-muted'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
