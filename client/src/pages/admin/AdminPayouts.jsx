import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, CheckCircle, Clock, Loader, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [txnId, setTxnId] = useState('');

  useEffect(() => { loadPayouts(); }, []);

  const loadPayouts = async () => {
    try {
      const { data } = await API.get('/api/admin/payouts/pending');
      setPayouts(Array.isArray(data) ? data : data.payouts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const calculatePayouts = async () => {
    setCalculating(true);
    try {
      const { data } = await API.post('/api/admin/payouts/calculate');
      toast.success(`${data.count || 0} payouts calculated`);
      loadPayouts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setCalculating(false);
  };

  const markPaid = async (payoutId) => {
    if (!txnId) return toast.error('Enter transaction ID');
    setMarkingPaid(payoutId);
    try {
      await API.put(`/api/admin/payouts/${payoutId}/mark-paid`, { transactionId: txnId });
      toast.success('Payout marked as paid');
      setTxnId('');
      setMarkingPaid(null);
      loadPayouts();
    } catch (err) { toast.error('Failed'); }
    setMarkingPaid(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Payouts</h1>
        <button onClick={calculatePayouts} disabled={calculating} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl text-sm font-semibold transition-colors">
          {calculating ? <Loader className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Calculate Payouts</>}
        </button>
      </div>

      {payouts.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <CreditCard className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No pending payouts</p>
          <p className="text-xs text-theme-dim mt-1">Click "Calculate Payouts" to process delivered orders.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payouts.map(p => (
            <div key={p._id} className="bg-card border border-edge/50 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-theme-primary">{p.sellerId?.sellerProfile?.businessName || 'Seller'}</p>
                  <p className="text-xs text-theme-muted">{p.periodLabel || 'Period'} &middot; {p.orderCount} orders</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'paid' ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                  {p.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {p.status}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div><p className="text-theme-dim text-xs">Total Sales</p><p className="font-medium text-theme-primary">Rs. {(p.totalSales || 0).toLocaleString('en-IN')}</p></div>
                <div><p className="text-theme-dim text-xs">Commission</p><p className="font-medium text-theme-primary">Rs. {(p.commissionDeducted || 0).toLocaleString('en-IN')}</p></div>
                <div><p className="text-theme-dim text-xs">Gateway Fees</p><p className="font-medium text-theme-primary">Rs. {(p.gatewayFeesDeducted || 0).toLocaleString('en-IN')}</p></div>
                <div><p className="text-theme-dim text-xs">Net Payout</p><p className="font-bold text-green-400">Rs. {(p.netPayout || 0).toLocaleString('en-IN')}</p></div>
              </div>
              {p.bankDetailsSnapshot && (
                <div className="text-xs text-theme-dim mb-3 bg-inset/50 rounded-lg p-2">
                  Bank: {p.bankDetailsSnapshot.bankName} &middot; A/C: ****{p.bankDetailsSnapshot.accountNumber?.slice(-4)} &middot; IFSC: {p.bankDetailsSnapshot.ifscCode}
                </div>
              )}
              {p.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Transaction/UTR ID" value={markingPaid === p._id ? txnId : ''} onChange={e => { setMarkingPaid(p._id); setTxnId(e.target.value); }} className="flex-1 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim" />
                  <button onClick={() => markPaid(p._id)} disabled={markingPaid === p._id && !txnId} className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/20">
                    Mark Paid
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
