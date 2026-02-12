import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Package, Truck, CheckCircle, Clock, XCircle, MapPin, Star, ArrowLeft, Loader, Camera, X, Navigation, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

function StarRating({ rating, onRate, interactive = false }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => interactive && onRate(s)} className={interactive ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={`w-5 h-5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-edge'}`} />
        </button>
      ))}
    </div>
  );
}

const statusSteps = ['pending', 'confirmed', 'shipped', 'delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  // Per-item review state: { [productId]: { rating, reviewText, images[], existingReview, showForm, submitting } }
  const [itemReviews, setItemReviews] = useState({});
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return navigate('/auth');
    loadOrder();
  }, [id, authLoading]);

  const loadOrder = async () => {
    try {
      const { data } = await API.get(`/orders/${id}`);
      const ord = data.order || data;
      setOrder(ord);
      // Check existing reviews for each item
      const reviewState = {};
      for (const item of (ord.items || [])) {
        const pid = item.productId;
        reviewState[pid] = { rating: 5, reviewText: '', images: [], existingReview: null, showForm: false, submitting: false };
        try {
          if (pid) {
            const revRes = await API.get(`/reviews/product/${pid}`);
            const myReview = (revRes.data.reviews || []).find(r => (r.customerId?._id === user._id || r.customerId === user._id) && r.orderId === id);
            if (myReview) reviewState[pid].existingReview = myReview;
          }
        } catch (e) {}
      }
      setItemReviews(reviewState);
      // Load tracking data
      if (['processing', 'shipped', 'delivered'].includes(ord.status)) {
        loadTracking(ord._id);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadTracking = async (orderId) => {
    setTrackingLoading(true);
    try {
      const { data } = await API.get(`/orders/${orderId}/tracking`);
      setTracking(data);
    } catch (e) { /* silent */ }
    setTrackingLoading(false);
  };

  const handleReviewImageAdd = (productId, files) => {
    setItemReviews(prev => {
      const cur = prev[productId];
      const newImgs = [...cur.images];
      Array.from(files).slice(0, 3 - newImgs.length).forEach(f => {
        const reader = new FileReader();
        reader.onload = () => {
          setItemReviews(p => ({
            ...p,
            [productId]: { ...p[productId], images: [...p[productId].images, { preview: URL.createObjectURL(f), base64: reader.result }] }
          }));
        };
        reader.readAsDataURL(f);
      });
      return prev;
    });
  };

  const removeReviewImage = (productId, idx) => {
    setItemReviews(prev => ({
      ...prev,
      [productId]: { ...prev[productId], images: prev[productId].images.filter((_, i) => i !== idx) }
    }));
  };

  const submitReview = async (productId) => {
    const rev = itemReviews[productId];
    if (!rev.rating) return toast.error('Select a rating');
    setItemReviews(prev => ({ ...prev, [productId]: { ...prev[productId], submitting: true } }));
    try {
      await API.post('/reviews', {
        productId,
        orderId: order._id,
        rating: rev.rating,
        reviewText: rev.reviewText,
        images: rev.images.map(i => i.base64)
      });
      toast.success('Review submitted!');
      setItemReviews(prev => ({ ...prev, [productId]: { ...prev[productId], showForm: false, submitting: false } }));
      loadOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
      setItemReviews(prev => ({ ...prev, [productId]: { ...prev[productId], submitting: false } }));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!order) return <div className="max-w-4xl mx-auto px-4 py-20 text-center text-theme-muted">Order not found.</div>;

  const currentStep = statusSteps.indexOf(order.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6"><ArrowLeft className="w-4 h-4" /> Back to Orders</Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-theme-primary">{order.orderNumber}</h1>
          <p className="text-sm text-theme-muted">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.paymentStatus === 'paid' && (
            <button onClick={async () => {
              try {
                const response = await API.get(`/orders/${order._id}/invoice`, { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-${order.orderNumber}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) { toast.error('Failed to download invoice'); }
            }} className="px-3 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors flex items-center gap-1">
              <Download className="w-3 h-3" /> Invoice
            </button>
          )}
          {['pending', 'confirmed'].includes(order.status) && (
            <button onClick={() => setShowCancel(true)} className="px-3 py-1 rounded-full text-xs font-medium bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">Cancel Order</button>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'delivered' ? 'bg-green-400/10 text-green-400' : order.status === 'cancelled' ? 'bg-red-400/10 text-red-400' : 'bg-amber-400/10 text-amber-400'}`}>{order.status}</span>
        </div>
      </div>

      {/* Cancel confirmation */}
      {showCancel && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-red-400 mb-2">Cancel this order?</h3>
          <p className="text-sm text-theme-muted mb-3">This action cannot be undone. If you've already paid, a refund will be initiated.</p>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} placeholder="Reason for cancellation (optional)" className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-red-500/50 resize-none mb-3" />
          <div className="flex gap-3">
            <button onClick={async () => {
              setCancelling(true);
              try {
                await API.post(`/orders/${order._id}/cancel`, { reason: cancelReason });
                toast.success('Order cancelled');
                setShowCancel(false);
                loadOrder();
              } catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel'); }
              setCancelling(false);
            }} disabled={cancelling} className="px-4 py-2 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
              {cancelling ? <Loader className="w-4 h-4 animate-spin" /> : 'Yes, Cancel Order'}
            </button>
            <button onClick={() => setShowCancel(false)} className="px-4 py-2 bg-inset text-theme-muted rounded-lg text-sm">Keep Order</button>
          </div>
        </div>
      )}

      {/* Status timeline */}
      {order.status !== 'cancelled' && order.status !== 'refunded' && (
        <div className="bg-card border border-edge/50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-inset" />
            <div className="absolute top-4 left-0 h-0.5 bg-amber-500 transition-all" style={{ width: `${Math.max(0, currentStep) / (statusSteps.length - 1) * 100}%` }} />
            {statusSteps.map((s, i) => {
              const icons = [Clock, Package, Truck, CheckCircle];
              const Icon = icons[i];
              const done = i <= currentStep;
              return (
                <div key={s} className="relative flex flex-col items-center z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-dim'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className={`text-xs mt-2 capitalize ${done ? 'text-amber-400' : 'text-theme-dim'}`}>{s}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Products */}
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h3 className="font-semibold text-theme-primary mb-3">Products</h3>
          <div className="space-y-3">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="w-16 h-16 bg-inset rounded-lg overflow-hidden shrink-0">
                  {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-theme-dim m-auto mt-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-theme-primary">{item.title}</p>
                  <p className="text-xs text-theme-muted mt-1">Qty: {item.quantity || 1}</p>
                  <p className="text-sm font-bold text-theme-primary mt-0.5">Rs. {((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</p>
                  {item.customizations?.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {item.customizations.map((c, ci) => (
                        <div key={ci} className="text-xs text-theme-muted">
                          <span className="text-amber-400/80">{c.label}:</span>{' '}
                          {c.value || (c.imageUrls?.length ? `${c.imageUrls.length} image(s)` : '')}
                          {c.imageUrls?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {c.imageUrls.map((url, i) => (
                                <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Address */}
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h3 className="font-semibold text-theme-primary mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-400" /> Shipping Address</h3>
          <div className="text-sm text-theme-secondary space-y-1">
            <p>{order.shippingAddress?.name}</p>
            <p>{order.shippingAddress?.street}</p>
            <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
            <p>{order.shippingAddress?.phone}</p>
          </div>
        </div>

        {/* Detailed Tracking */}
        {(tracking || order.trackingInfo?.trackingNumber) && (
          <div className="bg-card border border-edge/50 rounded-xl p-5 md:col-span-2">
            <h3 className="font-semibold text-theme-primary mb-4 flex items-center gap-2"><Truck className="w-4 h-4 text-amber-400" /> Shipment Tracking</h3>

            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {(tracking?.courierName || order.trackingInfo?.courierName) && (
                <div className="bg-inset rounded-lg p-3">
                  <p className="text-[10px] text-theme-dim uppercase tracking-wider">Courier</p>
                  <p className="text-sm font-medium text-theme-primary mt-0.5">{tracking?.courierName || order.trackingInfo?.courierName}</p>
                </div>
              )}
              {(tracking?.awb || order.trackingInfo?.trackingNumber) && (
                <div className="bg-inset rounded-lg p-3">
                  <p className="text-[10px] text-theme-dim uppercase tracking-wider">AWB / Tracking #</p>
                  <p className="text-sm font-medium text-theme-primary mt-0.5 font-mono">{tracking?.awb || order.trackingInfo?.trackingNumber}</p>
                </div>
              )}
              {tracking?.shipmentStatus && (
                <div className="bg-inset rounded-lg p-3">
                  <p className="text-[10px] text-theme-dim uppercase tracking-wider">Shipment Status</p>
                  <p className="text-sm font-medium text-amber-400 mt-0.5 capitalize">{tracking.shipmentStatus.replace(/_/g, ' ')}</p>
                </div>
              )}
              {(tracking?.estimatedDelivery || order.trackingInfo?.estimatedDelivery) && (
                <div className="bg-inset rounded-lg p-3">
                  <p className="text-[10px] text-theme-dim uppercase tracking-wider">Est. Delivery</p>
                  <p className="text-sm font-medium text-theme-primary mt-0.5">{new Date(tracking?.estimatedDelivery || order.trackingInfo?.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              )}
            </div>

            {/* Scan timeline */}
            {trackingLoading ? (
              <div className="flex items-center gap-2 text-sm text-theme-dim py-4"><Loader className="w-4 h-4 animate-spin" /> Loading tracking details...</div>
            ) : tracking?.scans?.length > 0 ? (
              <div className="space-y-0 max-h-72 overflow-y-auto pr-1">
                {tracking.scans.map((scan, i) => {
                  const isFirst = i === 0;
                  const isLast = i === tracking.scans.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${isFirst ? 'bg-amber-500' : 'bg-edge'}`} />
                        {!isLast && <div className="w-px flex-1 bg-edge/40 min-h-[24px]" />}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className={`text-sm ${isFirst ? 'font-semibold text-theme-primary' : 'text-theme-secondary'}`}>{scan.activity}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          {scan.location && (
                            <span className="text-xs text-theme-dim flex items-center gap-1"><Navigation className="w-3 h-3" />{scan.location}</span>
                          )}
                          {scan.timestamp && (
                            <span className="text-xs text-theme-dim">{new Date(scan.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-theme-dim">No scan events available yet. Tracking details will appear once your order is picked up.</p>
            )}
          </div>
        )}

        {/* Payment */}
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h3 className="font-semibold text-theme-primary mb-3">Payment</h3>
          <div className="text-sm text-theme-secondary space-y-1">
            <div className="flex justify-between"><span>Item Total</span><span>Rs. {order.itemTotal?.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{order.shippingCost > 0 ? `Rs. ${order.shippingCost}` : 'Free'}</span></div>
            <div className="border-t border-edge/50 pt-2 mt-2 flex justify-between font-bold text-theme-primary"><span>Total</span><span>Rs. {order.totalAmount?.toLocaleString('en-IN')}</span></div>
            <p className="text-xs text-theme-dim mt-1 capitalize">Status: {order.paymentStatus}</p>
          </div>
        </div>
      </div>

      {/* Review section -- per item */}
      {order.status === 'delivered' && (order.items || []).length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="font-semibold text-theme-primary">Reviews</h3>
          {(order.items || []).map((item) => {
            const rev = itemReviews[item.productId];
            if (!rev) return null;
            return (
              <div key={item.productId} className="bg-card border border-edge/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-inset rounded-lg overflow-hidden shrink-0">
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-theme-dim m-auto mt-3" />}
                  </div>
                  <p className="text-sm font-medium text-theme-primary truncate">{item.title}</p>
                </div>
                {rev.existingReview ? (
                  <div>
                    <StarRating rating={rev.existingReview.rating} />
                    {rev.existingReview.reviewText && <p className="text-sm text-theme-secondary mt-2">{rev.existingReview.reviewText}</p>}
                    {rev.existingReview.images?.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {rev.existingReview.images.map((img, i) => (
                          <div key={i} className="w-14 h-14 rounded-lg overflow-hidden bg-inset"><img src={img.url} alt="" className="w-full h-full object-cover" /></div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : rev.showForm ? (
                  <div>
                    <StarRating rating={rev.rating} onRate={r => setItemReviews(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], rating: r } }))} interactive />
                    <textarea
                      value={rev.reviewText}
                      onChange={e => setItemReviews(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], reviewText: e.target.value } }))}
                      rows={3} placeholder="Share your experience..."
                      className="w-full mt-3 px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50 resize-none"
                    />
                    {/* Photo upload */}
                    <div className="flex items-center gap-2 mt-3">
                      {rev.images.map((img, i) => (
                        <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden bg-inset border border-edge">
                          <img src={img.preview} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeReviewImage(item.productId, i)} className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5 text-white" /></button>
                        </div>
                      ))}
                      {rev.images.length < 3 && (
                        <label className="w-14 h-14 rounded-lg border-2 border-dashed border-edge hover:border-amber-500/50 flex items-center justify-center cursor-pointer transition-colors">
                          <Camera className="w-4 h-4 text-theme-dim" />
                          <input type="file" accept="image/*" multiple onChange={e => handleReviewImageAdd(item.productId, e.target.files)} className="hidden" />
                        </label>
                      )}
                      <span className="text-[10px] text-theme-dim">Up to 3 photos</span>
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button onClick={() => submitReview(item.productId)} disabled={rev.submitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-lg text-sm font-semibold flex items-center gap-2">
                        {rev.submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Submit Review'}
                      </button>
                      <button onClick={() => setItemReviews(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], showForm: false } }))} className="px-4 py-2 bg-inset text-theme-muted rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setItemReviews(prev => ({ ...prev, [item.productId]: { ...prev[item.productId], showForm: true } }))} className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
                    <Star className="w-4 h-4" /> Write a Review
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
