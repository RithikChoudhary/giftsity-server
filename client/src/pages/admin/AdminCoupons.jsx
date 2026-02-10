import { useState, useEffect } from 'react';
import { Tag, Plus, Edit3, Trash2, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = { code: '', description: '', type: 'percent', value: '', minOrderAmount: '', maxDiscount: '', usageLimit: 100, expiresAt: '' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadCoupons(); }, []);

  const loadCoupons = async () => {
    try {
      const { data } = await API.get('/coupons');
      setCoupons(data.coupons || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openForm = (coupon = null) => {
    if (coupon) {
      setEditing(coupon._id);
      setForm({
        code: coupon.code,
        description: coupon.description || '',
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount || '',
        maxDiscount: coupon.maxDiscount || '',
        usageLimit: coupon.usageLimit,
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().split('T')[0] : ''
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.value || !form.expiresAt) return toast.error('Code, value, and expiry are required');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        value: Number(form.value),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscount: Number(form.maxDiscount) || 0,
        usageLimit: Number(form.usageLimit) || 100
      };
      if (editing) {
        await API.put(`/coupons/${editing}`, payload);
        toast.success('Coupon updated');
      } else {
        await API.post('/coupons', payload);
        toast.success('Coupon created');
      }
      setShowForm(false);
      loadCoupons();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  const deleteCoupon = async (id) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      await API.delete(`/coupons/${id}`);
      toast.success('Deleted');
      loadCoupons();
    } catch (e) { toast.error('Failed'); }
  };

  const toggleActive = async (coupon) => {
    try {
      await API.put(`/coupons/${coupon._id}`, { isActive: !coupon.isActive });
      loadCoupons();
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2"><Tag className="w-6 h-6 text-amber-400" /> Coupons</h1>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-edge rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-theme-primary">{editing ? 'Edit Coupon' : 'New Coupon'}</h2>
              <button onClick={() => setShowForm(false)} className="text-theme-dim hover:text-theme-primary"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Code *</label>
                <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME20" className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Welcome discount" className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none">
                    <option value="percent">Percentage</option>
                    <option value="flat">Flat Amount</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Value * {form.type === 'percent' ? '(%)' : '(Rs.)'}</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Min Order</label>
                  <input type="number" value={form.minOrderAmount} onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Max Disc.</label>
                  <input type="number" value={form.maxDiscount} onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Limit</label>
                  <input type="number" value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Expires At *</label>
                <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none" required />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Create Coupon'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Tag className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No coupons yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(c => {
            const expired = new Date(c.expiresAt) < new Date();
            return (
              <div key={c._id} className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-400 tracking-wider">{c.code}</span>
                    {!c.isActive && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded">Inactive</span>}
                    {expired && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded">Expired</span>}
                  </div>
                  <p className="text-xs text-theme-muted mt-0.5">
                    {c.type === 'percent' ? `${c.value}% off` : `Rs. ${c.value} off`}
                    {c.maxDiscount > 0 && c.type === 'percent' ? ` (max Rs. ${c.maxDiscount})` : ''}
                    {c.minOrderAmount > 0 ? ` | Min Rs. ${c.minOrderAmount}` : ''}
                    {' | '}{c.usedCount}/{c.usageLimit} used
                    {' | Exp: '}{new Date(c.expiresAt).toLocaleDateString()}
                  </p>
                  {c.description && <p className="text-xs text-theme-dim mt-0.5">{c.description}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleActive(c)} className={`px-2 py-1 rounded-lg text-xs ${c.isActive ? 'bg-green-500/10 text-green-400' : 'bg-inset text-theme-dim'}`}>
                    {c.isActive ? 'Active' : 'Off'}
                  </button>
                  <button onClick={() => openForm(c)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-theme-primary"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => deleteCoupon(c._id)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
