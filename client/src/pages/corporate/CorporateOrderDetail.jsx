import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { corporateAPI } from '../../api';
import { ArrowLeft, Loader2, Package, XCircle, CheckCircle, Clock, Truck, MapPin, Download } from 'lucide-react';

export default function CorporateOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    corporateAPI.getOrder(id)
      .then(res => setOrder(res.data.order))
      .catch(() => navigate('/corporate/orders'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const res = await corporateAPI.cancelOrder(id, { reason: 'Cancelled by corporate client' });
      setOrder(res.data.order);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>;
  if (!order) return <div className="text-center py-12 text-theme-muted">Order not found</div>;

  const statusColor = {
    pending: 'text-amber-400 bg-amber-500/10',
    confirmed: 'text-blue-400 bg-blue-500/10',
    processing: 'text-blue-400 bg-blue-500/10',
    shipped: 'text-blue-400 bg-blue-500/10',
    delivered: 'text-green-400 bg-green-500/10',
    cancelled: 'text-red-400 bg-red-500/10'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/corporate/orders" className="text-theme-muted hover:text-theme-primary"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-theme-muted">Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColor[order.status] || 'text-theme-muted bg-inset'}`}>{order.status}</span>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${order.paymentStatus === 'paid' ? 'text-green-400 bg-green-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
          Payment: {order.paymentStatus}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {order.paymentStatus === 'paid' && (
            <button onClick={async () => {
              try {
                const { data } = await corporateAPI.getDownloadToken();
                window.open(corporateAPI.getInvoiceUrl(order._id, data.downloadToken), '_blank');
              } catch { alert('Failed to generate download link'); }
            }}
              className="flex items-center gap-2 px-4 py-1.5 border border-amber-400/30 text-amber-400 rounded-lg text-sm hover:bg-amber-500/10 transition-colors">
              <Download className="w-3 h-3" /> Download Invoice
            </button>
          )}
          {['pending', 'confirmed'].includes(order.status) && (
            <button onClick={handleCancel} disabled={cancelling}
              className="flex items-center gap-2 px-4 py-1.5 border border-red-400/30 text-red-400 rounded-lg text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-card border border-edge/50 rounded-xl divide-y divide-edge/30">
        <div className="p-4">
          <h2 className="font-semibold mb-3">Items</h2>
        </div>
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-inset shrink-0">
              {item.image ? <img src={item.image} alt={item.title} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-theme-dim m-auto mt-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-theme-dim">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold">Rs. {(item.price * item.quantity)?.toLocaleString()}</p>
          </div>
        ))}
        <div className="p-4 flex justify-end">
          <div className="text-right">
            <p className="text-sm text-theme-muted">Total</p>
            <p className="text-xl font-bold">Rs. {order.totalAmount?.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="bg-card border border-edge/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold">Shipping Address</h2>
        </div>
        <p className="text-sm">{order.shippingAddress?.name}</p>
        <p className="text-sm text-theme-muted">{order.shippingAddress?.street}, {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
        <p className="text-sm text-theme-muted">{order.shippingAddress?.phone}</p>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-card border border-edge/50 rounded-xl p-5">
          <h2 className="font-semibold mb-2">Notes</h2>
          <p className="text-sm text-theme-muted">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
