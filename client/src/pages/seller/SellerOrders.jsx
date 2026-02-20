import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, XCircle, Loader, ChevronDown, ChevronUp, MapPin, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SellerAPI } from '../../api';

const statusConfig = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  confirmed: { color: 'text-blue-400 bg-blue-400/10', icon: Package },
  processing: { color: 'text-indigo-400 bg-indigo-400/10', icon: Package },
  shipped: { color: 'text-purple-400 bg-purple-400/10', icon: Truck },
  delivered: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle },
  cancelled: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
};

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  // Shipping state
  const [couriers, setCouriers] = useState([]);
  const [courierLoading, setCourierLoading] = useState(false);
  const [shipmentInfo, setShipmentInfo] = useState({});
  const [trackingData, setTrackingData] = useState({});

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const { data } = await SellerAPI.get('/orders');
      const orderList = Array.isArray(data) ? data : data.orders || [];
      setOrders(orderList);
      setCouriers([]);

      const shippableStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
      const shippableOrders = orderList.filter(o => shippableStatuses.includes(o.status));
      if (shippableOrders.length > 0) {
        try {
          const { data: batchData } = await SellerAPI.post('/shipping/batch-shipments', {
            orderIds: shippableOrders.map(o => o._id)
          });
          if (batchData.shipments) setShipmentInfo(batchData.shipments);
        } catch { /* no shipments yet */ }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await SellerAPI.put(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order ${newStatus}`);
      loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setUpdating(null);
  };

  // Shipping actions
  const checkServiceability = async (orderId) => {
    setCourierLoading(true);
    setCouriers([]);
    try {
      const { data } = await SellerAPI.post('/shipping/serviceability', { orderId });
      setCouriers(data.couriers || []);
      if (!data.couriers?.length) toast.error('No couriers available for this route');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to check serviceability'); }
    setCourierLoading(false);
  };

  const createShipment = async (orderId) => {
    setUpdating(orderId);
    try {
      await SellerAPI.post(`/shipping/${orderId}/create`);
      toast.success('Shipment created on Shiprocket!');
      await loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create shipment'); }
    setUpdating(null);
  };

  const createShipmentWithCourier = async (orderId, courierId, courierRate) => {
    setUpdating(orderId);
    try {
      await SellerAPI.post(`/shipping/${orderId}/create`);

      try {
        const { data: assignData } = await SellerAPI.post(`/shipping/${orderId}/assign-courier`, { courierId, courierRate });
        if (assignData.pickupScheduled) {
          toast.success('Shipment created, courier assigned & pickup scheduled!');
        } else {
          toast.success(`Courier assigned: ${assignData.shipment?.courierName} — schedule pickup manually`);
        }
      } catch (assignErr) {
        toast.error(assignErr.response?.data?.message || 'Shipment created but courier assignment failed — retry below');
      }

      setCouriers([]);
      await loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create shipment'); }
    setUpdating(null);
  };

  const assignCourier = async (orderId, courierId, courierRate) => {
    setUpdating(orderId);
    try {
      const { data } = await SellerAPI.post(`/shipping/${orderId}/assign-courier`, { courierId, courierRate });
      if (data.pickupScheduled) {
        toast.success('Courier assigned & pickup scheduled!');
      } else {
        toast.success(`Courier assigned: ${data.shipment?.courierName} — schedule pickup manually`);
      }
      setCouriers([]);
      await loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to assign courier'); }
    setUpdating(null);
  };

  const schedulePickup = async (orderId) => {
    setUpdating(orderId);
    try {
      await SellerAPI.post(`/shipping/${orderId}/pickup`);
      toast.success('Pickup scheduled! Order marked as shipped.');
      await loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to schedule pickup'); }
    setUpdating(null);
  };

  const getTracking = async (orderId) => {
    try {
      const { data } = await SellerAPI.get(`/shipping/${orderId}/track`);
      setTrackingData(prev => ({ ...prev, [orderId]: data }));
    } catch (err) { console.error(err); }
  };

  const getLabel = async (orderId) => {
    try {
      const { data } = await SellerAPI.get(`/shipping/${orderId}/label`);
      if (data.labelUrl) window.open(data.labelUrl, '_blank');
      else toast.error('Label not available yet');
    } catch (err) { toast.error('Failed to get label'); }
  };

  const toggleExpand = (orderId) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); return; }
    setCouriers([]);
    setExpandedOrder(orderId);
    if (shipmentInfo[orderId]?.shiprocketOrderId) {
      getTracking(orderId);
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Orders</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            {f === 'all' ? `All (${orders.length})` : `${f} (${orders.filter(o => o.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Package className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const st = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = st.icon;
            const isExpanded = expandedOrder === order._id;
            const shipment = shipmentInfo[order._id];
            const tracking = trackingData[order._id];

            return (
              <div key={order._id} className="bg-card border border-edge/50 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-theme-primary">{order.orderNumber}</p>
                      <p className="text-xs text-theme-muted">{new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                      <StatusIcon className="w-3 h-3" /> {order.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {(order.items || []).map((item, itemIdx) => (
                      <div key={itemIdx} className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-inset rounded-lg overflow-hidden shrink-0">
                          {item?.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-theme-dim m-auto mt-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate">{item?.title || 'Product'}</p>
                          <p className="text-xs text-theme-muted">Qty: {item.quantity || 1} &times; Rs. {item.price?.toLocaleString('en-IN')}</p>
                          {item.customizations?.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {item.customizations.map((c, ci) => (
                                <div key={ci} className="text-xs text-theme-muted">
                                  <span className="text-amber-400/80">{c.label}:</span>{' '}
                                  {c.value || (c.imageUrls?.length ? `${c.imageUrls.length} image(s)` : '')}
                                  {c.imageUrls?.length > 0 && (
                                    <div className="flex gap-1 mt-0.5">
                                      {c.imageUrls.map((url, i) => (
                                        <img key={i} src={url} alt="" className="w-8 h-8 rounded object-cover" />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Customer & shipping */}
                  <div className="text-xs text-theme-muted mb-3 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Ship to: {order.shippingAddress?.name}, {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</span>
                  </div>

                  {/* Earnings */}
                  <div className="text-xs text-theme-muted bg-inset/50 rounded-lg px-3 py-2 mb-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span>Sale: Rs. {(order.itemTotal || order.totalAmount || 0).toLocaleString('en-IN')}</span>
                      {(order.commissionAmount || 0) > 0 && <span>Commission: -Rs. {order.commissionAmount.toLocaleString('en-IN')}</span>}
                      {(order.paymentGatewayFee || 0) > 0 && <span>Gateway Fee: -Rs. {order.paymentGatewayFee.toLocaleString('en-IN')}</span>}
                      {order.shippingPaidBy === 'seller' && ((order.actualShippingCost || order.shippingCost || 0) > 0) && (
                        <span className="text-red-400">Shipping: -Rs. {(order.actualShippingCost || order.shippingCost).toLocaleString('en-IN')}</span>
                      )}
                      {order.shippingPaidBy === 'customer' && (order.shippingCost || 0) > 0 && (
                        <span className="text-theme-dim">Shipping: Paid by customer</span>
                      )}
                      <span className="text-green-400 font-medium">You get: Rs. {(
                        order.shippingPaidBy === 'seller'
                          ? Math.max(0, (order.sellerAmount || 0) - (order.actualShippingCost || order.shippingCost || 0))
                          : (order.sellerAmount || 0)
                      ).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Tracking info if shipped */}
                  {order.trackingInfo?.trackingNumber && (
                    <div className="text-xs text-theme-muted bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-2 mb-3">
                      <span className="text-purple-400 font-medium">Tracking:</span> {order.trackingInfo.courierName} - {order.trackingInfo.trackingNumber}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {order.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(order._id, 'confirmed')} disabled={updating === order._id} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/20">
                          {updating === order._id ? <Loader className="w-3 h-3 animate-spin" /> : 'Confirm Order'}
                        </button>
                        <button onClick={() => updateStatus(order._id, 'cancelled')} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20">Cancel</button>
                      </>
                    )}
                    {(order.status === 'confirmed' || order.status === 'processing') && (
                      <>
                        <button onClick={() => toggleExpand(order._id)} className="px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/20 flex items-center gap-1">
                          <Truck className="w-3 h-3" /> Ship Order {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {!(shipment && ['picked_up', 'in_transit', 'out_for_delivery'].includes(shipment.status)) && (
                          <button onClick={() => updateStatus(order._id, 'cancelled')} disabled={updating === order._id} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20">
                            Cancel Order
                          </button>
                        )}
                      </>
                    )}
                    {order.status === 'shipped' && (
                      <button onClick={() => toggleExpand(order._id)} className="px-3 py-1.5 bg-inset text-theme-muted rounded-lg text-xs font-medium hover:text-theme-primary flex items-center gap-1">
                        Track {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded shipping panel */}
                {isExpanded && (
                  <div className="border-t border-edge/50 p-4 bg-inset/30 animate-fade-in">
                    <h4 className="text-sm font-semibold text-theme-primary mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-amber-400" /> Shipping Management</h4>

                    {/* Select courier: no Shiprocket order yet OR shipment created but no AWB */}
                    {(order.status === 'confirmed' || order.status === 'processing') && !shipment?.awbCode && (
                      <div className="mb-4">
                        {shipment?.shiprocketOrderId && (
                          <div className="text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mb-3">
                            Shiprocket Order #{shipment.shiprocketOrderId} created — select a courier to continue
                          </div>
                        )}
                        <p className="text-xs text-theme-muted mb-2">Select a delivery partner (pickup will be auto-scheduled)</p>
                        {couriers.length === 0 && (
                          <button onClick={() => checkServiceability(order._id)} disabled={courierLoading} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-sm font-semibold flex items-center gap-2">
                            {courierLoading ? <Loader className="w-4 h-4 animate-spin" /> : <><Truck className="w-4 h-4" /> Check Available Couriers</>}
                          </button>
                        )}
                        {couriers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-400 font-medium mb-2">{couriers.length} courier{couriers.length > 1 ? 's' : ''} available:</p>
                            {order.shippingPaidBy === 'seller' && (
                              <p className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-1.5 mb-2">Shipping cost will be deducted from your payout (you offered free shipping)</p>
                            )}
                            {order.shippingPaidBy === 'customer' && (
                              <p className="text-[11px] text-green-400 bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-1.5 mb-2">Customer paid for shipping. Select a courier within the budget (max Rs. {order.actualShippingCost || order.shippingCost || '—'}).</p>
                            )}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {couriers.map(c => (
                                <button key={c.courierId} onClick={() => shipment?.shiprocketOrderId ? assignCourier(order._id, c.courierId, c.rate) : createShipmentWithCourier(order._id, c.courierId, c.rate)} disabled={updating === order._id} className="w-full flex items-center justify-between p-3 bg-card border border-edge rounded-lg text-sm hover:border-amber-500/30 transition-colors">
                                  {updating === order._id ? (
                                    <div className="flex items-center justify-center w-full py-1"><Loader className="w-4 h-4 animate-spin text-amber-400" /></div>
                                  ) : (
                                    <>
                                      <div className="text-left">
                                        <p className="font-medium text-theme-primary">{c.courierName}</p>
                                        <p className="text-xs text-theme-muted">Est. {c.estimatedDays} days &middot; Rating: {c.rating}/5</p>
                                      </div>
                                      <div className="text-right shrink-0 ml-3">
                                        <span className="text-amber-400 font-bold">Rs. {c.rate}</span>
                                        {order.shippingPaidBy === 'seller' && (
                                          <p className="text-[10px] text-red-400">deducted from payout</p>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fallback: pickup not auto-scheduled (AWB exists but order not shipped) */}
                    {shipment?.awbCode && order.status !== 'shipped' && order.status !== 'delivered' && (
                      <div className="mb-4">
                        <div className="text-xs text-green-400 bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2 mb-3">
                          {shipment.courierName && <span>Courier: {shipment.courierName} &middot; </span>}AWB: {shipment.awbCode}
                        </div>
                        <p className="text-xs text-theme-muted mb-2">Pickup was not auto-scheduled — schedule manually:</p>
                        <div className="flex gap-2">
                          <button onClick={() => schedulePickup(order._id)} disabled={updating === order._id} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-zinc-950 rounded-lg text-sm font-semibold flex items-center gap-2">
                            {updating === order._id ? <Loader className="w-4 h-4 animate-spin" /> : 'Schedule Pickup'}
                          </button>
                          <button onClick={() => getLabel(order._id)} className="px-4 py-2 bg-card border border-edge rounded-lg text-sm text-theme-secondary hover:border-edge-strong flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Print Label
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Manual ship hidden — all shipments go through Shiprocket */}

                    {/* Tracking display */}
                    {tracking?.shipment && (
                      <div className="mt-4 pt-4 border-t border-edge/50">
                        <h5 className="text-xs font-semibold text-theme-primary mb-2">Shipment Details</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs text-theme-muted">
                          <div>Status: <span className="text-theme-secondary">{tracking.shipment.status}</span></div>
                          {tracking.shipment.awbCode && <div>AWB: <span className="text-theme-secondary">{tracking.shipment.awbCode}</span></div>}
                          {tracking.shipment.courierName && <div>Courier: <span className="text-theme-secondary">{tracking.shipment.courierName}</span></div>}
                        </div>
                        {tracking.shipment.statusHistory?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {tracking.shipment.statusHistory.map((sh, i) => (
                              <div key={i} className="text-xs text-theme-dim flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-theme-dim shrink-0" />
                                <span>{sh.description}</span>
                                <span className="ml-auto">{new Date(sh.timestamp).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
