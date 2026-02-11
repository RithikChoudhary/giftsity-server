import { useState, useEffect } from 'react';
import API from '../../api';
import { Building2, CheckCircle, Clock, Search, Loader2, Ban } from 'lucide-react';

export default function AdminCorporateUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      if (search) params.search = search;
      const res = await API.get('/admin/corporate/users', { params });
      setUsers(res.data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [filter]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await API.put('/admin/corporate/users/' + id + '/approve');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    } finally { setActionLoading(''); }
  };

  const handleSuspend = async (id) => {
    const reason = prompt('Reason for suspension:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await API.put('/admin/corporate/users/' + id + '/suspend', { reason });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    } finally { setActionLoading(''); }
  };

  const statusBadge = (status) => {
    const map = {
      pending_approval: { color: 'bg-yellow-500/10 text-yellow-400', icon: Clock, label: 'Pending' },
      active: { color: 'bg-green-500/10 text-green-400', icon: CheckCircle, label: 'Active' },
      suspended: { color: 'bg-red-500/10 text-red-400', icon: Ban, label: 'Suspended' }
    };
    const s = map[status] || map.pending_approval;
    return (
      <span className={'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' + s.color}>
        <s.icon className="w-3 h-3" /> {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Corporate Users</h1>
        <p className="text-sm text-theme-muted">Manage corporate portal accounts</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={(e) => { e.preventDefault(); fetchUsers(); }} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, person, email..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-edge/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </form>
        <div className="flex gap-2">
          {['', 'pending_approval', 'active', 'suspended'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={'px-3 py-2 rounded-lg text-xs font-medium transition-colors ' + (filter === f ? 'bg-amber-500 text-white' : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary')}>
              {f === '' ? 'All' : f === 'pending_approval' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-theme-muted">No corporate users found</div>
      ) : (
        <div className="bg-card border border-edge/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge/30 text-left text-theme-dim">
                <th className="p-4">Company</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Email</th>
                <th className="p-4">Size</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/20">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-inset/30 transition-colors">
                  <td className="p-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                      {u.companyName}
                    </div>
                  </td>
                  <td className="p-4">{u.contactPerson}</td>
                  <td className="p-4 text-theme-muted">{u.email}</td>
                  <td className="p-4 text-theme-muted">{u.companySize || '-'}</td>
                  <td className="p-4">{statusBadge(u.status)}</td>
                  <td className="p-4 text-theme-dim">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {u.status === 'pending_approval' && (
                        <button onClick={() => handleApprove(u._id)} disabled={actionLoading === u._id}
                          className="px-3 py-1 bg-green-500/10 text-green-400 rounded text-xs font-medium hover:bg-green-500/20 disabled:opacity-50">
                          {actionLoading === u._id ? '...' : 'Approve'}
                        </button>
                      )}
                      {u.status === 'active' && (
                        <button onClick={() => handleSuspend(u._id)} disabled={actionLoading === u._id}
                          className="px-3 py-1 bg-red-500/10 text-red-400 rounded text-xs font-medium hover:bg-red-500/20 disabled:opacity-50">
                          {actionLoading === u._id ? '...' : 'Suspend'}
                        </button>
                      )}
                      {u.status === 'suspended' && (
                        <button onClick={() => handleApprove(u._id)} disabled={actionLoading === u._id}
                          className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50">
                          {actionLoading === u._id ? '...' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
