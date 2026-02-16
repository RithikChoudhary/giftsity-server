import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, ShoppingCart, Package, TrendingUp, ArrowRight, Clock, AlertTriangle, Wallet, CalendarDays, Truck, CreditCard } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SellerAPI } from '../../api';

export default function SellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [dashData, setDashData] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const { data } = await SellerAPI.get('/dashboard');
      setStats(data.stats || data);
      setDashData(data);
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
            {user?.sellerProfile?.suspensionReason && (
              <p className="text-sm text-red-300 mt-1">
                <span className="font-medium">Reason:</span> {user.sellerProfile.suspensionReason}
              </p>
            )}
            {user?.sellerProfile?.suspensionType && (
              <p className="text-xs text-theme-dim mt-1">
                Suspension type: {user.sellerProfile.suspensionType === 'auto' ? 'Automatic (performance-based)' : 'Manual (admin action)'}
              </p>
            )}
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

      {/* Bank details warning */}
      {dashData.bankDetailsComplete === false && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-400">Bank Details Required</p>
            <p className="text-sm text-theme-muted mt-1">You must add your bank account details before you can create products or receive payouts.</p>
            <Link to="/seller/settings" className="inline-flex items-center gap-1 mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors">
              Add Bank Details <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Earnings & Payout Info */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {/* Lifetime earnings */}
        <div className="bg-card border border-edge/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-400/10 text-green-400"><Wallet className="w-4 h-4" /></div>
            <p className="text-xs text-theme-muted">Lifetime Earnings</p>
          </div>
          <p className="text-2xl font-bold text-green-400">Rs. {(dashData.lifetimeEarnings || 0).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-theme-dim mt-1">Total paid out to you</p>
        </div>

        {/* Pending payout */}
        <div className="bg-card border border-edge/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-400/10 text-amber-400"><DollarSign className="w-4 h-4" /></div>
            <p className="text-xs text-theme-muted">Pending Payout</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">Rs. {(dashData.currentPeriodEarnings?.pendingAmount || 0).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-theme-dim mt-1">{dashData.currentPeriodEarnings?.pendingOrderCount || 0} delivered orders awaiting payout</p>
        </div>

        {/* Next payout date */}
        <div className="bg-card border border-edge/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-400/10 text-blue-400"><CalendarDays className="w-4 h-4" /></div>
            <p className="text-xs text-theme-muted">Next Payout</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{dashData.nextPayoutDate ? new Date(dashData.nextPayoutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '--'}</p>
          <p className="text-[11px] text-theme-dim mt-1 capitalize">{dashData.payoutSchedule || 'biweekly'} schedule</p>
        </div>
      </div>

      {/* Earnings breakdown */}
      {dashData.currentPeriodEarnings && (dashData.currentPeriodEarnings.totalSales > 0 || dashData.currentPeriodEarnings.pendingOrderCount > 0) && (
        <div className="bg-card border border-edge/50 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-theme-primary mb-4">Pending Earnings Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-theme-muted">Total Sales</p>
              <p className="text-lg font-bold text-theme-primary">Rs. {(dashData.currentPeriodEarnings.totalSales || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-theme-muted">Commission</p>
              <p className="text-lg font-bold text-theme-primary">-Rs. {(dashData.currentPeriodEarnings.commissionDeducted || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-theme-muted">Gateway Fees</p>
              <p className="text-lg font-bold text-theme-primary">-Rs. {(dashData.currentPeriodEarnings.gatewayFees || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-theme-muted">Shipping</p>
              <p className="text-lg font-bold text-red-400">{(dashData.currentPeriodEarnings.shippingDeducted || 0) > 0 ? `-Rs. ${dashData.currentPeriodEarnings.shippingDeducted.toLocaleString('en-IN')}` : 'Rs. 0'}</p>
            </div>
            <div>
              <p className="text-theme-muted">Net Earnings</p>
              <p className="text-lg font-bold text-green-400">Rs. {(dashData.currentPeriodEarnings.netEarning || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
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
                  <p className="text-xs text-theme-muted">{o.items?.[0]?.title || 'Product'}{o.items?.length > 1 ? ` +${o.items.length - 1}` : ''} &middot; Qty: {o.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 1}</p>
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
