import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Store, ShoppingCart, Package, Users, Briefcase, TrendingUp, ArrowRight, Settings } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const { data } = await API.get('/api/admin/dashboard');
      setStats(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  const s = stats?.stats || stats || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary">Dashboard</h1>
          <p className="text-sm text-theme-muted">Platform overview</p>
        </div>
        <Link to="/admin/settings" className="flex items-center gap-2 px-4 py-2 bg-card border border-edge rounded-xl text-sm text-theme-secondary hover:border-edge-strong transition-colors">
          <Settings className="w-4 h-4" /> Settings
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Sellers', value: s.totalSellers || 0, icon: Store, color: 'text-blue-400 bg-blue-400/10' },
          { label: 'Active Sellers', value: s.activeSellers || 0, icon: Store, color: 'text-green-400 bg-green-400/10' },
          { label: 'Total Products', value: s.totalProducts || 0, icon: Package, color: 'text-purple-400 bg-purple-400/10' },
          { label: 'Total Customers', value: s.totalCustomers || 0, icon: Users, color: 'text-pink-400 bg-pink-400/10' },
        ].map((item, i) => (
          <div key={i} className="bg-card border border-edge/50 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-theme-primary">{item.value}</p>
            <p className="text-xs text-theme-muted mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h3 className="font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" /> Platform Commission Earnings
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">This Month</span>
              <span className="font-bold text-theme-primary">Rs. {(s.b2c?.yourCommissionEarned || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">GMV</span>
              <span className="font-bold text-theme-primary">Rs. {(s.b2c?.totalGMV || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">Total Orders</span>
              <span className="font-bold text-theme-primary">{s.b2c?.totalOrders || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">Avg Order Value</span>
              <span className="font-bold text-theme-primary">Rs. {(s.b2c?.avgOrderValue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-3 border-t border-edge/50">
              <p className="text-xs text-theme-dim">Global Commission: {s.currentSettings?.globalCommissionRate ?? 0}%</p>
            </div>
          </div>
          <Link to="/admin/settings" className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 mt-3">Adjust Commission <ArrowRight className="w-3 h-3" /></Link>
        </div>

        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h3 className="font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" /> B2B Corporate
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">Total Inquiries</span>
              <span className="font-bold text-theme-primary">{s.b2b?.totalInquiries || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">New Inquiries</span>
              <span className="font-bold text-amber-400">{s.b2b?.newInquiries || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-theme-muted">Converted</span>
              <span className="font-bold text-green-400">{s.b2b?.convertedDeals || 0}</span>
            </div>
          </div>
          <Link to="/admin/b2b" className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 mt-3">Manage Leads <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { to: '/admin/sellers', label: 'Manage Sellers', icon: Store },
          { to: '/admin/orders', label: 'View Orders', icon: ShoppingCart },
          { to: '/admin/payouts', label: 'Process Payouts', icon: DollarSign },
          { to: '/admin/b2b', label: 'B2B Inquiries', icon: Briefcase },
        ].map((a, i) => (
          <Link key={i} to={a.to} className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-3 hover:border-edge-strong transition-colors group">
            <a.icon className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-medium text-theme-secondary group-hover:text-theme-primary">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
