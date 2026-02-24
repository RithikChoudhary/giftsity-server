import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShoppingBag, Star, Minus, Plus, Store, Truck, Shield, ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Upload, X, Palette, Play } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import SEO from '../../components/SEO';
import API, { chatAPI } from '../../api';
import ProfileCompleteModal from '../../components/ProfileCompleteModal';

export default function ProductDetail() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPages, setReviewPages] = useState(1);
  const [ratingBreakdown, setRatingBreakdown] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [customizations, setCustomizations] = useState({}); // { [optionIdx]: value or imageUrls }

  useEffect(() => {
    loadProduct();
  }, [slug]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/products/${slug}`);
      const prod = data.product || data;
      setProduct(prod);
      // Load reviews
      if (prod._id) {
        try {
          const revRes = await API.get(`/reviews/product/${prod._id}?limit=5`);
          setReviews(revRes.data.reviews || []);
          setReviewTotal(revRes.data.total || 0);
          setReviewPages(revRes.data.pages || 1);
          setReviewPage(1);
          setRatingBreakdown(revRes.data.ratingBreakdown || {});
        } catch (e) {}
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadMoreReviews = async () => {
    if (!product?._id || reviewPage >= reviewPages) return;
    setLoadingMore(true);
    try {
      const nextPage = reviewPage + 1;
      const revRes = await API.get(`/reviews/product/${product._id}?page=${nextPage}&limit=5`);
      setReviews(prev => [...prev, ...(revRes.data.reviews || [])]);
      setReviewPage(nextPage);
    } catch (e) {}
    setLoadingMore(false);
  };

  const getCustomizationExtraPrice = () => {
    if (!product?.isCustomizable || !product.customizationOptions) return 0;
    return product.customizationOptions.reduce((sum, opt, idx) => {
      const val = customizations[idx];
      if (val && opt.extraPrice && (typeof val === 'string' ? val.length > 0 : (val.length > 0))) {
        return sum + opt.extraPrice;
      }
      return sum;
    }, 0);
  };

  const handleAdd = () => {
    if (!product) return;
    // Validate required customizations
    if (product.isCustomizable && product.customizationOptions) {
      for (let i = 0; i < product.customizationOptions.length; i++) {
        const opt = product.customizationOptions[i];
        const val = customizations[i];
        if (opt.required) {
          if (opt.type === 'image') {
            if (!val || !val.length) return toast.error(`"${opt.label}" is required`);
          } else {
            if (!val || !val.trim()) return toast.error(`"${opt.label}" is required`);
          }
        }
      }
    }

    // Build customization data for cart
    const custData = [];
    if (product.isCustomizable && product.customizationOptions) {
      product.customizationOptions.forEach((opt, idx) => {
        const val = customizations[idx];
        if (val && ((typeof val === 'string' && val.trim()) || (Array.isArray(val) && val.length))) {
          custData.push({ label: opt.label, value: typeof val === 'string' ? val : '', imageUrls: Array.isArray(val) ? val : [] });
        }
      });
    }

    addItem({
      productId: product._id,
      title: product.title,
      price: product.price + getCustomizationExtraPrice(),
      image: product.images?.[0]?.url,
      sellerId: product.sellerId?._id || product.sellerId,
      sellerName: product.sellerId?.sellerProfile?.businessName || 'Creator',
      stock: product.stock,
      slug: product.slug,
      quantity: qty,
      customizations: custData.length > 0 ? custData : undefined
    });
  };

  if (loading) return <LoadingSpinner />;
  if (!product) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-theme-muted">Product not found.</div>;

  // Build unified media array from images + media (which contains videos)
  const imageItems = (product.images || []).map(img => ({ type: 'image', url: img.url, thumbnailUrl: img.url, publicId: img.publicId }));
  const mediaItems = (product.media || []).map(m => ({ type: m.type || 'image', url: m.url, thumbnailUrl: m.thumbnailUrl || m.url, publicId: m.publicId }));
  // Deduplicate by URL (images may appear in both arrays)
  const seenUrls = new Set();
  const allMedia = [];
  for (const item of [...mediaItems, ...imageItems]) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      allMedia.push(item);
    }
  }
  // Fallback: if no media at all, use images array
  const media = allMedia.length > 0 ? allMedia : imageItems;
  const seller = product.sellerId;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <SEO
        title={product.title}
        description={product.description?.slice(0, 160)}
        image={media[0]?.type === 'image' ? media[0]?.url : media[0]?.thumbnailUrl}
        type="product"
        keywords={`${product.title}, ${product.category || 'gifts'}, buy online, Giftsity`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.title,
          "image": product.images?.[0]?.url,
          "description": product.description?.slice(0, 500),
          "sku": product.sku || undefined,
          "brand": {
            "@type": "Brand",
            "name": product.sellerId?.sellerProfile?.businessName || "Giftsity"
          },
          "offers": {
            "@type": "Offer",
            "price": product.price,
            "priceCurrency": "INR",
            "availability": product.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            "url": `https://giftsity.com/product/${product.slug}`,
            "seller": {
              "@type": "Organization",
              "name": product.sellerId?.sellerProfile?.businessName || "Giftsity"
            }
          }
        })}</script>
      </Helmet>
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Media Gallery (images + videos) */}
        <div>
          <div className="relative aspect-square bg-card border border-edge/50 rounded-2xl overflow-hidden mb-3">
            {media.length > 0 ? (
              media[imgIdx]?.type === 'video' ? (
                <video
                  key={media[imgIdx].url}
                  src={media[imgIdx].url}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img src={media[imgIdx]?.url} alt={product.title} loading="lazy" className="w-full h-full object-contain" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-theme-dim"><ShoppingBag className="w-16 h-16" /></div>
            )}
            {media.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => i > 0 ? i - 1 : media.length - 1)} aria-label="Previous image" className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setImgIdx(i => i < media.length - 1 ? i + 1 : 0)} aria-label="Next image" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
            {product.isFeatured && <span className="absolute top-3 left-3 px-2 py-1 bg-amber-500 text-zinc-950 text-xs font-bold rounded-full">Featured</span>}
          </div>
          {media.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {media.map((item, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${i === imgIdx ? 'border-amber-500' : 'border-edge/50 hover:border-edge-strong'}`}>
                  <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />
                  {item.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {seller?.sellerProfile && (
            <Link to={`/store/${seller.sellerProfile.businessSlug || seller._id}`} className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mb-3">
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

          {/* Customization Options */}
          {product.isCustomizable && product.customizationOptions?.length > 0 && (
            <div className="mb-6 bg-card border border-edge/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-theme-primary">
                <Palette className="w-4 h-4 text-amber-400" /> Customize This Product
              </div>
              {product.customizationOptions.map((opt, idx) => (
                <div key={idx}>
                  <label className="text-xs font-medium text-theme-muted mb-1 block">
                    {opt.label} {opt.required && <span className="text-red-400">*</span>}
                    {opt.extraPrice > 0 && <span className="text-amber-400 ml-1">(+Rs. {opt.extraPrice})</span>}
                  </label>
                  {opt.type === 'text' && (
                    <input
                      type="text"
                      placeholder={opt.placeholder || `Enter ${opt.label}`}
                      maxLength={opt.maxLength || 100}
                      value={customizations[idx] || ''}
                      onChange={e => setCustomizations(prev => ({ ...prev, [idx]: e.target.value }))}
                      className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50"
                    />
                  )}
                  {opt.type === 'select' && (
                    <select
                      value={customizations[idx] || ''}
                      onChange={e => setCustomizations(prev => ({ ...prev, [idx]: e.target.value }))}
                      className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Select {opt.label}</option>
                      {(opt.selectOptions || []).map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                    </select>
                  )}
                  {opt.type === 'image' && (
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(customizations[idx] || []).map((url, i) => (
                          <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden bg-inset border border-edge">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => setCustomizations(prev => ({ ...prev, [idx]: prev[idx].filter((_, fi) => fi !== i) }))} aria-label="Remove image" className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5 text-white" /></button>
                          </div>
                        ))}
                        {(customizations[idx] || []).length < (opt.maxFiles || 5) && (
                          <label className="w-14 h-14 rounded-lg border-2 border-dashed border-edge hover:border-amber-500/50 flex items-center justify-center cursor-pointer">
                            <Upload className="w-4 h-4 text-theme-dim" />
                            <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                              const files = Array.from(e.target.files);
                              files.forEach(f => {
                                const fd = new FormData();
                                fd.append('image', f);
                                API.post('/products/upload-customization', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                                  .then(res => {
                                    setCustomizations(prev => ({ ...prev, [idx]: [...(prev[idx] || []), res.data.url] }));
                                  })
                                  .catch(() => toast.error('Image upload failed'));
                              });
                            }} />
                          </label>
                        )}
                      </div>
                      <p className="text-[10px] text-theme-dim">Upload up to {opt.maxFiles || 5} images</p>
                    </div>
                  )}
                </div>
              ))}
              {getCustomizationExtraPrice() > 0 && (
                <p className="text-xs text-amber-400">Customization adds Rs. {getCustomizationExtraPrice()} to the price</p>
              )}
            </div>
          )}

          {product.stock > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-theme-muted">Quantity:</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity" className="w-8 h-8 flex items-center justify-center bg-inset rounded-lg text-theme-secondary hover:text-theme-primary"><Minus className="w-3 h-3" /></button>
                  <span className="w-10 text-center text-sm font-medium text-theme-primary">{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock} aria-label="Increase quantity" className="w-8 h-8 flex items-center justify-center bg-inset rounded-lg text-theme-secondary hover:text-theme-primary disabled:opacity-40"><Plus className="w-3 h-3" /></button>
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

          {/* Chat with seller */}
          {seller && (
            <ChatWithSellerButton sellerId={seller._id} productId={product._id} productTitle={product.title} productImage={product.images?.[0]?.url} />
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

      {/* Reviews Section */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-theme-primary mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-400" />
          Customer Reviews {reviewTotal > 0 && `(${reviewTotal})`}
        </h2>

        {/* Rating Summary */}
        {reviewTotal > 0 ? (
          <div className="bg-card border border-edge/50 rounded-xl p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Average */}
              <div className="text-center sm:text-left shrink-0">
                <p className="text-4xl font-bold text-theme-primary">{product.averageRating?.toFixed(1) || '0.0'}</p>
                <div className="flex justify-center sm:justify-start mt-1">{[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= (product.averageRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-edge'}`} />)}</div>
                <p className="text-xs text-theme-muted mt-1">{reviewTotal} review{reviewTotal !== 1 ? 's' : ''}</p>
              </div>
              {/* Breakdown bars */}
              <div className="flex-1 space-y-1.5">
                {[5,4,3,2,1].map(star => {
                  const count = ratingBreakdown[star] || 0;
                  const pct = reviewTotal > 0 ? (count / reviewTotal) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-theme-muted w-3">{star}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <div className="flex-1 h-2 bg-inset rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-theme-dim w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-edge/50 rounded-xl p-8 mb-6 text-center">
            <Star className="w-10 h-10 text-theme-dim mx-auto mb-3" />
            <p className="text-theme-muted text-sm">No reviews yet.</p>
            <p className="text-theme-dim text-xs mt-1">Be the first to review after your purchase!</p>
          </div>
        )}

        {/* Review Cards */}
        {reviews.length > 0 && (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r._id} className="bg-card border border-edge/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-edge'}`} />)}</div>
                  <span className="text-sm font-medium text-theme-primary">{r.customerId?.name || 'Customer'}</span>
                  <span className="text-xs text-theme-dim">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.reviewText && <p className="text-sm text-theme-secondary">{r.reviewText}</p>}
                {/* Review images */}
                {r.images && r.images.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {r.images.map((img, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-inset border border-edge/50">
                        <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {/* Load more */}
            {reviewPage < reviewPages && (
              <button onClick={loadMoreReviews} disabled={loadingMore} className="w-full py-2.5 bg-inset hover:bg-card border border-edge/50 rounded-xl text-sm text-theme-muted hover:text-theme-primary transition-colors">
                {loadingMore ? 'Loading...' : `Load More Reviews (${reviewTotal - reviews.length} remaining)`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ChatWithSellerButton({ sellerId, productId, productTitle, productImage }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const startChat = async () => {
    setLoading(true);
    try {
      await chatAPI.createConversation({ sellerId, productId, productTitle, productImage });
      navigate('/chat');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start chat');
    }
    setLoading(false);
  };

  const handleChat = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!user.name) { setShowProfileModal(true); return; }
    startChat();
  };

  return (
    <>
      <button onClick={handleChat} disabled={loading} className="w-full mt-3 py-2.5 border border-amber-500/30 hover:bg-amber-500/10 text-amber-500 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
        <MessageSquare className="w-4 h-4" /> {loading ? 'Starting chat...' : 'Chat with Creator'}
      </button>
      {showProfileModal && (
        <ProfileCompleteModal
          onComplete={() => { setShowProfileModal(false); startChat(); }}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
}
