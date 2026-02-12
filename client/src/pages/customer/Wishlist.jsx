import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart, needsCustomization } from '../../context/CartContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SEO from '../../components/SEO';
import API from '../../api';
import toast from 'react-hot-toast';

export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { toggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return navigate('/auth?redirect=/wishlist');
    loadWishlist();
  }, [user, authLoading]);

  const loadWishlist = async () => {
    try {
      const { data } = await API.get('/wishlist');
      setItems(data.items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleRemove = async (productId) => {
    await toggleWishlist(productId);
    setItems(prev => prev.filter(i => i.product?._id !== productId));
  };

  const handleAddToCart = (product) => {
    if (needsCustomization(product)) {
      toast('Customization required — redirecting to product page', { icon: '✏️' });
      navigate(`/product/${product.slug}`);
      return;
    }
    addItem({
      _id: product._id,
      productId: product._id,
      title: product.title,
      price: product.price,
      images: product.images,
      image: product.images?.[0]?.url,
      sellerId: product.sellerId?._id || product.sellerId,
      sellerName: product.sellerId?.sellerProfile?.businessName || 'Seller',
      stock: product.stock,
      slug: product.slug
    });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <SEO title="Wishlist" noIndex />
      <h1 className="text-2xl font-bold text-theme-primary mb-6 flex items-center gap-2">
        <Heart className="w-6 h-6 text-red-400" /> My Wishlist
        {items.length > 0 && <span className="text-sm font-normal text-theme-muted">({items.length} items)</span>}
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-theme-dim mx-auto mb-4" />
          <h2 className="text-lg font-bold text-theme-primary mb-2">Your wishlist is empty</h2>
          <p className="text-theme-muted mb-6 text-sm">Save items you love by tapping the heart icon.</p>
          <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold">
            Browse Gifts <ShoppingBag className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ product, addedAt }) => {
            if (!product) return null;
            return (
              <div key={product._id} className="bg-card border border-edge/50 rounded-2xl overflow-hidden group">
                <Link to={`/product/${product.slug}`} className="block">
                  <div className="relative aspect-square bg-inset overflow-hidden">
                    {product.images?.[0]?.url ? (
                      <img src={product.images[0].url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-theme-dim"><ShoppingBag className="w-12 h-12" /></div>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <p className="text-xs text-amber-400/80 font-medium mb-1">{product.sellerId?.sellerProfile?.businessName || 'Seller'}</p>
                  <Link to={`/product/${product.slug}`}><h3 className="font-semibold text-theme-primary text-sm line-clamp-2 mb-2 hover:text-amber-400 transition-colors">{product.title}</h3></Link>
                  <p className="text-lg font-bold text-theme-primary mb-3">Rs. {product.price?.toLocaleString('en-IN')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddToCart(product)} className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
                    </button>
                    <button onClick={() => handleRemove(product._id)} className="p-2 bg-inset hover:bg-red-500/10 text-theme-muted hover:text-red-400 rounded-lg transition-colors" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
