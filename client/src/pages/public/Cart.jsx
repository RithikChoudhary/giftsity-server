import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, Trash2, Minus, Plus, ArrowRight, ArrowLeft, CreditCard, MapPin, Loader, CheckCircle, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';
import ProfileCompleteModal from '../../components/ProfileCompleteModal';

export default function Cart() {
  const { user } = useAuth();
  const { items, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState('cart'); // cart | address | payment
  const [address, setAddress] = useState({ name: '', phone: '', street: '', city: '', state: '', pincode: '' });
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressIdx, setSelectedAddressIdx] = useState(-1); // -1 = new address
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [shippingEstimates, setShippingEstimates] = useState([]); // [{ sellerId, shippingCost, shippingPaidBy, courierName, estimatedDays }]
  const [estimatingShipping, setEstimatingShipping] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    // Pre-fill default address from user profile
    if (user?.shippingAddresses?.length > 0) {
      setSavedAddresses(user.shippingAddresses);
      const defIdx = user.shippingAddresses.findIndex(a => a.isDefault);
      const idx = defIdx >= 0 ? defIdx : 0;
      setSelectedAddressIdx(idx);
      const def = user.shippingAddresses[idx];
      if (def) setAddress({ name: def.name || user.name || '', phone: def.phone || user.phone || '', street: def.street || '', city: def.city || '', state: def.state || '', pincode: def.pincode || '' });
    }
  }, [user]);

  const selectAddress = (idx) => {
    setSelectedAddressIdx(idx);
    if (idx >= 0 && savedAddresses[idx]) {
      const a = savedAddresses[idx];
      setAddress({ name: a.name || user?.name || '', phone: a.phone || user?.phone || '', street: a.street || '', city: a.city || '', state: a.state || '', pincode: a.pincode || '' });
    } else {
      setAddress({ name: '', phone: '', street: '', city: '', state: '', pincode: '' });
    }
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  // Customer-paid shipping = sum of shipping costs where customer pays
  const customerShipping = shippingEstimates
    .filter(e => e.shippingPaidBy === 'customer' && e.shippingCost > 0)
    .reduce((s, e) => s + e.shippingCost, 0);
  const total = Math.max(0, subtotal + customerShipping - couponDiscount);

  const fetchShippingEstimate = async (pincode) => {
    if (!pincode || pincode.length < 6 || !items.length) return;
    setEstimatingShipping(true);
    try {
      const cartItems = items.map(i => ({ productId: i.productId, quantity: i.quantity }));
      const { data } = await API.post('/orders/shipping-estimate', { items: cartItems, deliveryPincode: pincode });
      setShippingEstimates(data.estimates || []);
    } catch (err) {
      console.error('Shipping estimate failed:', err);
      setShippingEstimates([]);
    }
    setEstimatingShipping(false);
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const { data } = await API.post('/coupons/apply', { code: couponCode, orderTotal: subtotal });
      setCouponDiscount(data.discount);
      setCouponApplied(data.code);
      toast.success(`Coupon applied! Rs. ${data.discount} off`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon');
      setCouponDiscount(0);
      setCouponApplied('');
    }
    setApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setCouponCode('');
    setCouponDiscount(0);
    setCouponApplied('');
  };

  const handleCheckout = () => {
    if (!user) return navigate('/auth?redirect=/cart');
    if (!user.name || !user.phone) { setShowProfileModal(true); return; }
    setStep('address');
  };

  const handlePlaceOrder = async () => {
    if (!address.name || !address.phone || !address.street || !address.city || !address.state || !address.pincode) return toast.error('Fill all address fields');
    setLoading(true);
    try {
      // Cancel any prior abandoned pending orders (releases reserved stock)
      try { await API.post('/orders/cancel-pending'); } catch (e) { /* non-critical */ }

      const orderItems = items.map(i => ({ productId: i.productId, quantity: i.quantity, customizations: i.customizations || [] }));
      // Build shipping estimates map: sellerId -> { shippingCost, shippingPaidBy }
      const shippingData = {};
      shippingEstimates.forEach(e => {
        shippingData[e.sellerId] = { shippingCost: e.shippingCost || 0, actualShippingCost: e.actualShippingCost || e.shippingCost || 0, shippingPaidBy: e.shippingPaidBy || 'seller' };
      });
      const { data } = await API.post('/orders', { items: orderItems, shippingAddress: address, shippingEstimates: shippingData, couponCode: couponApplied || undefined });

      // Cart is NOT cleared here — it will be cleared after payment is verified
      // in CustomerOrders.jsx. If payment is abandoned, the cart stays intact.

      // If Cashfree payment session returned, redirect to payment
      const paymentSessionId = data.cashfreeOrder?.paymentSessionId || data.paymentSessionId;
      if (paymentSessionId && window.Cashfree) {
        const env = data.env || 'sandbox';
        const cashfree = window.Cashfree({ mode: env });
        await cashfree.checkout({ paymentSessionId, redirectTarget: '_self' });
        // User will be redirected to Cashfree, then back to /orders?cf_id=...
        return;
      }

      // If no payment gateway (shouldn't happen), just go to orders
      toast.success('Order placed!');
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
              <div key={item.cartKey || item.productId} className="bg-card border border-edge/50 rounded-xl p-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-inset rounded-lg overflow-hidden shrink-0">
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-8 h-8 text-theme-dim m-auto mt-4 sm:mt-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${item.slug}`} className="font-medium text-sm text-theme-primary hover:text-amber-400 line-clamp-2 block">{item.title}</Link>
                        <p className="text-xs text-theme-muted mt-0.5">{item.sellerName}</p>
                      </div>
                      <button onClick={() => removeItem(item.cartKey || item.productId)} className="text-theme-dim hover:text-red-400 shrink-0 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {item.customizations?.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {item.customizations.map((c, ci) => (
                          <p key={ci} className="text-[11px] text-amber-400/80">
                            {c.label}: {c.value || `${c.imageUrls?.length || 0} image(s)`}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-theme-primary">Rs. {item.price?.toLocaleString('en-IN')}</p>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQuantity(item.cartKey || item.productId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-inset rounded-md"><Minus className="w-3 h-3" /></button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartKey || item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-7 h-7 flex items-center justify-center bg-inset rounded-md disabled:opacity-40"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-card border border-edge/50 rounded-xl p-4 sm:p-5 h-fit sticky top-24">
            <h3 className="font-semibold text-theme-primary mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-theme-secondary"><span>Subtotal</span><span className="shrink-0 ml-2">Rs. {subtotal.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-theme-secondary"><span>Shipping</span><span className={`shrink-0 ml-2 ${customerShipping > 0 ? '' : 'text-theme-dim'}`}>{customerShipping > 0 ? `Rs. ${customerShipping.toLocaleString('en-IN')}` : 'Calculated at checkout'}</span></div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-400"><span className="min-w-0 truncate">Discount ({couponApplied})</span><span className="shrink-0 ml-2">-Rs. {couponDiscount.toLocaleString('en-IN')}</span></div>
              )}
              <div className="border-t border-edge/50 pt-2 flex justify-between font-bold text-theme-primary"><span>Total</span><span className="shrink-0 ml-2">Rs. {total.toLocaleString('en-IN')}</span></div>
            </div>
            {/* Coupon */}
            <div className="mt-4">
              {couponApplied ? (
                <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <span className="text-xs text-green-400 font-medium">{couponApplied} applied</span>
                  <button onClick={removeCoupon} className="text-xs text-red-400 hover:text-red-300 shrink-0 ml-2">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="flex-1 min-w-0 px-3 py-2 bg-inset border border-edge rounded-lg text-xs text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
                  <button onClick={applyCoupon} disabled={applyingCoupon || !couponCode} className="px-3 py-2 bg-inset border border-edge hover:border-amber-500/50 rounded-lg text-xs text-theme-muted hover:text-amber-400 transition-colors disabled:opacity-50 shrink-0">
                    {applyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
              )}
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

          {/* Saved addresses */}
          {savedAddresses.length > 0 && (
            <div className="space-y-2 mb-6">
              <p className="text-xs font-medium text-theme-muted mb-2">Saved Addresses</p>
              {savedAddresses.map((a, i) => (
                <button key={i} onClick={() => selectAddress(i)} className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedAddressIdx === i ? 'border-amber-500 bg-amber-500/5' : 'border-edge/50 bg-card hover:border-edge-strong'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-theme-primary">{a.name || user?.name}</p>
                      <p className="text-xs text-theme-muted">{a.street}, {a.city}, {a.state} - {a.pincode}</p>
                      <p className="text-xs text-theme-dim">{a.phone}</p>
                    </div>
                    {selectedAddressIdx === i && <CheckCircle className="w-5 h-5 text-amber-500 shrink-0" />}
                  </div>
                  {a.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded mt-1 inline-block">Default</span>}
                </button>
              ))}
              <button onClick={() => selectAddress(-1)} className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedAddressIdx === -1 ? 'border-amber-500 bg-amber-500/5' : 'border-edge/50 bg-card hover:border-edge-strong'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-theme-muted">+ Use a new address</span>
                  {selectedAddressIdx === -1 && <CheckCircle className="w-5 h-5 text-amber-500 shrink-0" />}
                </div>
              </button>
            </div>
          )}

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
                <input type="text" value={address.pincode} onChange={e => {
                  const val = e.target.value;
                  setAddress(a => ({ ...a, pincode: val }));
                  // Auto-fetch shipping estimate when pincode is 6 digits
                  if (val.length === 6 && /^\d{6}$/.test(val)) fetchShippingEstimate(val);
                }} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
            </div>

            {/* Shipping estimate preview */}
            {estimatingShipping && (
              <div className="flex items-center gap-2 text-xs text-theme-muted py-2"><Loader className="w-3 h-3 animate-spin" /> Estimating shipping costs...</div>
            )}
            {!estimatingShipping && shippingEstimates.length > 0 && (
              <div className="bg-card border border-edge/50 rounded-xl p-4">
                <p className="text-xs font-medium text-theme-muted mb-2 flex items-center gap-1"><Truck className="w-3 h-3" /> Shipping Estimate</p>
                <div className="space-y-1">
                  {shippingEstimates.map(e => (
                    <div key={e.sellerId} className="flex justify-between text-xs">
                      <span className="text-theme-secondary">{e.courierName || 'Courier'}{e.estimatedDays ? ` · ${e.estimatedDays} days` : ''}</span>
                      <span className={e.shippingPaidBy === 'seller' || !e.shippingCost ? 'text-green-400' : 'text-theme-primary font-medium'}>
                        {e.shippingPaidBy === 'seller' || !e.shippingCost ? 'Free' : `Rs. ${e.shippingCost.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  ))}
                </div>
                {customerShipping > 0 && (
                  <div className="border-t border-edge/50 mt-2 pt-2 flex justify-between text-xs font-medium">
                    <span className="text-theme-muted">Subtotal + Shipping</span>
                    <span className="text-theme-primary">Rs. {total.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}

            <button onClick={async () => {
              if (!address.pincode || address.pincode.length < 6) return toast.error('Enter a valid pincode');
              if (!shippingEstimates.length) await fetchShippingEstimate(address.pincode);
              setStep('payment');
            }} disabled={estimatingShipping} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              {estimatingShipping ? <><Loader className="w-4 h-4 animate-spin" /> Checking shipping...</> : <>Continue to Payment <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {showProfileModal && (
        <ProfileCompleteModal
          onComplete={() => { setShowProfileModal(false); setStep('address'); }}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {step === 'payment' && (
        <div className="max-w-lg mx-auto">
          <button onClick={() => setStep('address')} className="flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-4"><ArrowLeft className="w-4 h-4" /> Back to Address</button>
          <h2 className="text-xl font-bold text-theme-primary mb-6 flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-400" /> Payment</h2>
          <div className="bg-card border border-edge/50 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-theme-primary mb-3">Order Summary</h3>
            {items.map(i => (
              <div key={i.cartKey || i.productId} className="flex justify-between text-sm text-theme-secondary py-1">
                <span className="min-w-0 truncate">{i.title} x {i.quantity}</span>
                <span className="shrink-0 ml-2">Rs. {(i.price * i.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {/* Shipping breakdown */}
            {shippingEstimates.length > 0 && (
              <div className="border-t border-edge/50 mt-2 pt-2 space-y-1">
                {shippingEstimates.map(e => (
                  <div key={e.sellerId} className="flex justify-between text-xs text-theme-muted">
                    <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Shipping{e.courierName ? ` (${e.courierName})` : ''}{e.estimatedDays ? ` · ${e.estimatedDays} days` : ''}</span>
                    <span className={`shrink-0 ml-2 ${e.shippingPaidBy === 'seller' || !e.shippingCost ? 'text-green-400' : 'text-theme-secondary'}`}>
                      {e.shippingPaidBy === 'seller' || !e.shippingCost ? 'Free' : `Rs. ${e.shippingCost.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-400 pt-1">
                <span className="min-w-0 truncate">Discount ({couponApplied})</span>
                <span className="shrink-0 ml-2">-Rs. {couponDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="border-t border-edge/50 mt-3 pt-3 flex justify-between font-bold text-theme-primary">
              <span>Total</span><span>Rs. {total.toLocaleString('en-IN')}</span>
            </div>
            <div className="mt-3 text-xs text-theme-dim">
              <p>Delivering to: {address.name}, {address.city}, {address.state} - {address.pincode}</p>
            </div>
          </div>
          <button onClick={handlePlaceOrder} disabled={loading} className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Processing...</> : <><CreditCard className="w-4 h-4" /> Pay Rs. {total.toLocaleString('en-IN')}</>}
          </button>
        </div>
      )}
    </div>
  );
}
