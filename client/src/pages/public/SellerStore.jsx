import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, Star, ShoppingBag, Instagram, MapPin, Package, Grid3X3, Play } from 'lucide-react';
import ProductCard from '../../components/ProductCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function SellerStore() {
  const { slug } = useParams();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prodPage, setProdPage] = useState(1);
  const [prodPages, setProdPages] = useState(1);
  const [prodTotal, setProdTotal] = useState(0);
  const [prodLoading, setProdLoading] = useState(false);
  const [tab, setTab] = useState('products'); // products | about

  useEffect(() => { loadStore(); }, [slug]);

  const loadStore = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/api/store/${slug}`);
      setSeller(data.seller);
      setProducts(data.products || []);
      setProdTotal(data.total || data.products?.length || 0);
      setProdPages(data.pages || 1);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadProductPage = async (p) => {
    setProdLoading(true);
    try {
      const { data } = await API.get(`/api/store/${slug}?page=${p}&limit=12`);
      setProducts(data.products || []);
      setProdPage(p);
      setProdPages(data.pages || 1);
    } catch (e) { console.error(e); }
    setProdLoading(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!seller) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-theme-muted">Store not found.</div>;

  const sp = seller.sellerProfile || {};

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Instagram-style profile header */}
      <div className="bg-card border border-edge/50 rounded-2xl p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-inset border-2 border-amber-500/30 shrink-0">
            {sp.profilePhoto ? (
              <img src={sp.profilePhoto} alt={sp.businessName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Store className="w-12 h-12 text-theme-dim" /></div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
              <h1 className="text-2xl font-bold text-theme-primary">{sp.businessName}</h1>
              {sp.rating > 0 && (
                <div className="flex items-center gap-1 text-sm text-amber-400">
                  <Star className="w-4 h-4 fill-current" /> {sp.rating.toFixed(1)}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex justify-center md:justify-start gap-8 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold text-theme-primary">{prodTotal}</p>
                <p className="text-xs text-theme-muted">Products</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-theme-primary">{sp.totalOrders || 0}</p>
                <p className="text-xs text-theme-muted">Orders</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-theme-primary">{sp.totalSales ? `Rs.${(sp.totalSales / 1000).toFixed(0)}k` : 'Rs.0'}</p>
                <p className="text-xs text-theme-muted">Sales</p>
              </div>
            </div>

            {/* Instagram link */}
            {sp.instagramUsername && (
              <a href={`https://instagram.com/${sp.instagramUsername.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-300 transition-colors">
                <Instagram className="w-4 h-4" /> {sp.instagramUsername}
              </a>
            )}

            {sp.businessAddress?.city && (
              <p className="text-xs text-theme-dim mt-2 flex items-center gap-1 justify-center md:justify-start">
                <MapPin className="w-3 h-3" /> {sp.businessAddress.city}, {sp.businessAddress.state}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-edge/50">
        <button onClick={() => setTab('products')} className={`pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 ${tab === 'products' ? 'border-amber-500 text-amber-400' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}>
          <Grid3X3 className="w-4 h-4" /> Products
        </button>
        <button onClick={() => setTab('about')} className={`pb-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 ${tab === 'about' ? 'border-amber-500 text-amber-400' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}>
          <Store className="w-4 h-4" /> About
        </button>
      </div>

      {/* Content */}
      {tab === 'products' && (
        <>
          {prodLoading ? <LoadingSpinner /> : products.length === 0 ? (
            <div className="text-center py-12 text-theme-muted">No products listed yet.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map(p => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
          {prodPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: prodPages }, (_, i) => (
                <button key={i} onClick={() => loadProductPage(i + 1)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${prodPage === i + 1 ? 'bg-amber-500 text-zinc-950' : 'bg-card border border-edge text-theme-muted'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'about' && (
        <div className="bg-card border border-edge/50 rounded-xl p-6">
          <h3 className="font-semibold text-theme-primary mb-3">About {sp.businessName}</h3>
          <div className="space-y-3 text-sm text-theme-secondary">
            <p>Type: {sp.businessType || 'Individual'}</p>
            {sp.businessAddress && <p>Location: {sp.businessAddress.city}, {sp.businessAddress.state}</p>}
            <p>Member since: {new Date(seller.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })}</p>
            {sp.gstNumber && <p>GST: {sp.gstNumber}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
