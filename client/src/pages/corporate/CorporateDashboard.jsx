import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCorporateAuth } from '../../context/CorporateAuthContext';
import { corporateAPI } from '../../api';
import { Package, FileText, ShoppingBag, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CorporateDashboard() {
  const { user } = useCorporateAuth();
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      corporateAPI.getOrders({ limit: 5 }).catch(() => ({ data: { orders: [] } })),
      corporateAPI.getQuotes().catch(() => ({ data: { quotes: [] } }))
    ]).then(([ordersRes, quotesRes]) => {
      setOrders(ordersRes.data.orders || []);
      setQuotes(quotesRes.data.quotes || []);
    }).finally(() => setLoading(false));
  }, []);

  if (user?.status === 'pending_approval') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome, {user.companyName}</h1>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-8 text-center">
          <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-yellow-400 mb-2">Account Pending Approval</h2>
          <p className="text-theme-muted max-w-md mx-auto">Your corporate account is being reviewed by our team. You'll get full access to the corporate catalog, bulk ordering, and quote management once approved.</p>
          <p className="text-sm text-theme-dim mt-4">Meanwhile, you can <Link to="/corporate/inquiry" className="text-amber-400 hover:underline">submit an inquiry</Link> for immediate assistance.</p>
        </div>
      </div>
    );
  }

  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const pendingQuotes = quotes.filter(q => q.status === 'sent');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.companyName}</h1>
        <p className="text-theme-muted text-sm">{user?.contactPerson} &middot; {user?.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-theme-muted">Total Orders</span>
          </div>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm text-theme-muted">Paid Orders</span>
          </div>
          <p className="text-2xl font-bold">{paidOrders.length}</p>
        </div>
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-theme-muted">Pending Quotes</span>
          </div>
          <p className="text-2xl font-bold">{pendingQuotes.length}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/corporate/catalog" className="bg-card border border-edge/50 rounded-xl p-5 hover:border-amber-400/30 transition-colors group">
          <ShoppingBag className="w-6 h-6 text-amber-400 mb-2" />
          <p className="font-semibold group-hover:text-amber-400 transition-colors">Browse Catalog</p>
          <p className="text-xs text-theme-muted mt-1">Explore curated corporate gifts</p>
        </Link>
        <Link to="/corporate/orders" className="bg-card border border-edge/50 rounded-xl p-5 hover:border-amber-400/30 transition-colors group">
          <Package className="w-6 h-6 text-blue-400 mb-2" />
          <p className="font-semibold group-hover:text-amber-400 transition-colors">View Orders</p>
          <p className="text-xs text-theme-muted mt-1">Track your bulk orders</p>
        </Link>
        <Link to="/corporate/quotes" className="bg-card border border-edge/50 rounded-xl p-5 hover:border-amber-400/30 transition-colors group">
          <FileText className="w-6 h-6 text-green-400 mb-2" />
          <p className="font-semibold group-hover:text-amber-400 transition-colors">Manage Quotes</p>
          <p className="text-xs text-theme-muted mt-1">Review and approve quotes</p>
        </Link>
      </div>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link to="/corporate/orders" className="text-sm text-amber-400 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 5).map(order => (
              <Link key={order._id} to={`/corporate/orders/${order._id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-inset/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-theme-muted">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">Rs. {order.totalAmount?.toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'delivered' ? 'bg-green-500/10 text-green-400' : order.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {order.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pending Quotes */}
      {pendingQuotes.length > 0 && (
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold">Quotes Awaiting Your Response</h2>
          </div>
          <div className="space-y-3">
            {pendingQuotes.map(quote => (
              <Link key={quote._id} to={`/corporate/quotes`} className="flex items-center justify-between p-3 rounded-lg hover:bg-inset/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{quote.quoteNumber}</p>
                  <p className="text-xs text-theme-muted">{quote.items?.length} items</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">Rs. {quote.finalAmount?.toLocaleString()}</p>
                  <p className="text-xs text-theme-dim">Expires {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'N/A'}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="text-center py-8 text-theme-muted">Loading...</div>}
    </div>
  );
}
