import { useState, useEffect } from 'react';
import { Settings, DollarSign, CreditCard, Phone, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('commission');

  const [form, setForm] = useState({
    globalCommissionRate: 0,
    paymentGatewayFeeRate: 3,
    payoutSchedule: 'biweekly',
    minimumPayoutAmount: 500,
    minimumProductPrice: 200,
    maxFeaturedProducts: 10,
    supportEmail: '',
    supportPhone: '',
    instagramUrl: '',
    facebookUrl: ''
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await API.get('/admin/settings');
      setSettings(data);
      setForm(f => ({ ...f, ...data }));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await API.put('/admin/settings', form);
      toast.success('Settings saved');
      loadSettings();
    } catch (err) { toast.error('Failed to save'); }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const tabs = [
    { key: 'commission', label: 'Commission', icon: DollarSign },
    { key: 'payout', label: 'Payouts', icon: CreditCard },
    { key: 'contact', label: 'Contact', icon: Phone },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Platform Settings</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-amber-500/10 text-amber-400' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'commission' && (
        <div className="space-y-6">
          <div className="bg-card border border-edge/50 rounded-xl p-6">
            <h3 className="font-semibold text-theme-primary mb-4">Global Commission Rate</h3>
            <div className="flex items-center gap-4 mb-4">
              <input type="range" min={0} max={20} step={0.5} value={form.globalCommissionRate} onChange={e => setForm(f => ({ ...f, globalCommissionRate: +e.target.value }))} className="flex-1" />
              <span className="text-2xl font-bold text-amber-400 w-16 text-right">{form.globalCommissionRate}%</span>
            </div>
            <p className="text-xs text-theme-dim">Applies to all sellers unless individually overridden. Changes affect new orders only.</p>
          </div>

          <div className="bg-card border border-edge/50 rounded-xl p-6">
            <h3 className="font-semibold text-theme-primary mb-4">Payment Gateway Fee</h3>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-2xl font-bold text-theme-primary">{form.paymentGatewayFeeRate}%</span>
              <span className="text-sm text-theme-muted">(Cashfree standard rate)</span>
            </div>
            <p className="text-xs text-theme-dim">This is deducted from seller earnings. Set by payment provider.</p>
            <input type="number" value={form.paymentGatewayFeeRate} onChange={e => setForm(f => ({ ...f, paymentGatewayFeeRate: +e.target.value }))} min={0} max={10} step={0.1} className="mt-3 w-32 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary" />
          </div>

          <div className="bg-card border border-edge/50 rounded-xl p-6">
            <h3 className="font-semibold text-theme-primary mb-2">Minimum Product Price</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-theme-muted">Rs.</span>
              <input type="number" value={form.minimumProductPrice} onChange={e => setForm(f => ({ ...f, minimumProductPrice: +e.target.value }))} className="w-32 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary" />
            </div>
          </div>
        </div>
      )}

      {tab === 'payout' && (
        <div className="space-y-6">
          <div className="bg-card border border-edge/50 rounded-xl p-6">
            <h3 className="font-semibold text-theme-primary mb-4">Payout Schedule</h3>
            <select value={form.payoutSchedule} onChange={e => setForm(f => ({ ...f, payoutSchedule: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="bg-card border border-edge/50 rounded-xl p-6">
            <h3 className="font-semibold text-theme-primary mb-2">Minimum Payout Amount</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-theme-muted">Rs.</span>
              <input type="number" value={form.minimumPayoutAmount} onChange={e => setForm(f => ({ ...f, minimumPayoutAmount: +e.target.value }))} className="w-32 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary" />
            </div>
          </div>
        </div>
      )}

      {tab === 'contact' && (
        <div className="bg-card border border-edge/50 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Support Email</label>
            <input type="email" value={form.supportEmail} onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Support Phone</label>
            <input type="tel" value={form.supportPhone} onChange={e => setForm(f => ({ ...f, supportPhone: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Instagram URL</label>
            <input type="url" value={form.instagramUrl} onChange={e => setForm(f => ({ ...f, instagramUrl: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Facebook URL</label>
            <input type="url" value={form.facebookUrl} onChange={e => setForm(f => ({ ...f, facebookUrl: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
        </div>
      )}

      <div className="mt-6">
        <button onClick={saveSettings} disabled={saving} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
