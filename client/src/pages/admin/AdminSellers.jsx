import { useState, useEffect } from 'react';
import { Store, Check, X, Ban, RotateCcw, Eye, Edit3, Loader, Search, UserCheck, UserX, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminSellers() {
  const [sellers, setSellers] = useState([]);
  const [pending, setPending] = useState([]);
  const [reactivationRequests, setReactivationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [editingCommission, setEditingCommission] = useState(null);
  const [commissionValue, setCommissionValue] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => { loadSellers(); }, []);

  const loadSellers = async () => {
    try {
      const { data } = await API.get('/admin/sellers');
      const allSellers = Array.isArray(data) ? data : data.sellers || [];
      setSellers(allSellers);
      setPending(allSellers.filter(s => s.status === 'pending'));
      setReactivationRequests(allSellers.filter(s => s.status === 'suspended' && (s.sellerProfile?.suspensionRemovalRequested || s.sellerProfile?.reactivationRequest)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const approveSeller = async (id) => {
    setActionLoading(id);
    try {
      await API.put(`/admin/sellers/${id}/approve`);
      toast.success('Seller approved!');
      loadSellers();
    } catch (err) { toast.error('Failed'); }
    setActionLoading(null);
  };

  const rejectSeller = async (id) => {
    setActionLoading(id);
    try {
      await API.put(`/admin/sellers/${id}/suspend`);
      toast.success('Seller rejected');
      loadSellers();
    } catch (err) { toast.error('Failed'); }
    setActionLoading(null);
  };

  const suspendSeller = async (id) => {
    if (!confirm('Suspend this seller? Their products will be hidden.')) return;
    setActionLoading(id);
    try {
      await API.put(`/admin/sellers/${id}/suspend`);
      toast.success('Seller suspended');
      loadSellers();
    } catch (err) { toast.error('Failed'); }
    setActionLoading(null);
  };

  const reactivateSeller = async (id) => {
    setActionLoading(id);
    try {
      await API.put(`/admin/sellers/${id}/approve`);
      toast.success('Seller reactivated!');
      loadSellers();
    } catch (err) { toast.error('Failed'); }
    setActionLoading(null);
  };

  const saveCommission = async (sellerId) => {
    try {
      await API.put(`/admin/sellers/${sellerId}/commission`, { commissionRate: commissionValue });
      toast.success('Commission updated');
      setEditingCommission(null);
      loadSellers();
    } catch (err) { toast.error('Failed'); }
  };

  const filtered = sellers.filter(s => {
    if (tab === 'active') return s.status === 'active';
    if (tab === 'suspended') return s.status === 'suspended';
    if (tab === 'pending') return s.status === 'pending';
    const q = search.toLowerCase();
    if (q && !(s.sellerProfile?.businessName?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))) return false;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Sellers</h1>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Approval ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map(s => (
              <div key={s._id} className="flex items-center justify-between bg-card border border-edge/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  {s.sellerProfile?.profilePhoto ? (
                    <img src={s.sellerProfile.profilePhoto} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-inset rounded-full flex items-center justify-center"><Store className="w-5 h-5 text-theme-dim" /></div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{s.sellerProfile?.businessName || s.name}</p>
                    <p className="text-xs text-theme-muted">{s.email} &middot; {s.phone}</p>
                    {s.sellerProfile?.instagramUsername && (
                      <a href={`https://instagram.com/${s.sellerProfile.instagramUsername.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-400">@{s.sellerProfile.instagramUsername.replace('@', '')}</a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveSeller(s._id)} disabled={actionLoading === s._id} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20">
                    {actionLoading === s._id ? <Loader className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Approve</>}
                  </button>
                  <button onClick={() => rejectSeller(s._id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20">
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reactivation requests */}
      {reactivationRequests.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Reactivation Requests ({reactivationRequests.length})</h3>
          <div className="space-y-3">
            {reactivationRequests.map(s => (
              <div key={s._id} className="bg-card border border-edge/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{s.sellerProfile?.businessName}</p>
                    <p className="text-xs text-theme-muted">{s.email}</p>
                  </div>
                  <button onClick={() => reactivateSeller(s._id)} disabled={actionLoading === s._id} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20">
                    {actionLoading === s._id ? <Loader className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3" /> Reactivate</>}
                  </button>
                </div>
                {s.sellerProfile?.reactivationRequest?.message && (
                  <p className="text-xs text-theme-secondary bg-inset/50 rounded-lg p-2">"{s.sellerProfile.reactivationRequest.message}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs & search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          {['all', 'active', 'suspended', 'pending'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
              {t} ({sellers.filter(s => t === 'all' ? true : s.status === t).length})
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sellers..." className="w-full pl-10 pr-4 py-2 bg-card border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
        </div>
      </div>

      {/* Sellers list */}
      <div className="space-y-3">
        {filtered.map(s => {
          const sp = s.sellerProfile || {};
          return (
            <div key={s._id} className="bg-card border border-edge/50 rounded-xl p-4">
              <div className="flex items-center gap-4">
                {sp.profilePhoto ? (
                  <img src={sp.profilePhoto} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-inset rounded-full flex items-center justify-center"><Store className="w-6 h-6 text-theme-dim" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-theme-primary truncate">{sp.businessName || s.name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.status === 'active' ? 'bg-green-400/10 text-green-400' : s.status === 'suspended' ? 'bg-red-400/10 text-red-400' : 'bg-yellow-400/10 text-yellow-400'}`}>{s.status}</span>
                  </div>
                  <p className="text-xs text-theme-muted">{s.email}</p>
                  <div className="flex gap-4 mt-1 text-xs text-theme-dim">
                    <span>Sales: Rs. {(sp.totalSales || 0).toLocaleString('en-IN')}</span>
                    <span>Orders: {sp.totalOrders || 0}</span>
                    <span>Rating: {sp.rating?.toFixed(1) || 'N/A'}</span>
                    {editingCommission === s._id ? (
                      <span className="flex items-center gap-1">
                        Commission: <input type="number" value={commissionValue} onChange={e => setCommissionValue(+e.target.value)} min={0} max={50} className="w-14 px-1 py-0.5 bg-inset border border-edge rounded text-xs" />%
                        <button onClick={() => saveCommission(s._id)} className="text-green-400 ml-1"><Check className="w-3 h-3" /></button>
                        <button onClick={() => setEditingCommission(null)} className="text-red-400"><X className="w-3 h-3" /></button>
                      </span>
                    ) : (
                      <button onClick={() => { setEditingCommission(s._id); setCommissionValue(sp.commissionRate ?? 0); }} className="text-amber-400 hover:text-amber-300">
                        Commission: {sp.commissionRate ?? 0}% <Edit3 className="w-3 h-3 inline ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {s.status === 'active' && (
                    <button onClick={() => suspendSeller(s._id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20" title="Suspend">
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                  {s.status === 'suspended' && (
                    <button onClick={() => reactivateSeller(s._id)} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20" title="Reactivate">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
