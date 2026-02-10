import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingBag, Star, Minus, Plus, Store, Truck, Shield, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function ProductDetail() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    loadProduct();
  }, [slug]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/api/products/${slug}`);
      setProduct(data);
      // Load reviews
      try {
        const revRes = await API.get(`/api/reviews/product/${data._id}`);
        setReviews(revRes.data.reviews || []);
      } catch (e) {}
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAdd = () => {
    if (!product) return;
    addItem({
      productId: product._id,
      title: product.title,
      price: product.price,
      image: product.images?.[0]?.url,
      sellerId: product.sellerId?._id || product.sellerId,
      sellerName: product.sellerId?.sellerProfile?.businessName || 'Seller',
      stock: product.stock,
      slug: product.slug,
      quantity: qty
    });
  };

  if (loading) return <LoadingSpinner />;
  if (!product) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-theme-muted">Product not found.</div>;

  const images = product.images || [];
  const seller = product.sellerId;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div>
          <div className="relative aspect-square bg-card border border-edge/50 rounded-2xl overflow-hidden mb-3">
            {images.length > 0 ? (
              <img src={images[imgIdx]?.url} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-theme-dim"><ShoppingBag className="w-16 h-16" /></div>
            )}
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => i > 0 ? i - 1 : images.length - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setImgIdx(i => i < images.length - 1 ? i + 1 : 0)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
            {product.isFeatured && <span className="absolute top-3 left-3 px-2 py-1 bg-amber-500 text-zinc-950 text-xs font-bold rounded-full">Featured</span>}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${i === imgIdx ? 'border-amber-500' : 'border-edge/50 hover:border-edge-strong'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {seller?.sellerProfile && (
            <Link to={`/store/${seller.sellerProfile.slug || seller._id}`} className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mb-3">
              <Store className="w-4 h-4" /> {seller.sellerProfile.businessName}
            </Link>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-theme-primary mb-3">{product.title}</h1>

          {product.averageRating > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= product.averageRating ? 'fill-amber-400 text-amber-400' : 'text-edge'}`} />)}</div>
              <span className="text-sm text-theme-muted">{product.averageRating.toFixed(1)} ({product.reviewCount} reviews)</span>
            </div>
          )}

          <p className="text-3xl font-bold text-theme-primary mb-6">Rs. {product.price?.toLocaleString('en-IN')}</p>

          <div className="prose prose-sm text-theme-secondary mb-6 max-w-none" style={{ whiteSpace: 'pre-line' }}>
            {product.description}
          </div>

          {product.stock > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-theme-muted">Quantity:</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center bg-inset rounded-lg text-theme-secondary hover:text-theme-primary"><Minus className="w-3 h-3" /></button>
                  <span className="w-10 text-center text-sm font-medium text-theme-primary">{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock} className="w-8 h-8 flex items-center justify-center bg-inset rounded-lg text-theme-secondary hover:text-theme-primary disabled:opacity-40"><Plus className="w-3 h-3" /></button>
                </div>
                <span className="text-xs text-theme-dim">{product.stock} in stock</span>
              </div>
              <button onClick={handleAdd} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                <ShoppingBag className="w-4 h-4" /> Add to Cart
              </button>
            </div>
          ) : (
            <div className="py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-red-400 text-sm font-medium">Out of Stock</div>
          )}

          {/* Trust */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="flex items-center gap-2 text-xs text-theme-muted">
              <Truck className="w-4 h-4 text-amber-400" /> Fast Delivery
            </div>
            <div className="flex items-center gap-2 text-xs text-theme-muted">
              <Shield className="w-4 h-4 text-amber-400" /> Secure Payment
            </div>
          </div>

          {/* Category */}
          <div className="mt-6 pt-4 border-t border-edge/50">
            <p className="text-xs text-theme-dim">Category: <Link to={`/shop?category=${product.category}`} className="text-theme-muted hover:text-amber-400">{product.category}</Link></p>
            {product.sku && <p className="text-xs text-theme-dim mt-1">SKU: {product.sku}</p>}
          </div>
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-theme-primary mb-6">Customer Reviews ({reviews.length})</h2>
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r._id} className="bg-card border border-edge/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-edge'}`} />)}</div>
                  <span className="text-sm font-medium text-theme-primary">{r.customerId?.name || 'Customer'}</span>
                  <span className="text-xs text-theme-dim">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.reviewText && <p className="text-sm text-theme-secondary">{r.reviewText}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
