import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Package, ChevronRight, Star, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

const statusConfig = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  confirmed: { color: 'text-blue-400 bg-blue-400/10', icon: Package },
  shipped: { color: 'text-purple-400 bg-purple-400/10', icon: Truck },
  delivered: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  cancelled: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
  refunded: { color: 'text-theme-muted bg-inset', icon: XCircle },
};

export default function CustomerOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!user) return navigate('/auth?redirect=/orders');

    // Check if returning from Cashfree payment
    const cfId = searchParams.get('cf_id');
    if (cfId) {
      verifyPayment(cfId);
    } else {
      loadOrders();
    }
  }, [user]);

  const verifyPayment = async (orderId) => {
    setVerifying(true);
    try {
      const { data } = await API.post('/orders/verify-payment', { orderId });
      toast.success('Payment verified! Your order is confirmed.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Payment verification failed';
      if (msg.includes('not completed')) toast.error('Payment was not completed. Please try again.');
      else toast.error(msg);
    }
    // Clear the cf_id param
    setSearchParams({});
    setVerifying(false);
    loadOrders();
  };

  const loadOrders = async () => {
    try {
      const { data } = await API.get('/orders/my-orders');
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading || verifying) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <LoadingSpinner />
      {verifying && <p className="text-theme-muted mt-4 text-sm">Verifying your payment...</p>}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-theme-primary mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-theme-dim mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-theme-primary mb-2">No orders yet</h2>
          <p className="text-theme-muted mb-6">Start shopping to see your orders here.</p>
          <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const st = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = st.icon;
            return (
              <Link key={order._id} to={`/orders/${order._id}`} className="block bg-card border border-edge/50 rounded-xl p-4 hover:border-edge-strong transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{order.orderNumber}</p>
                    <p className="text-xs text-theme-muted mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                    <StatusIcon className="w-3 h-3" /> {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {(() => { const item = order.items?.[0]; return (
                    <>
                      <div className="w-14 h-14 bg-inset rounded-lg overflow-hidden shrink-0">
                        {item?.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-theme-dim m-auto mt-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">{item?.title || 'Product'}{order.items?.length > 1 ? ` +${order.items.length - 1} more` : ''}</p>
                        <p className="text-xs text-theme-muted">Qty: {order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 1} &middot; Rs. {order.totalAmount?.toLocaleString('en-IN')}</p>
                      </div>
                    </>
                  ); })()}
                  <ChevronRight className="w-4 h-4 text-theme-dim group-hover:text-theme-primary transition-colors" />
                </div>
                {order.status === 'delivered' && (
                  <div className="mt-3 pt-3 border-t border-edge/30">
                    <p className="text-xs text-amber-400 flex items-center gap-1"><Star className="w-3 h-3" /> Leave a review</p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
