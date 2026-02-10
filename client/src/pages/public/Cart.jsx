import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, Trash2, Minus, Plus, ArrowRight, ArrowLeft, CreditCard, MapPin, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';

export default function Cart() {
  const { user } = useAuth();
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState('cart'); // cart | address | payment
  const [address, setAddress] = useState({ name: '', phone: '', street: '', city: '', state: '', pincode: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill default address from user profile
    if (user?.shippingAddresses?.length > 0) {
      const def = user.shippingAddresses.find(a => a.isDefault) || user.shippingAddresses[0];
      if (def) setAddress({ name: def.name || user.name || '', phone: def.phone || user.phone || '', street: def.street || '', city: def.city || '', state: def.state || '', pincode: def.pincode || '' });
    }
  }, [user]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleCheckout = () => {
    if (!user) return navigate('/auth?redirect=/cart');
    setStep('address');
  };

  const handlePlaceOrder = async () => {
    if (!address.name || !address.phone || !address.street || !address.city || !address.state || !address.pincode) return toast.error('Fill all address fields');
    setLoading(true);
    try {
      // Create order for each seller group
      const sellerGroups = {};
      items.forEach(i => {
        const sid = i.sellerId;
        if (!sellerGroups[sid]) sellerGroups[sid] = [];
        sellerGroups[sid].push(i);
      });

      for (const sellerId of Object.keys(sellerGroups)) {
        for (const item of sellerGroups[sellerId]) {
          const { data } = await API.post('/api/orders', {
            productId: item.productId,
            quantity: item.quantity,
            shippingAddress: address
          });

          // If payment session returned, initiate Cashfree
          if (data.paymentSessionId && window.Cashfree) {
            const cashfree = window.Cashfree({ mode: 'sandbox' });
            await cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
          }
        }
      }

      clearCart();
      toast.success('Order placed successfully!');
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order failed');
    }
    setLoading(false);
  };

  if (items.length === 0 && step === 'cart') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 text-theme-dim mx-auto mb-4" />
        <h2 className="text-xl font-bold text-theme-primary mb-2">Your cart is empty</h2>
        <p className="text-theme-muted mb-6">Discover unique gifts from our sellers.</p>
        <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold">
          Start Shopping <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Steps */}
      <div className="flex items-center gap-3 mb-8">
        {['Cart', 'Address', 'Payment'].map((s, i) => {
          const stepIdx = step === 'cart' ? 0 : step === 'address' ? 1 : 2;
          return (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full ${i <= stepIdx ? 'bg-amber-500' : 'bg-inset'}`} />
              <p className={`text-xs mt-1 ${i <= stepIdx ? 'text-amber-400' : 'text-theme-dim'}`}>{s}</p>
            </div>
          );
        })}
      </div>

      {step === 'cart' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3">
            <h1 className="text-xl font-bold text-theme-primary mb-4">Shopping Cart ({items.length})</h1>
            {items.map(item => (
              <div key={item.productId} className="bg-card border border-edge/50 rounded-xl p-4 flex gap-4">
                <div className="w-20 h-20 bg-inset rounded-lg overflow-hidden shrink-0">
                  {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-8 h-8 text-theme-dim m-auto mt-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${item.slug}`} className="font-medium text-sm text-theme-primary hover:text-amber-400 truncate block">{item.title}</Link>
                  <p className="text-xs text-theme-muted mt-0.5">{item.sellerName}</p>
                  <p className="text-sm font-bold text-theme-primary mt-1">Rs. {item.price?.toLocaleString('en-IN')}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => removeItem(item.productId)} className="text-theme-dim hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-inset rounded-md"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-7 h-7 flex items-center justify-center bg-inset rounded-md disabled:opacity-40"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-card border border-edge/50 rounded-xl p-5 h-fit sticky top-24">
            <h3 className="font-semibold text-theme-primary mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-theme-secondary"><span>Subtotal</span><span>Rs. {total.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-theme-secondary"><span>Shipping</span><span className="text-green-400">Free</span></div>
              <div className="border-t border-edge/50 pt-2 flex justify-between font-bold text-theme-primary"><span>Total</span><span>Rs. {total.toLocaleString('en-IN')}</span></div>
            </div>
            <button onClick={handleCheckout} className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              Checkout <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'address' && (
        <div className="max-w-lg mx-auto">
          <button onClick={() => setStep('cart')} className="flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-4"><ArrowLeft className="w-4 h-4" /> Back to Cart</button>
          <h2 className="text-xl font-bold text-theme-primary mb-6 flex items-center gap-2"><MapPin className="w-5 h-5 text-amber-400" /> Shipping Address</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Name *</label>
                <input type="text" value={address.name} onChange={e => setAddress(a => ({ ...a, name: e.target.value }))} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Phone *</label>
                <input type="tel" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
            </div>
            <div>
              <label className="text-xs text-theme-muted font-medium mb-1 block">Street Address *</label>
              <input type="text" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">City *</label>
                <input type="text" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">State *</label>
                <input type="text" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Pincode *</label>
                <input type="text" value={address.pincode} onChange={e => setAddress(a => ({ ...a, pincode: e.target.value }))} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
            </div>
            <button onClick={() => setStep('payment')} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              Continue to Payment <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="max-w-lg mx-auto">
          <button onClick={() => setStep('address')} className="flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-4"><ArrowLeft className="w-4 h-4" /> Back to Address</button>
          <h2 className="text-xl font-bold text-theme-primary mb-6 flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-400" /> Payment</h2>
          <div className="bg-card border border-edge/50 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-theme-primary mb-3">Order Summary</h3>
            {items.map(i => (
              <div key={i.productId} className="flex justify-between text-sm text-theme-secondary py-1">
                <span>{i.title} x {i.quantity}</span>
                <span>Rs. {(i.price * i.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="border-t border-edge/50 mt-3 pt-3 flex justify-between font-bold text-theme-primary">
              <span>Total</span><span>Rs. {total.toLocaleString('en-IN')}</span>
            </div>
            <div className="mt-3 text-xs text-theme-dim">
              <p>Delivering to: {address.name}, {address.city}, {address.state} - {address.pincode}</p>
            </div>
          </div>
          <button onClick={handlePlaceOrder} disabled={loading} className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Pay Rs. {total.toLocaleString('en-IN')}</>}
          </button>
        </div>
      )}
    </div>
  );
}
