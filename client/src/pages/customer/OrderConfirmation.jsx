import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, Package, MapPin, ArrowRight, ShoppingBag } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function OrderConfirmation() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return navigate('/auth');
    loadOrder();
  }, [id, user, authLoading]);

  useEffect(() => {
    if (!order) return;
    const estimatedDelivery = new Date(Date.now() + 7 * 86400000)
      .toISOString().split('T')[0];

    window.renderOptIn = function () {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('surveyoptin', function () {
          window.gapi.surveyoptin.render({
            merchant_id: 5728574030,
            order_id: order.orderNumber,
            email: order.customerEmail,
            delivery_country: 'IN',
            estimated_delivery_date: estimatedDelivery,
          });
        });
      }
    };

    if (window.gapi && window.gapi.load) {
      window.renderOptIn();
    }
  }, [order]);

  const loadOrder = async () => {
    try {
      const { data } = await API.get(`/orders/${id}`);
      setOrder(data.order || data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!order) return (
    <div className="text-center py-16">
      <p className="text-theme-muted">Order not found</p>
      <Link to="/orders" className="text-amber-400 hover:text-amber-300 text-sm mt-2 inline-block">View all orders</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Success Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full mb-5">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-theme-primary mb-2">Order Placed Successfully!</h1>
        <p className="text-theme-muted text-sm">Thank you for your purchase. We've sent a confirmation email to <span className="text-theme-primary">{order.customerEmail}</span></p>
      </div>

      {/* Order Summary Card */}
      <div className="bg-card border border-edge/50 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-edge/30">
          <div>
            <p className="text-xs text-theme-muted uppercase tracking-wider">Order Number</p>
            <p className="text-lg font-semibold text-amber-400">{order.orderNumber}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-400/10 text-blue-400 rounded-full text-xs font-medium">
            <Package className="w-3.5 h-3.5" /> {order.status}
          </span>
        </div>

        {/* Items */}
        <div className="space-y-3 mb-4">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-14 h-14 bg-inset rounded-lg overflow-hidden shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-6 h-6 text-theme-dim m-auto mt-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-primary truncate">{item.title}</p>
                <p className="text-xs text-theme-muted">Qty: {item.quantity} &times; Rs. {item.price?.toLocaleString('en-IN')}</p>
              </div>
              <p className="text-sm font-semibold text-theme-primary">Rs. {(item.price * item.quantity)?.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-edge/30 pt-3 space-y-1.5">
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-theme-muted">Discount</span>
              <span className="text-green-400">-Rs. {order.discountAmount?.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-theme-primary">Total Paid</span>
            <span className="text-amber-400">Rs. {order.totalAmount?.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      {order.shippingAddress && (
        <div className="bg-card border border-edge/50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-theme-primary">Shipping Address</h3>
          </div>
          <p className="text-sm text-theme-muted leading-relaxed">
            {order.shippingAddress.name && <span className="text-theme-primary font-medium">{order.shippingAddress.name}<br /></span>}
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 && <>, {order.shippingAddress.line2}</>}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
            {order.shippingAddress.phone && <><br />Phone: {order.shippingAddress.phone}</>}
          </p>
        </div>
      )}

      {/* What's Next */}
      <div className="bg-card border border-edge/50 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-theme-primary mb-3">What happens next?</h3>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-amber-400">1</span>
            </div>
            <p className="text-sm text-theme-muted">The seller will confirm and prepare your order for shipping.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-amber-400">2</span>
            </div>
            <p className="text-sm text-theme-muted">You'll receive tracking details once your order is shipped.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-amber-400">3</span>
            </div>
            <p className="text-sm text-theme-muted">After delivery, you can leave a review to help other shoppers!</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link to={`/orders/${order._id}`} className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-card border border-edge/50 hover:border-amber-400/30 text-theme-primary rounded-xl font-medium text-sm transition-all">
          <Package className="w-4 h-4" /> View Order Details <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/shop" className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold text-sm transition-all">
          <ShoppingBag className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>
    </div>
  );
}
