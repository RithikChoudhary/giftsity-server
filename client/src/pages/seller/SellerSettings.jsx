import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Store, CreditCard, MapPin, Loader, AlertTriangle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';

export default function SellerSettings() {
  const { user, login } = useAuth();
  const [tab, setTab] = useState('store');
  const [loading, setLoading] = useState(false);
  const [suspendMsg, setSuspendMsg] = useState('');

  const [storeForm, setStoreForm] = useState({ businessName: '', businessType: 'individual', gstNumber: '', instagramUsername: '' });
  const [bankForm, setBankForm] = useState({ accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' });
  const [addressForm, setAddressForm] = useState({ street: '', city: '', state: '', pincode: '' });
  const [pickupForm, setPickupForm] = useState({ street: '', city: '', state: '', pincode: '', phone: '' });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await API.get('/seller/settings');
        const sp = data.sellerProfile || data;
        setStoreForm({ businessName: sp.businessName || '', businessType: sp.businessType || 'individual', gstNumber: sp.gstNumber || '', instagramUsername: sp.instagramUsername || '' });
        setBankForm({ accountHolderName: sp.bankDetails?.accountHolderName || '', accountNumber: sp.bankDetails?.accountNumber || '', ifscCode: sp.bankDetails?.ifscCode || '', bankName: sp.bankDetails?.bankName || '' });
        setAddressForm({ street: sp.businessAddress?.street || '', city: sp.businessAddress?.city || '', state: sp.businessAddress?.state || '', pincode: sp.businessAddress?.pincode || '' });
        setPickupForm({ street: sp.pickupAddress?.street || '', city: sp.pickupAddress?.city || '', state: sp.pickupAddress?.state || '', pincode: sp.pickupAddress?.pincode || '', phone: sp.pickupAddress?.phone || '' });
      } catch {
        // Fallback to auth context
        const sp = user?.sellerProfile || {};
        setStoreForm({ businessName: sp.businessName || '', businessType: sp.businessType || 'individual', gstNumber: sp.gstNumber || '', instagramUsername: sp.instagramUsername || '' });
        setBankForm({ accountHolderName: sp.bankDetails?.accountHolderName || '', accountNumber: sp.bankDetails?.accountNumber || '', ifscCode: sp.bankDetails?.ifscCode || '', bankName: sp.bankDetails?.bankName || '' });
        setAddressForm({ street: sp.businessAddress?.street || '', city: sp.businessAddress?.city || '', state: sp.businessAddress?.state || '', pincode: sp.businessAddress?.pincode || '' });
        setPickupForm({ street: sp.pickupAddress?.street || '', city: sp.pickupAddress?.city || '', state: sp.pickupAddress?.state || '', pincode: sp.pickupAddress?.pincode || '', phone: sp.pickupAddress?.phone || '' });
      }
    };
    loadSettings();
  }, []);

  const saveStore = async () => {
    setLoading(true);
    try {
      const { data } = await API.put('/seller/settings', { businessName: storeForm.businessName, businessType: storeForm.businessType, gstNumber: storeForm.gstNumber, instagramUsername: storeForm.instagramUsername });
      login(data.token, data.user);
      toast.success('Store settings saved');
    } catch (err) { toast.error('Failed to save'); }
    setLoading(false);
  };

  const saveBank = async () => {
    setLoading(true);
    try {
      const { data } = await API.put('/seller/settings', { bankDetails: bankForm });
      login(data.token, data.user);
      toast.success('Bank details saved');
    } catch (err) { toast.error('Failed to save'); }
    setLoading(false);
  };

  const saveAddress = async () => {
    setLoading(true);
    try {
      const { data } = await API.put('/seller/settings', { businessAddress: addressForm, pickupAddress: pickupForm });
      login(data.token, data.user);
      toast.success('Address saved');
    } catch (err) { toast.error('Failed to save'); }
    setLoading(false);
  };

  const requestReactivation = async () => {
    if (!suspendMsg) return toast.error('Please provide a reason');
    setLoading(true);
    try {
      await API.post('/seller/request-unsuspend', { reason: suspendMsg });
      toast.success('Reactivation request sent to admin');
      setSuspendMsg('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  const isSuspended = user?.status === 'suspended';

  const tabs = [
    { key: 'store', label: 'Store', icon: Store },
    { key: 'bank', label: 'Bank Details', icon: CreditCard },
    { key: 'address', label: 'Addresses', icon: MapPin },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Settings</h1>

      {/* Suspension banner */}
      {isSuspended && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Account Suspended</p>
              <p className="text-sm text-theme-muted mt-1">Your store and products are hidden from the platform. Submit a reactivation request below.</p>
            </div>
          </div>
          <textarea value={suspendMsg} onChange={e => setSuspendMsg(e.target.value)} rows={3} placeholder="Explain why your account should be reactivated..." className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50 resize-none mb-3" />
          <button onClick={requestReactivation} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Request Reactivation</>}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-amber-500/10 text-amber-400' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Store settings */}
      {tab === 'store' && (
        <div className="bg-card border border-edge/50 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Business Name</label>
            <input type="text" value={storeForm.businessName} onChange={e => setStoreForm(f => ({ ...f, businessName: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Business Type</label>
            <select value={storeForm.businessType} onChange={e => setStoreForm(f => ({ ...f, businessType: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50">
              <option value="individual">Individual</option>
              <option value="proprietorship">Proprietorship</option>
              <option value="partnership">Partnership</option>
              <option value="pvt_ltd">Pvt Ltd</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Instagram Username</label>
            <input type="text" value={storeForm.instagramUsername} onChange={e => setStoreForm(f => ({ ...f, instagramUsername: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">GST Number</label>
            <input type="text" value={storeForm.gstNumber} onChange={e => setStoreForm(f => ({ ...f, gstNumber: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={saveStore} disabled={loading} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm transition-colors">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Bank settings */}
      {tab === 'bank' && (
        <div className="bg-card border border-edge/50 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Account Holder Name</label>
            <input type="text" value={bankForm.accountHolderName} onChange={e => setBankForm(f => ({ ...f, accountHolderName: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Account Number</label>
            <input type="text" value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-theme-muted font-medium mb-1 block">IFSC Code</label>
              <input type="text" value={bankForm.ifscCode} onChange={e => setBankForm(f => ({ ...f, ifscCode: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="text-xs text-theme-muted font-medium mb-1 block">Bank Name</label>
              <input type="text" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <button onClick={saveBank} disabled={loading} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm transition-colors">
            {loading ? 'Saving...' : 'Save Bank Details'}
          </button>
        </div>
      )}

      {/* Address settings */}
      {tab === 'address' && (
        <div className="space-y-6">
          <div className="bg-card border border-edge/50 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-theme-primary">Business Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={addressForm.street} onChange={e => setAddressForm(f => ({ ...f, street: e.target.value }))} placeholder="Street" className="col-span-2 px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addressForm.city} onChange={e => setAddressForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addressForm.state} onChange={e => setAddressForm(f => ({ ...f, state: e.target.value }))} placeholder="State" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addressForm.pincode} onChange={e => setAddressForm(f => ({ ...f, pincode: e.target.value }))} placeholder="Pincode" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="bg-card border border-edge/50 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-theme-primary">Pickup Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={pickupForm.street} onChange={e => setPickupForm(f => ({ ...f, street: e.target.value }))} placeholder="Street" className="col-span-2 px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={pickupForm.city} onChange={e => setPickupForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={pickupForm.state} onChange={e => setPickupForm(f => ({ ...f, state: e.target.value }))} placeholder="State" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={pickupForm.pincode} onChange={e => setPickupForm(f => ({ ...f, pincode: e.target.value }))} placeholder="Pincode" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="tel" value={pickupForm.phone} onChange={e => setPickupForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <button onClick={saveAddress} disabled={loading} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm transition-colors">
            {loading ? 'Saving...' : 'Save Addresses'}
          </button>
        </div>
      )}
    </div>
  );
}
