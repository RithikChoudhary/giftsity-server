import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, MapPin, Package, Edit3, Plus, Trash2, Check, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';

export default function CustomerProfile() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState(null);
  const [addrForm, setAddrForm] = useState({ name: '', phone: '', street: '', city: '', state: '', pincode: '', isDefault: false });

  useEffect(() => {
    if (!user) return navigate('/auth?redirect=/profile');
    setName(user.name || '');
    setPhone(user.phone || '');
    setAddresses(user.shippingAddresses || []);
  }, [user]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { data } = await API.put('/auth/profile', { name, phone });
      login(null, data.user || data);
      toast.success('Profile updated');
      setEditing(false);
    } catch (err) { toast.error('Failed to update'); }
    setLoading(false);
  };

  const openAddressForm = (addr = null) => {
    if (addr) {
      setEditingAddr(addr._id);
      setAddrForm({ name: addr.name || '', phone: addr.phone || '', street: addr.street || '', city: addr.city || '', state: addr.state || '', pincode: addr.pincode || '', isDefault: addr.isDefault || false });
    } else {
      setEditingAddr(null);
      setAddrForm({ name: '', phone: '', street: '', city: '', state: '', pincode: '', isDefault: false });
    }
    setShowAddressForm(true);
  };

  const saveAddresses = async (newAddresses) => {
    try {
      const { data } = await API.put('/auth/addresses', { addresses: newAddresses });
      const updated = data.user?.shippingAddresses || data.addresses || newAddresses;
      login(null, data.user || data);
      setAddresses(updated);
      return updated;
    } catch (err) { toast.error('Failed to save'); return null; }
  };

  const saveAddress = async () => {
    if (!addrForm.name || !addrForm.street || !addrForm.city || !addrForm.state || !addrForm.pincode) return toast.error('Fill all fields');
    setLoading(true);
    let newAddresses;
    if (editingAddr) {
      newAddresses = addresses.map(a => a._id === editingAddr ? { ...a, ...addrForm } : a);
    } else {
      newAddresses = [...addresses, { ...addrForm }];
    }
    const result = await saveAddresses(newAddresses);
    if (result) { setShowAddressForm(false); toast.success(editingAddr ? 'Address updated' : 'Address added'); }
    setLoading(false);
  };

  const deleteAddress = async (addrId) => {
    if (!confirm('Remove this address?')) return;
    const newAddresses = addresses.filter(a => a._id !== addrId);
    const result = await saveAddresses(newAddresses);
    if (result) toast.success('Address removed');
  };

  const setDefault = async (addrId) => {
    const newAddresses = addresses.map(a => ({ ...a, isDefault: a._id === addrId }));
    const result = await saveAddresses(newAddresses);
    if (result) toast.success('Default address set');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-theme-primary mb-6">My Profile</h1>

      {/* Profile card */}
      <div className="bg-card border border-edge/50 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center">
              <User className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              {editing ? (
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="px-3 py-1 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              ) : (
                <h2 className="text-lg font-semibold text-theme-primary">{user?.name}</h2>
              )}
              <p className="text-sm text-theme-muted">{user?.email}</p>
            </div>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} disabled={loading} className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => { setEditing(false); setName(user.name); setPhone(user.phone || ''); }} className="p-2 bg-inset text-theme-muted rounded-lg"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="p-2 bg-inset text-theme-muted rounded-lg hover:text-theme-primary"><Edit3 className="w-4 h-4" /></button>
          )}
        </div>
        {editing && (
          <div className="mt-3">
            <label className="text-xs text-theme-muted font-medium mb-1 block">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
        )}
        {!editing && user?.phone && <p className="text-sm text-theme-secondary mt-1 ml-17">Phone: {user.phone}</p>}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link to="/orders" className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-3 hover:border-edge-strong transition-colors">
          <Package className="w-5 h-5 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-theme-primary">My Orders</p>
            <p className="text-xs text-theme-muted">Track your purchases</p>
          </div>
        </Link>
        <Link to="/shop" className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-3 hover:border-edge-strong transition-colors">
          <MapPin className="w-5 h-5 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-theme-primary">Shop</p>
            <p className="text-xs text-theme-muted">Browse gifts</p>
          </div>
        </Link>
      </div>

      {/* Addresses */}
      <div className="bg-card border border-edge/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-theme-primary">Saved Addresses</h3>
          <button onClick={() => openAddressForm()} className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"><Plus className="w-4 h-4" /> Add</button>
        </div>

        {showAddressForm && (
          <div className="bg-inset/50 border border-edge rounded-xl p-4 mb-4 animate-fade-in">
            <h4 className="text-sm font-medium text-theme-primary mb-3">{editingAddr ? 'Edit Address' : 'New Address'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={addrForm.name} onChange={e => setAddrForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="px-3 py-2 bg-card border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="tel" value={addrForm.phone} onChange={e => setAddrForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="px-3 py-2 bg-card border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addrForm.street} onChange={e => setAddrForm(f => ({ ...f, street: e.target.value }))} placeholder="Street" className="col-span-2 px-3 py-2 bg-card border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className="px-3 py-2 bg-card border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addrForm.state} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} placeholder="State" className="px-3 py-2 bg-card border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <input type="text" value={addrForm.pincode} onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value }))} placeholder="Pincode" className="px-3 py-2 bg-card border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
              <label className="flex items-center gap-2 text-sm text-theme-secondary">
                <input type="checkbox" checked={addrForm.isDefault} onChange={e => setAddrForm(f => ({ ...f, isDefault: e.target.checked }))} className="accent-amber-500" /> Default
              </label>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={saveAddress} disabled={loading} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
              <button onClick={() => setShowAddressForm(false)} className="px-4 py-2 bg-inset text-theme-muted rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {addresses.length === 0 && !showAddressForm ? (
          <p className="text-sm text-theme-muted text-center py-4">No saved addresses</p>
        ) : (
          <div className="space-y-3">
            {addresses.map(addr => (
              <div key={addr._id} className="flex items-start justify-between p-3 bg-inset/30 rounded-lg border border-edge/30">
                <div className="text-sm text-theme-secondary">
                  <p className="font-medium text-theme-primary">{addr.name} {addr.isDefault && <span className="text-xs text-amber-400 ml-1">(Default)</span>}</p>
                  <p>{addr.street}, {addr.city}, {addr.state} - {addr.pincode}</p>
                  {addr.phone && <p className="text-xs text-theme-muted mt-0.5">{addr.phone}</p>}
                </div>
                <div className="flex gap-1">
                  {!addr.isDefault && (
                    <button onClick={() => setDefault(addr._id)} className="p-1.5 text-theme-dim hover:text-amber-400" title="Set as default"><Check className="w-3 h-3" /></button>
                  )}
                  <button onClick={() => openAddressForm(addr)} className="p-1.5 text-theme-dim hover:text-theme-primary"><Edit3 className="w-3 h-3" /></button>
                  <button onClick={() => deleteAddress(addr._id)} className="p-1.5 text-theme-dim hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
