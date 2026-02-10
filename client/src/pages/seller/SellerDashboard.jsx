import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, ShoppingCart, Package, TrendingUp, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function SellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const { data } = await API.get('/api/seller/dashboard');
      setStats(data.stats || data);
      setRecentOrders(data.recentOrders || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  const isPending = user?.status === 'pending';
  const isSuspended = user?.status === 'suspended';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Dashboard</h1>
          <p className="text-sm text-theme-muted">Welcome back, {user?.sellerProfile?.businessName || user?.name}</p>
        </div>
      </div>

      {isPending && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-400">Account Under Review</p>
            <p className="text-sm text-theme-muted mt-1">Your seller account is pending admin approval. You can set up your products while you wait.</p>
          </div>
        </div>
      )}

      {isSuspended && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-400">Account Suspended</p>
            <p className="text-sm text-theme-muted mt-1">Your products and store are hidden. Go to Settings to request reactivation.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Sales', value: `Rs. ${(stats?.totalSales || 0).toLocaleString('en-IN')}`, icon: DollarSign, color: 'text-green-400 bg-green-400/10' },
          { label: 'Total Orders', value: stats?.totalOrders || 0, icon: ShoppingCart, color: 'text-blue-400 bg-blue-400/10' },
          { label: 'Products', value: stats?.totalProducts || 0, icon: Package, color: 'text-purple-400 bg-purple-400/10' },
          { label: 'Pending Orders', value: stats?.pendingOrders || 0, icon: Clock, color: 'text-amber-400 bg-amber-400/10' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-edge/50 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-theme-primary">{s.value}</p>
            <p className="text-xs text-theme-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Earnings card */}
      {stats?.currentPeriodEarnings && (
        <div className="bg-card border border-edge/50 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-theme-primary mb-4">Current Period Earnings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-theme-muted">Total Sales</p>
              <p className="text-lg font-bold text-theme-primary">Rs. {(stats.currentPeriodEarnings.totalSales || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-theme-muted">Commission</p>
              <p className="text-lg font-bold text-theme-primary">Rs. {(stats.currentPeriodEarnings.commissionDeducted || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-theme-muted">Gateway Fees</p>
              <p className="text-lg font-bold text-theme-primary">Rs. {(stats.currentPeriodEarnings.gatewayFees || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-theme-muted">Net Earnings</p>
              <p className="text-lg font-bold text-green-400">Rs. {(stats.currentPeriodEarnings.netEarning || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
          <p className="text-xs text-theme-dim mt-3">Commission Rate: {stats.yourCommissionRate ?? 0}%</p>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-card border border-edge/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-theme-primary">Recent Orders</h3>
          <Link to="/seller/orders" className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-theme-muted text-center py-6">No orders yet</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.slice(0, 5).map(o => (
              <div key={o._id} className="flex items-center justify-between py-2 border-b border-edge/30 last:border-0">
                <div>
                  <p className="text-sm font-medium text-theme-primary">{o.orderNumber}</p>
                  <p className="text-xs text-theme-muted">{o.productSnapshot?.title} &middot; Qty: {o.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-theme-primary">Rs. {o.totalAmount?.toLocaleString('en-IN')}</p>
                  <span className={`text-xs ${o.status === 'delivered' ? 'text-green-400' : o.status === 'cancelled' ? 'text-red-400' : 'text-amber-400'}`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
