import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, Package, MapPin, ArrowRight, ShoppingBag } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function OrderConfirmation() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return navigate('/auth');
    loadOrders();
  }, [id, user, authLoading]);

  useEffect(() => {
    if (orders.length === 0) return;
    const first = orders[0];
    const estimatedDelivery = new Date(Date.now() + 7 * 86400000)
      .toISOString().split('T')[0];

    window.renderOptIn = function () {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('surveyoptin', function () {
          window.gapi.surveyoptin.render({
            merchant_id: 5728574030,
            order_id: first.orderNumber,
            email: first.customerEmail,
            delivery_country: 'IN',
            estimated_delivery_date: estimatedDelivery,
          });
        });
      }
    };

    if (window.gapi && window.gapi.load) {
      window.renderOptIn();
    }
  }, [orders]);

  const loadOrders = async () => {
    try {
      // Support both /orders/:id/confirmation (single) and /orders/confirmation?ids=a,b (multi)
      const idsParam = searchParams.get('ids');
      const orderIds = idsParam ? idsParam.split(',').filter(Boolean) : id ? [id] : [];

      if (orderIds.length === 0) {
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        orderIds.map(oid => API.get(`/orders/${oid}`).then(r => r.data.order || r.data).catch(() => null))
      );
      setOrders(results.filter(Boolean));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;
  if (orders.length === 0) return (
    <div className="text-center py-16">
      <p className="text-theme-muted">Order not found</p>
      <Link to="/orders" className="text-amber-400 hover:text-amber-300 text-sm mt-2 inline-block">View all orders</Link>
    </div>
  );

  const grandTotal = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalDiscount = orders.reduce((s, o) => s + (o.discountAmount || 0), 0);
  const shippingAddress = orders[0].shippingAddress;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Success Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full mb-5">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-theme-primary mb-2">Order Placed Successfully!</h1>
        <p className="text-theme-muted text-sm">Thank you for your purchase. We've sent a confirmation email to <span className="text-theme-primary">{orders[0].customerEmail}</span></p>
      </div>

      {/* Order Cards */}
      {orders.map((order) => (
        <div key={order._id} className="bg-card border border-edge/50 rounded-xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-edge/30">
            <div>
              <p className="text-xs text-theme-muted uppercase tracking-wider">Order Number</p>
              <p className="text-lg font-semibold text-amber-400">{order.orderNumber}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-400/10 text-blue-400 rounded-full text-xs font-medium">
              <Package className="w-3.5 h-3.5" /> {order.status}
            </span>
          </div>

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

          {order.discountAmount > 0 && (
            <div className="border-t border-edge/30 pt-3">
              <div className="flex justify-between text-xs">
                <span className="text-theme-muted">Discount</span>
                <span className="text-green-400">-Rs. {order.discountAmount?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <div className="border-t border-edge/30 pt-3 mt-1">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-theme-primary">Subtotal</span>
              <span className="text-amber-400">Rs. {order.totalAmount?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Grand Total (shown when multiple orders) */}
      {orders.length > 1 && (
        <div className="bg-card border border-amber-400/30 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-theme-primary">Total Paid ({orders.length} orders)</span>
            <span className="text-lg font-bold text-amber-400">Rs. {grandTotal.toLocaleString('en-IN')}</span>
          </div>
          {totalDiscount > 0 && (
            <p className="text-xs text-green-400 mt-1">You saved Rs. {totalDiscount.toLocaleString('en-IN')}</p>
          )}
        </div>
      )}

      {/* Shipping Address */}
      {shippingAddress && (
        <div className="bg-card border border-edge/50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-theme-primary">Shipping Address</h3>
          </div>
          <p className="text-sm text-theme-muted leading-relaxed">
            {shippingAddress.name && <span className="text-theme-primary font-medium">{shippingAddress.name}<br /></span>}
            {shippingAddress.line1}
            {shippingAddress.line2 && <>, {shippingAddress.line2}</>}<br />
            {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}
            {shippingAddress.phone && <><br />Phone: {shippingAddress.phone}</>}
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
            <p className="text-sm text-theme-muted">The creator will confirm and prepare your order for shipping.</p>
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
        <Link to="/orders" className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-card border border-edge/50 hover:border-amber-400/30 text-theme-primary rounded-xl font-medium text-sm transition-all">
          <Package className="w-4 h-4" /> View All Orders <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/shop" className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold text-sm transition-all">
          <ShoppingBag className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>
    </div>
  );
}
