import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Package, Truck, CheckCircle, Clock, XCircle, MapPin, Star, ArrowLeft, Loader } from 'lucide-react';
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, reviewText: '' });
  const [existingReview, setExistingReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return navigate('/auth');
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      const { data } = await API.get(`/api/orders/${id}`);
      setOrder(data);
      // Check existing review
      try {
        const revRes = await API.get(`/api/reviews/product/${data.productId?._id || data.productId}`);
        const myReview = (revRes.data.reviews || []).find(r => r.customerId?._id === user._id || r.orderId === id);
        if (myReview) setExistingReview(myReview);
      } catch (e) {}
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const submitReview = async () => {
    if (!reviewForm.rating) return toast.error('Select a rating');
    setSubmitting(true);
    try {
      await API.post('/api/reviews', {
        productId: order.productId?._id || order.productId,
        orderId: order._id,
        rating: reviewForm.rating,
        reviewText: reviewForm.reviewText
      });
      toast.success('Review submitted!');
      setShowReview(false);
      loadOrder();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit review'); }
    setSubmitting(false);
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
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'delivered' ? 'bg-green-400/10 text-green-400' : order.status === 'cancelled' ? 'bg-red-400/10 text-red-400' : 'bg-amber-400/10 text-amber-400'}`}>{order.status}</span>
      </div>

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
        {/* Product */}
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h3 className="font-semibold text-theme-primary mb-3">Product</h3>
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-inset rounded-lg overflow-hidden shrink-0">
              {order.productSnapshot?.image ? <img src={order.productSnapshot.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-8 h-8 text-theme-dim m-auto mt-6" />}
            </div>
            <div>
              <p className="font-medium text-sm text-theme-primary">{order.productSnapshot?.title}</p>
              <p className="text-xs text-theme-muted mt-1">Qty: {order.quantity}</p>
              <p className="text-sm font-bold text-theme-primary mt-1">Rs. {order.totalAmount?.toLocaleString('en-IN')}</p>
            </div>
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

        {/* Tracking */}
        {order.trackingInfo?.trackingNumber && (
          <div className="bg-card border border-edge/50 rounded-xl p-5">
            <h3 className="font-semibold text-theme-primary mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-amber-400" /> Tracking Info</h3>
            <div className="text-sm text-theme-secondary space-y-1">
              <p>Courier: {order.trackingInfo.courierName}</p>
              <p>Tracking #: {order.trackingInfo.trackingNumber}</p>
              {order.trackingInfo.estimatedDelivery && <p>Est. Delivery: {new Date(order.trackingInfo.estimatedDelivery).toLocaleDateString()}</p>}
            </div>
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

      {/* Review section */}
      {order.status === 'delivered' && (
        <div className="mt-6 bg-card border border-edge/50 rounded-xl p-5">
          {existingReview ? (
            <div>
              <h3 className="font-semibold text-theme-primary mb-3">Your Review</h3>
              <StarRating rating={existingReview.rating} />
              {existingReview.reviewText && <p className="text-sm text-theme-secondary mt-2">{existingReview.reviewText}</p>}
            </div>
          ) : showReview ? (
            <div>
              <h3 className="font-semibold text-theme-primary mb-3">Write a Review</h3>
              <StarRating rating={reviewForm.rating} onRate={r => setReviewForm(f => ({ ...f, rating: r }))} interactive />
              <textarea value={reviewForm.reviewText} onChange={e => setReviewForm(f => ({ ...f, reviewText: e.target.value }))} rows={3} placeholder="Share your experience..." className="w-full mt-3 px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50 resize-none" />
              <div className="flex gap-3 mt-3">
                <button onClick={submitReview} disabled={submitting} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-lg text-sm font-semibold flex items-center gap-2">
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : 'Submit Review'}
                </button>
                <button onClick={() => setShowReview(false)} className="px-4 py-2 bg-inset text-theme-muted rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowReview(true)} className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
              <Star className="w-4 h-4" /> Write a Review
            </button>
          )}
        </div>
      )}
    </div>
  );
}
