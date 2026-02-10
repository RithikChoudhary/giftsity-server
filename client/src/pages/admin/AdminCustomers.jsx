import { useState, useEffect } from 'react';
import { Users, ShoppingBag, TrendingUp, Search, ArrowUpDown } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('totalSpent'); // totalSpent | totalOrders | createdAt

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const { data } = await API.get('/api/admin/customers');
      setCustomers(Array.isArray(data) ? data : data.customers || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = customers
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'totalSpent') return (b.totalSpent || 0) - (a.totalSpent || 0);
      if (sortBy === 'totalOrders') return (b.totalOrders || 0) - (a.totalOrders || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  if (loading) return <LoadingSpinner />;

  const totalRevenue = customers.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const totalOrders = customers.reduce((s, c) => s + (c.totalOrders || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Customers ({customers.length})</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-edge/50 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-blue-400/10"><Users className="w-4 h-4 text-blue-400" /></div>
          <p className="text-xl font-bold text-theme-primary">{customers.length}</p>
          <p className="text-xs text-theme-muted">Total Customers</p>
        </div>
        <div className="bg-card border border-edge/50 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-green-400/10"><TrendingUp className="w-4 h-4 text-green-400" /></div>
          <p className="text-xl font-bold text-theme-primary">Rs. {totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-theme-muted">Total Revenue</p>
        </div>
        <div className="bg-card border border-edge/50 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-purple-400/10"><ShoppingBag className="w-4 h-4 text-purple-400" /></div>
          <p className="text-xl font-bold text-theme-primary">{totalOrders}</p>
          <p className="text-xs text-theme-muted">Total Purchases</p>
        </div>
      </div>

      {/* Search & sort */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-10 pr-4 py-2 bg-card border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 bg-card border border-edge rounded-xl text-sm text-theme-secondary focus:outline-none">
          <option value="totalSpent">Highest Spender</option>
          <option value="totalOrders">Most Orders</option>
          <option value="createdAt">Newest First</option>
        </select>
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Users className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No customers found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-theme-dim font-medium">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Customer</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2 text-right">Total Spent</div>
            <div className="col-span-1 text-right">Orders</div>
            <div className="col-span-2 text-right">Joined</div>
          </div>
          {filtered.map((c, i) => (
            <div key={c._id} className="grid grid-cols-12 gap-4 bg-card border border-edge/50 rounded-xl px-4 py-3 items-center">
              <div className="col-span-1 text-sm text-theme-dim">{i + 1}</div>
              <div className="col-span-4">
                <p className="text-sm font-medium text-theme-primary truncate">{c.name}</p>
                <p className="text-xs text-theme-muted truncate">{c.email}</p>
              </div>
              <div className="col-span-2 text-xs text-theme-muted">{c.phone || '-'}</div>
              <div className="col-span-2 text-right">
                <p className="text-sm font-bold text-theme-primary">Rs. {(c.totalSpent || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="col-span-1 text-right text-sm text-theme-secondary">{c.totalOrders || 0}</div>
              <div className="col-span-2 text-right text-xs text-theme-dim">{new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
