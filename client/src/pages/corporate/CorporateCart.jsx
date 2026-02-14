import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCorporateAuth } from '../../context/CorporateAuthContext';
import { corporateAPI } from '../../api';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function CorporateCart() {
  const { user } = useCorporateAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('giftsity_corporate_cart') || '[]'); } catch { return []; }
  });
  const [shippingAddress, setShippingAddress] = useState(
    user?.shippingAddresses?.find(a => a.isDefault) || user?.shippingAddresses?.[0] || { name: '', street: '', city: '', state: '', pincode: '', phone: '' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('giftsity_corporate_cart', JSON.stringify(cart));
  }, [cart]);

  const updateQty = (i, delta) => {
    const updated = [...cart];
    const newQty = updated[i].quantity + delta;
    if (newQty < updated[i].minOrderQty || newQty > updated[i].maxOrderQty) return;
    updated[i].quantity = newQty;
    setCart(updated);
  };

  const setQty = (i, val) => {
    const updated = [...cart];
    const num = parseInt(val) || updated[i].minOrderQty;
    updated[i].quantity = Math.max(updated[i].minOrderQty, Math.min(updated[i].maxOrderQty, num));
    setCart(updated);
  };

  const removeItem = (i) => setCart(cart.filter((_, idx) => idx !== i));

  const subtotal = cart.reduce((s, item) => s + item.unitPrice * item.quantity, 0);

  const handleOrder = async () => {
    if (!shippingAddress.name || !shippingAddress.street || !shippingAddress.city || !shippingAddress.pincode) {
      setError('Please fill in all shipping address fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await corporateAPI.createOrder({
        items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
        shippingAddress
      });

      // Cashfree redirect — cart is NOT cleared here; it will be cleared after payment verification
      if (res.data.cashfreeOrder?.paymentSessionId) {
        const cashfree = await window.Cashfree?.({ mode: res.data.env === 'production' ? 'production' : 'sandbox' });
        if (cashfree) {
          cashfree.checkout({ paymentSessionId: res.data.cashfreeOrder.paymentSessionId, redirectTarget: '_self' });
          return;
        }
      }
      // No payment gateway fallback
      localStorage.removeItem('giftsity_corporate_cart');
      navigate('/corporate/orders');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="w-16 h-16 text-theme-dim mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Cart is empty</h2>
        <p className="text-theme-muted mb-6">Browse our corporate catalog to add products</p>
        <Link to="/corporate/catalog" className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Browse Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bulk Order Cart</h1>
        <Link to="/corporate/catalog" className="text-sm text-amber-400 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Cart Items */}
      <div className="bg-card border border-edge/50 rounded-xl divide-y divide-edge/30">
        {cart.map((item, i) => (
          <div key={item.productId} className="flex items-center gap-4 p-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-inset shrink-0">
              {item.image ? <img src={item.image} alt={item.title} className="w-full h-full object-cover" /> : <ShoppingBag className="w-6 h-6 text-theme-dim m-auto mt-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate">{item.title}</h3>
              <p className="text-sm text-amber-400 font-medium">Rs. {item.unitPrice?.toLocaleString()} each</p>
              <p className="text-xs text-theme-dim">Min: {item.minOrderQty} | Max: {item.maxOrderQty}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => updateQty(i, -10)} className="w-7 h-7 rounded bg-inset border border-edge flex items-center justify-center text-theme-muted hover:text-theme-primary">
                <Minus className="w-3 h-3" />
              </button>
              <input type="number" value={item.quantity} onChange={e => setQty(i, e.target.value)}
                className="w-20 text-center py-1 bg-inset border border-edge rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              <button onClick={() => updateQty(i, 10)} className="w-7 h-7 rounded bg-inset border border-edge flex items-center justify-center text-theme-muted hover:text-theme-primary">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <p className="text-sm font-bold w-28 text-right">Rs. {(item.unitPrice * item.quantity)?.toLocaleString()}</p>
            <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Shipping Address */}
      <div className="bg-card border border-edge/50 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Shipping Address</h2>
        {user?.shippingAddresses?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {user.shippingAddresses.map((addr, i) => (
              <button key={i} onClick={() => setShippingAddress(addr)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${JSON.stringify(addr) === JSON.stringify(shippingAddress) ? 'border-amber-400 text-amber-400 bg-amber-500/10' : 'border-edge/50 text-theme-muted hover:text-theme-primary'}`}>
                {addr.label || `Address ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {['name', 'street', 'city', 'state', 'pincode', 'phone'].map(field => (
            <div key={field}>
              <label className="block text-xs text-theme-dim mb-1 capitalize">{field} *</label>
              <input type="text" value={shippingAddress[field] || ''} onChange={e => setShippingAddress({ ...shippingAddress, [field]: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-card border border-edge/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-theme-muted">Subtotal ({cart.length} items, {cart.reduce((s, c) => s + c.quantity, 0)} units)</span>
          <span className="text-xl font-bold">Rs. {subtotal.toLocaleString()}</span>
        </div>
        <button onClick={handleOrder} disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Place Bulk Order & Pay'}
        </button>
      </div>
    </div>
  );
}
