import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { corporateAPI } from '../../api';
import { Package, Loader2, CheckCircle, XCircle, Clock, Truck, Eye, Download } from 'lucide-react';

export default function CorporateOrders() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [verifyMsg, setVerifyMsg] = useState('');

  // Verify payment on return from Cashfree
  useEffect(() => {
    const cfId = searchParams.get('cf_id');
    if (cfId) {
      corporateAPI.verifyPayment({ orderId: cfId })
        .then(() => setVerifyMsg('Payment verified successfully!'))
        .catch(() => setVerifyMsg('Payment verification pending. It may take a few minutes.'));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    corporateAPI.getOrders({ page, limit: 20 })
      .then(res => {
        setOrders(res.data.orders || []);
        setPages(res.data.pages || 1);
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [page]);

  const statusIcon = (status) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'shipped': return <Truck className="w-4 h-4 text-blue-400" />;
      default: return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-500/10 text-green-400';
      case 'cancelled': return 'bg-red-500/10 text-red-400';
      case 'shipped': return 'bg-blue-500/10 text-blue-400';
      default: return 'bg-amber-500/10 text-amber-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Orders</h1>
        {orders.length > 0 && (
          <button onClick={() => {
            const token = localStorage.getItem('giftsity_corporate_token');
            window.open(`${corporateAPI.getExportCsvUrl()}?token=${token}`, '_blank');
          }}
            className="flex items-center gap-2 px-4 py-2 border border-amber-400/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/10 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {verifyMsg && (
        <div className={`p-3 rounded-lg text-sm ${verifyMsg.includes('success') ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{verifyMsg}</div>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-theme-dim mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
          <p className="text-theme-muted mb-6">Start by browsing our corporate catalog</p>
          <Link to="/corporate/catalog" className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <Link key={order._id} to={`/corporate/orders/${order._id}`}
              className="block bg-card border border-edge/50 rounded-xl p-5 hover:border-amber-400/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {statusIcon(order.status)}
                  <div>
                    <p className="font-semibold text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-theme-muted">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(order.status)}`}>{order.status}</span>
                  <Eye className="w-4 h-4 text-theme-dim" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {order.items?.slice(0, 3).map((item, i) => (
                    <div key={i} className="w-10 h-10 rounded bg-inset overflow-hidden">
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-theme-dim m-auto mt-3" />}
                    </div>
                  ))}
                  {order.items?.length > 3 && <span className="text-xs text-theme-dim">+{order.items.length - 3}</span>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">Rs. {order.totalAmount?.toLocaleString()}</p>
                  <p className="text-xs text-theme-dim">{order.items?.reduce((s, i) => s + (i.quantity || 1), 0)} units</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${page === i + 1 ? 'bg-amber-500 text-white' : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
