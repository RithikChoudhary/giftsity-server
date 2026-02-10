import { useState, useEffect } from 'react';
import { ShoppingCart, Package, Truck, CheckCircle, Clock, XCircle, Search } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

const statusConfig = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  confirmed: { color: 'text-blue-400 bg-blue-400/10', icon: Package },
  shipped: { color: 'text-purple-400 bg-purple-400/10', icon: Truck },
  delivered: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  cancelled: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { loadOrders(); }, [page, filter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filter !== 'all') params.set('status', filter);
      const { data } = await API.get(`/api/admin/orders?${params}`);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Orders ({total})</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : orders.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <ShoppingCart className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const st = statusConfig[o.status] || statusConfig.pending;
            const StatusIcon = st.icon;
            return (
              <div key={o._id} className="bg-card border border-edge/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-theme-primary">{o.orderNumber}</p>
                    <p className="text-xs text-theme-muted">{new Date(o.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                    <StatusIcon className="w-3 h-3" /> {o.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-theme-muted">
                  <div>
                    <p className="text-theme-dim">Product</p>
                    <p className="text-theme-secondary">{o.productSnapshot?.title || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim">Customer</p>
                    <p className="text-theme-secondary">{o.customerId?.name || o.customerEmail}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim">Seller</p>
                    <p className="text-theme-secondary">{o.sellerId?.sellerProfile?.businessName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim">Amount</p>
                    <p className="text-theme-secondary font-medium">Rs. {o.totalAmount?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-theme-dim">
                  <span>Commission: Rs. {(o.commissionAmount || 0).toLocaleString('en-IN')} ({o.commissionRate || 0}%)</span>
                  <span>Gateway: Rs. {(o.paymentGatewayFee || 0).toLocaleString('en-IN')}</span>
                  <span>Seller gets: Rs. {(o.sellerAmount || 0).toLocaleString('en-IN')}</span>
                  <span>Payment: {o.paymentStatus}</span>
                </div>
              </div>
            );
          })}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-lg text-sm font-medium ${page === i + 1 ? 'bg-amber-500 text-zinc-950' : 'bg-card border border-edge text-theme-muted'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
