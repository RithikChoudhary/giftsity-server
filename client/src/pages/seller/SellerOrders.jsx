import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, XCircle, ChevronDown, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

const statusConfig = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  confirmed: { color: 'text-blue-400 bg-blue-400/10', icon: Package },
  shipped: { color: 'text-purple-400 bg-purple-400/10', icon: Truck },
  delivered: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  cancelled: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
};

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState(null);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const { data } = await API.get('/api/seller/orders');
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await API.put(`/api/seller/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order ${newStatus}`);
      loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setUpdating(null);
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Orders</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            {f === 'all' ? `All (${orders.length})` : `${f} (${orders.filter(o => o.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Package className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const st = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = st.icon;
            return (
              <div key={order._id} className="bg-card border border-edge/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{order.orderNumber}</p>
                    <p className="text-xs text-theme-muted">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                    <StatusIcon className="w-3 h-3" /> {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-inset rounded-lg overflow-hidden shrink-0">
                    {order.productSnapshot?.image ? <img src={order.productSnapshot.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-theme-dim m-auto mt-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate">{order.productSnapshot?.title}</p>
                    <p className="text-xs text-theme-muted">Qty: {order.quantity} &middot; Rs. {order.totalAmount?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {/* Customer & shipping */}
                <div className="text-xs text-theme-muted mb-3">
                  <p>Ship to: {order.shippingAddress?.name}, {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
                </div>
                {/* Earnings */}
                <div className="flex items-center gap-4 text-xs text-theme-muted bg-inset/50 rounded-lg px-3 py-2 mb-3">
                  <span>Sale: Rs. {order.totalAmount?.toLocaleString('en-IN')}</span>
                  <span>Commission: Rs. {(order.commissionAmount || 0).toLocaleString('en-IN')}</span>
                  <span className="text-green-400">You get: Rs. {(order.sellerAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                {/* Actions */}
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(order._id, 'confirmed')} disabled={updating === order._id} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/20">
                        {updating === order._id ? <Loader className="w-3 h-3 animate-spin" /> : 'Confirm'}
                      </button>
                      <button onClick={() => updateStatus(order._id, 'cancelled')} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20">Cancel</button>
                    </>
                  )}
                  {order.status === 'confirmed' && (
                    <button onClick={() => updateStatus(order._id, 'shipped')} disabled={updating === order._id} className="px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/20">
                      {updating === order._id ? <Loader className="w-3 h-3 animate-spin" /> : 'Mark Shipped'}
                    </button>
                  )}
                  {order.status === 'shipped' && (
                    <button onClick={() => updateStatus(order._id, 'delivered')} disabled={updating === order._id} className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20">
                      {updating === order._id ? <Loader className="w-3 h-3 animate-spin" /> : 'Mark Delivered'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
