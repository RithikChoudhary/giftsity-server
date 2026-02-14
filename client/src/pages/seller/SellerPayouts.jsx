import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, DollarSign, Clock, CheckCircle, AlertTriangle, XCircle, Truck } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { SellerAPI } from '../../api';

export default function SellerPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPayouts(); }, []);

  const loadPayouts = async () => {
    try {
      const { data } = await SellerAPI.get('/payouts');
      setPayouts(Array.isArray(data) ? data : data.payouts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'paid': return 'text-green-400 bg-green-400/10';
      case 'processing': return 'text-blue-400 bg-blue-400/10';
      case 'on_hold': return 'text-amber-400 bg-amber-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      default: return 'text-yellow-400 bg-yellow-400/10';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return CheckCircle;
      case 'on_hold': return AlertTriangle;
      case 'failed': return XCircle;
      default: return Clock;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Payouts</h1>

      {payouts.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <CreditCard className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No payouts yet</p>
          <p className="text-xs text-theme-dim mt-1">Payouts are calculated automatically after orders are delivered.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map(p => {
            const StatusIcon = getStatusIcon(p.status);
            return (
              <div key={p._id} className="bg-card border border-edge/50 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-theme-primary">{p.periodLabel || 'Payout Period'}</p>
                    <p className="text-xs text-theme-muted mt-0.5">{new Date(p.periodStart).toLocaleDateString('en-IN')} - {new Date(p.periodEnd).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(p.status)}`}>
                    <StatusIcon className="w-3 h-3" />
                    {p.status === 'on_hold' ? 'On Hold' : p.status}
                  </span>
                </div>

                {/* On hold warning */}
                {p.status === 'on_hold' && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mb-3 text-xs">
                    <p className="text-amber-400 font-medium">Payout on hold{p.holdReason === 'missing_bank_details' ? ' - Bank details missing' : p.holdReason ? ` - ${p.holdReason}` : ''}</p>
                    {p.holdReason === 'missing_bank_details' && (
                      <p className="text-theme-muted mt-1">Please add your bank details in <Link to="/seller/settings" className="text-amber-400 underline">Settings</Link> to release this payout.</p>
                    )}
                  </div>
                )}

                {/* Failed warning */}
                {p.status === 'failed' && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 mb-3 text-xs">
                    <p className="text-red-400 font-medium">Payout failed</p>
                    {p.failureDetails && <p className="text-theme-muted mt-1">{p.failureDetails}</p>}
                    <p className="text-theme-muted mt-1">Please verify your bank details in <Link to="/seller/settings" className="text-amber-400 underline">Settings</Link>. Admin will retry the payout.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <p className="text-theme-dim text-xs">Orders</p>
                    <p className="font-medium text-theme-primary">{p.orderCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim text-xs">Total Sales</p>
                    <p className="font-medium text-theme-primary">Rs. {(p.totalSales || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim text-xs">Fees</p>
                    <p className="font-medium text-theme-primary">-Rs. {((p.commissionDeducted || 0) + (p.gatewayFeesDeducted || 0)).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim text-xs">Shipping</p>
                    <p className="font-medium text-red-400">{(p.shippingDeducted || 0) > 0 ? `-Rs. ${p.shippingDeducted.toLocaleString('en-IN')}` : 'Rs. 0'}</p>
                  </div>
                  <div>
                    <p className="text-theme-dim text-xs">Net Payout</p>
                    <p className="font-bold text-green-400">Rs. {(p.netPayout || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                {p.transactionId && <p className="text-xs text-theme-dim mt-3">Txn: {p.transactionId}</p>}
                {p.paidAt && <p className="text-xs text-theme-dim">Paid on: {new Date(p.paidAt).toLocaleDateString('en-IN')}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
