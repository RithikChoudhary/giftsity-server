import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Clock, CheckCircle } from 'lucide-react';
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

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Payouts</h1>

      {payouts.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <CreditCard className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No payouts yet</p>
          <p className="text-xs text-theme-dim mt-1">Payouts are calculated after orders are delivered.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map(p => (
            <div key={p._id} className="bg-card border border-edge/50 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-theme-primary">{p.periodLabel || 'Payout Period'}</p>
                  <p className="text-xs text-theme-muted mt-0.5">{new Date(p.periodStart).toLocaleDateString()} - {new Date(p.periodEnd).toLocaleDateString()}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'paid' ? 'text-green-400 bg-green-400/10' : p.status === 'processing' ? 'text-blue-400 bg-blue-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                  {p.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {p.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-theme-dim text-xs">Orders</p>
                  <p className="font-medium text-theme-primary">{p.orderCount || 0}</p>
                </div>
                <div>
                  <p className="text-theme-dim text-xs">Total Sales</p>
                  <p className="font-medium text-theme-primary">Rs. {(p.totalSales || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-theme-dim text-xs">Deductions</p>
                  <p className="font-medium text-theme-primary">Rs. {((p.commissionDeducted || 0) + (p.gatewayFeesDeducted || 0)).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-theme-dim text-xs">Net Payout</p>
                  <p className="font-bold text-green-400">Rs. {(p.netPayout || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
              {p.transactionId && <p className="text-xs text-theme-dim mt-3">Txn: {p.transactionId}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
