import { useState } from 'react';
import { useCorporateAuth } from '../../context/CorporateAuthContext';
import { corporateAPI } from '../../api';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';

export default function CorporateProfile() {
  const { user, updateUser } = useCorporateAuth();
  const [form, setForm] = useState({
    companyName: user?.companyName || '',
    contactPerson: user?.contactPerson || '',
    phone: user?.phone || '',
    designation: user?.designation || '',
    companySize: user?.companySize || '',
    gstNumber: user?.gstNumber || '',
    billingAddress: user?.billingAddress || { name: '', street: '', city: '', state: '', pincode: '', phone: '' },
    shippingAddresses: user?.shippingAddresses || []
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await corporateAPI.updateProfile(form);
      updateUser(res.data.user);
      setMsg('Profile updated successfully');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const addAddress = () => {
    setForm({
      ...form,
      shippingAddresses: [...form.shippingAddresses, { label: 'Office', name: '', street: '', city: '', state: '', pincode: '', phone: '', isDefault: false }]
    });
  };

  const removeAddress = (i) => {
    setForm({ ...form, shippingAddresses: form.shippingAddresses.filter((_, idx) => idx !== i) });
  };

  const updateAddress = (i, field, value) => {
    const addrs = [...form.shippingAddresses];
    addrs[i] = { ...addrs[i], [field]: value };
    setForm({ ...form, shippingAddresses: addrs });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Company Profile</h1>
      <p className="text-sm text-theme-muted">{user?.email} &middot; Status: <span className={user?.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>{user?.status}</span></p>

      <form onSubmit={handleSave} className="space-y-6">
        {msg && <div className={`p-3 rounded-lg text-sm ${msg.includes('success') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{msg}</div>}

        {/* Company Info */}
        <div className="bg-card border border-edge/50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Company Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-theme-secondary mb-1">Company Name</label>
              <input type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-sm text-theme-secondary mb-1">Contact Person</label>
              <input type="text" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-sm text-theme-secondary mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-sm text-theme-secondary mb-1">Designation</label>
              <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-sm text-theme-secondary mb-1">Company Size</label>
              <select value={form.companySize} onChange={e => setForm({ ...form, companySize: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
                <option value="">Select</option>
                <option value="1-50">1-50</option>
                <option value="51-200">51-200</option>
                <option value="201-1000">201-1000</option>
                <option value="1000+">1000+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-theme-secondary mb-1">GST Number</label>
              <input type="text" value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="bg-card border border-edge/50 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Billing Address</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {['name', 'street', 'city', 'state', 'pincode', 'phone'].map(field => (
              <div key={field}>
                <label className="block text-sm text-theme-secondary mb-1 capitalize">{field}</label>
                <input type="text" value={form.billingAddress[field] || ''} onChange={e => setForm({ ...form, billingAddress: { ...form.billingAddress, [field]: e.target.value } })}
                  className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Addresses */}
        <div className="bg-card border border-edge/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Shipping Addresses</h2>
            <button type="button" onClick={addAddress} className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300">
              <Plus className="w-4 h-4" /> Add Address
            </button>
          </div>
          {form.shippingAddresses.map((addr, i) => (
            <div key={i} className="border border-edge/30 rounded-lg p-4 space-y-3 relative">
              <button type="button" onClick={() => removeAddress(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-theme-dim mb-1">Label</label>
                  <input type="text" value={addr.label} onChange={e => updateAddress(i, 'label', e.target.value)}
                    className="w-full px-2 py-1.5 bg-inset border border-edge rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                </div>
                {['name', 'street', 'city', 'state', 'pincode', 'phone'].map(field => (
                  <div key={field}>
                    <label className="block text-xs text-theme-dim mb-1 capitalize">{field}</label>
                    <input type="text" value={addr[field] || ''} onChange={e => updateAddress(i, field, e.target.value)}
                      className="w-full px-2 py-1.5 bg-inset border border-edge rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {form.shippingAddresses.length === 0 && <p className="text-sm text-theme-dim">No shipping addresses added yet.</p>}
        </div>

        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}
