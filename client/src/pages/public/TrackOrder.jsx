import { useState } from 'react';
import { Search, Package, CheckCircle2, Truck, MapPin, XCircle, Clock, Loader2 } from 'lucide-react';
import API from '../../api';

const statusConfig = {
  placed: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  paid: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  confirmed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
  shipped: { icon: Truck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  delivered: { icon: MapPin, color: 'text-green-400', bg: 'bg-green-500/10' },
  cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await API.get(`/orders/track/${orderNumber.trim()}`);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to track order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const overallStatus = statusConfig[result?.status] || statusConfig.placed;

  return (
    <div className="min-h-screen bg-surface text-theme-primary py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Track Your Order</h1>
          <p className="text-theme-dim">Enter your order number to check the current status</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleTrack} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-dim" />
            <input
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              placeholder="e.g. GFT-20260206-A1B2"
              className="w-full pl-12 pr-4 py-3.5 bg-card border border-edge/30 rounded-xl text-sm focus:outline-none focus:border-amber-400/50 transition-colors"
            />
          </div>
          <button type="submit" disabled={loading || !orderNumber.trim()}
            className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium text-sm hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-card border border-edge/30 rounded-2xl overflow-hidden">
            {/* Order header */}
            <div className="p-6 border-b border-edge/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-theme-dim">Order Number</p>
                  <p className="text-lg font-bold font-mono">{result.orderNumber}</p>
                </div>
                <span className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${overallStatus.color} ${overallStatus.bg}`}>
                  <overallStatus.icon className="w-4 h-4" />
                  {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                </span>
              </div>
              {result.sellerName && (
                <p className="text-xs text-theme-dim mt-2">Seller: {result.sellerName}</p>
              )}
            </div>

            {/* Timeline */}
            <div className="p-6 border-b border-edge/30">
              <h3 className="text-sm font-semibold mb-4">Order Timeline</h3>
              <div className="space-y-0">
                {result.timeline.map((step, i) => {
                  const conf = statusConfig[step.status] || statusConfig.placed;
                  const Icon = conf.icon;
                  const isLast = i === result.timeline.length - 1;
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${conf.bg}`}>
                          <Icon className={`w-4 h-4 ${conf.color}`} />
                        </div>
                        {!isLast && <div className="w-px h-8 bg-edge/30" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{step.label}</p>
                        {step.date && (
                          <p className="text-xs text-theme-dim">
                            {new Date(step.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracking info */}
            {result.tracking && (
              <div className="p-6 border-b border-edge/30">
                <h3 className="text-sm font-semibold mb-2">Shipping Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {result.tracking.courierName && (
                    <div>
                      <p className="text-xs text-theme-dim">Courier</p>
                      <p className="text-sm font-medium">{result.tracking.courierName}</p>
                    </div>
                  )}
                  {result.tracking.trackingNumber && (
                    <div>
                      <p className="text-xs text-theme-dim">Tracking Number</p>
                      <p className="text-sm font-medium font-mono">{result.tracking.trackingNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            {result.items && result.items.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-semibold mb-3">Items</h3>
                <div className="space-y-3">
                  {result.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {item.image && <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-theme-dim">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium">Rs. {item.price?.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
