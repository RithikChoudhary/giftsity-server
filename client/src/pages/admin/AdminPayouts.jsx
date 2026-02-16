import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Clock, Loader, Calculator, CalendarDays, AlertTriangle, XCircle, RotateCcw, Send, RefreshCw, BarChart3, Package, Banknote, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

const toDateStr = (d) => d.toISOString().split('T')[0];
const fmtINR = (v) => `Rs. ${(v || 0).toLocaleString('en-IN')}`;

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [txnId, setTxnId] = useState('');
  const [tab, setTab] = useState('all');
  const [failingPayout, setFailingPayout] = useState(null);
  const [failReason, setFailReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [recon, setRecon] = useState(null);
  const [showRecon, setShowRecon] = useState(false);
  const [showManual, setShowManual] = useState(null);

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return toDateStr(d);
  });
  const [periodEnd, setPeriodEnd] = useState(() => toDateStr(new Date()));

  useEffect(() => {
    loadPayouts();
    loadReconciliation();
  }, []);

  const loadPayouts = async () => {
    try {
      const { data } = await API.get('/admin/payouts');
      setPayouts(Array.isArray(data) ? data : data.payouts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadReconciliation = async () => {
    try {
      const { data } = await API.get('/admin/payouts/reconciliation');
      setRecon(data);
    } catch (e) { console.error(e); }
  };

  const calculatePayouts = async () => {
    if (!periodStart || !periodEnd) return toast.error('Select period start and end dates');
    setCalculating(true);
    try {
      const { data } = await API.post('/admin/payouts/calculate', {
        periodStart,
        periodEnd,
        periodLabel: `${new Date(periodStart).toLocaleDateString('en-IN')} - ${new Date(periodEnd).toLocaleDateString('en-IN')}`
      });
      const count = data.payouts?.length || data.count || 0;
      if (count > 0) toast.success(`${count} payout(s) calculated`);
      else toast.error(data.message || 'No delivered orders found in this period');
      loadPayouts();
      loadReconciliation();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setCalculating(false);
  };

  const disbursePayout = async (payoutId) => {
    if (!window.confirm('This will initiate a real bank transfer via Cashfree. Continue?')) return;
    setActionLoading(payoutId);
    try {
      const { data } = await API.put(`/admin/payouts/${payoutId}/disburse`);
      toast.success(data.message || 'Payout disbursed');
      loadPayouts();
      loadReconciliation();
    } catch (err) { toast.error(err.response?.data?.message || 'Disburse failed'); }
    setActionLoading(null);
  };

  const batchDisburse = async () => {
    const pendingCount = payouts.filter(p => p.status === 'pending').length;
    if (pendingCount === 0) return toast.error('No pending payouts to disburse');
    if (!window.confirm(`Disburse all ${pendingCount} pending payout(s) via Cashfree? This initiates real bank transfers.`)) return;
    setBatchLoading(true);
    try {
      const { data } = await API.post('/admin/payouts/batch-disburse');
      const results = data.results || [];
      const succeeded = results.filter(r => r.status === 'processing' || r.status === 'paid').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      toast.success(`Batch: ${succeeded} sent, ${failed} failed, ${skipped} skipped`);
      loadPayouts();
      loadReconciliation();
    } catch (err) { toast.error(err.response?.data?.message || 'Batch disburse failed'); }
    setBatchLoading(false);
  };

  const checkStatus = async (payoutId) => {
    setActionLoading(payoutId);
    try {
      const { data } = await API.get(`/admin/payouts/${payoutId}/check-status`);
      toast.success(`Status: ${data.payout?.status || data.cashfreeStatus || 'updated'}`);
      loadPayouts();
    } catch (err) { toast.error(err.response?.data?.message || 'Status check failed'); }
    setActionLoading(null);
  };

  const markPaid = async (payoutId) => {
    if (!txnId) return toast.error('Enter transaction ID');
    setMarkingPaid(payoutId);
    try {
      await API.put(`/admin/payouts/${payoutId}/mark-paid`, { transactionId: txnId });
      toast.success('Payout marked as paid (manual)');
      setTxnId('');
      setMarkingPaid(null);
      setShowManual(null);
      loadPayouts();
      loadReconciliation();
    } catch (err) { toast.error('Failed'); }
    setMarkingPaid(null);
  };

  const markFailed = async (payoutId) => {
    if (!failReason.trim()) return toast.error('Enter a failure reason');
    setActionLoading(payoutId);
    try {
      await API.put(`/admin/payouts/${payoutId}/mark-failed`, { reason: failReason });
      toast.success('Payout marked as failed');
      setFailingPayout(null);
      setFailReason('');
      loadPayouts();
    } catch (err) { toast.error('Failed'); }
    setActionLoading(null);
  };

  const retryPayout = async (payoutId) => {
    setActionLoading(payoutId);
    try {
      await API.put(`/admin/payouts/${payoutId}/retry`);
      toast.success('Payout moved to pending');
      loadPayouts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setActionLoading(null);
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
      case 'processing': return Loader;
      case 'on_hold': return AlertTriangle;
      case 'failed': return XCircle;
      default: return Clock;
    }
  };

  const filtered = tab === 'all' ? payouts : payouts.filter(p => p.status === tab);

  const tabCounts = {
    all: payouts.length,
    pending: payouts.filter(p => p.status === 'pending').length,
    processing: payouts.filter(p => p.status === 'processing').length,
    on_hold: payouts.filter(p => p.status === 'on_hold').length,
    paid: payouts.filter(p => p.status === 'paid').length,
    failed: payouts.filter(p => p.status === 'failed').length,
  };

  if (loading) return <LoadingSpinner />;

  const isBankComplete = (snap) => snap?.accountHolderName && snap?.accountNumber && snap?.ifscCode && snap?.bankName;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Payouts</h1>
      </div>

      {/* Reconciliation Summary */}
      <div className="bg-card border border-edge/50 rounded-xl mb-6">
        <button onClick={() => setShowRecon(!showRecon)} className="w-full flex items-center justify-between p-4 text-left">
          <span className="text-sm font-medium text-theme-secondary flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" /> Reconciliation Overview
          </span>
          {showRecon ? <ChevronUp className="w-4 h-4 text-theme-dim" /> : <ChevronDown className="w-4 h-4 text-theme-dim" />}
        </button>
        {showRecon && recon && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Orders by payout status */}
              <div className="bg-inset/50 rounded-lg p-3">
                <p className="text-xs font-medium text-theme-muted mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Delivered Orders by Payout Status</p>
                <div className="space-y-1.5">
                  {Object.entries(recon.orders || {}).map(([status, info]) => (
                    <div key={status} className="flex items-center justify-between text-xs">
                      <span className="text-theme-secondary capitalize">{status.replace(/_/g, ' ')}</span>
                      <span className="text-theme-primary font-medium">{info.count} orders &middot; {fmtINR(info.totalAmount)}</span>
                    </div>
                  ))}
                  {Object.keys(recon.orders || {}).length === 0 && <p className="text-xs text-theme-dim">No delivered orders</p>}
                </div>
              </div>

              {/* Payouts by status */}
              <div className="bg-inset/50 rounded-lg p-3">
                <p className="text-xs font-medium text-theme-muted mb-2 flex items-center gap-1"><Banknote className="w-3 h-3" /> Payouts by Status</p>
                <div className="space-y-1.5">
                  {Object.entries(recon.payouts || {}).map(([status, info]) => (
                    <div key={status} className="flex items-center justify-between text-xs">
                      <span className={`capitalize ${status === 'paid' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : status === 'processing' ? 'text-blue-400' : status === 'on_hold' ? 'text-amber-400' : 'text-theme-secondary'}`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-theme-primary font-medium">{info.count} &middot; {fmtINR(info.totalNetPayout)}</span>
                    </div>
                  ))}
                  {Object.keys(recon.payouts || {}).length === 0 && <p className="text-xs text-theme-dim">No payouts yet</p>}
                </div>
              </div>
            </div>

            {/* Orphaned orders warning */}
            {recon.orphaned?.total > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Data integrity issue: {recon.orphaned.total} orphaned order(s)</p>
                  {recon.orphaned.nullPayoutId > 0 && <p>{recon.orphaned.nullPayoutId} orders marked "included_in_payout" but have no payout ID</p>}
                  {recon.orphaned.missingPayout > 0 && <p>{recon.orphaned.missingPayout} orders reference a payout that no longer exists</p>}
                </div>
              </div>
            )}
          </div>
        )}
        {showRecon && !recon && (
          <div className="px-4 pb-4 text-xs text-theme-dim">Loading reconciliation data...</div>
        )}
      </div>

      {/* Period selection + Calculate + Batch Disburse */}
      <div className="bg-card border border-edge/50 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-theme-secondary mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-amber-400" /> Select period for delivered orders</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-theme-dim mb-1">From</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="block text-xs text-theme-dim mb-1">To</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={calculatePayouts} disabled={calculating} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl text-sm font-semibold transition-colors">
            {calculating ? <Loader className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Calculate Payouts</>}
          </button>
          {tabCounts.pending > 0 && (
            <button onClick={batchDisburse} disabled={batchLoading} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-zinc-950 rounded-xl text-sm font-semibold transition-colors">
              {batchLoading ? <Loader className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Disburse All Pending ({tabCounts.pending})</>}
            </button>
          )}
        </div>
        <p className="text-[11px] text-theme-dim mt-2">Only delivered + paid orders not yet included in a payout will be processed. Payouts also run automatically on schedule.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'processing', label: 'Processing' },
          { key: 'on_hold', label: 'On Hold' },
          { key: 'paid', label: 'Paid' },
          { key: 'failed', label: 'Failed' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            {t.label} ({tabCounts[t.key] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <CreditCard className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No payouts{tab !== 'all' ? ` with status "${tab}"` : ''}</p>
          <p className="text-xs text-theme-dim mt-1">Click "Calculate Payouts" to process delivered orders.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(p => {
            const StatusIcon = getStatusIcon(p.status);
            const bankOk = isBankComplete(p.bankDetailsSnapshot);
            return (
              <div key={p._id} className={`bg-card border rounded-xl p-5 ${p.status === 'on_hold' ? 'border-amber-500/30' : p.status === 'failed' ? 'border-red-500/30' : p.status === 'processing' ? 'border-blue-500/30' : 'border-edge/50'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-theme-primary">{p.sellerId?.sellerProfile?.businessName || 'Seller'}</p>
                    <p className="text-xs text-theme-muted">{p.sellerId?.email} &middot; {p.periodLabel || 'Period'} &middot; {p.orderCount} orders</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(p.status)}`}>
                    <StatusIcon className="w-3 h-3" /> {p.status === 'on_hold' ? 'On Hold' : p.status}
                  </span>
                </div>

                {/* On hold info */}
                {p.status === 'on_hold' && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mb-3 text-xs text-amber-400">
                    Hold reason: {p.holdReason === 'missing_bank_details' ? 'Seller has not added bank details' : p.holdReason === 'below_minimum_transfer' ? 'Amount below Rs. 100 minimum' : p.holdReason || 'Unknown'}
                  </div>
                )}

                {/* Processing info */}
                {p.status === 'processing' && (
                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2 mb-3 text-xs text-blue-400">
                    Sent to Cashfree, awaiting bank confirmation. Auto-checked every 5 minutes.
                  </div>
                )}

                {/* Failed info */}
                {p.status === 'failed' && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 mb-3 text-xs text-red-400">
                    <p>Failed: {p.cashfreeFailureReason || p.failureDetails || 'Unknown reason'} {p.retryCount > 0 && `(${p.retryCount} retries)`}</p>
                  </div>
                )}

                {/* Financials */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
                  <div><p className="text-theme-dim text-xs">Total Sales</p><p className="font-medium text-theme-primary">{fmtINR(p.totalSales)}</p></div>
                  <div><p className="text-theme-dim text-xs">Commission</p><p className="font-medium text-theme-primary">{fmtINR(p.commissionDeducted)}</p></div>
                  <div><p className="text-theme-dim text-xs">Gateway Fees</p><p className="font-medium text-theme-primary">{fmtINR(p.gatewayFeesDeducted)}</p></div>
                  <div><p className="text-theme-dim text-xs">Shipping</p><p className="font-medium text-red-400">{(p.shippingDeducted || 0) > 0 ? `-${fmtINR(p.shippingDeducted)}` : 'Rs. 0'}</p></div>
                  <div><p className="text-theme-dim text-xs">Net Payout</p><p className="font-bold text-green-400">{fmtINR(p.netPayout)}</p></div>
                </div>

                {/* Bank details */}
                <div className={`text-xs mb-3 rounded-lg p-2 ${bankOk ? 'text-theme-dim bg-inset/50' : 'text-red-400 bg-red-500/5 border border-red-500/10'}`}>
                  {bankOk ? (
                    <>Bank: {p.bankDetailsSnapshot.bankName} &middot; A/C: ****{p.bankDetailsSnapshot.accountNumber?.slice(-4)} &middot; IFSC: {p.bankDetailsSnapshot.ifscCode}</>
                  ) : (
                    <>Bank details incomplete or missing</>
                  )}
                </div>

                {/* Cashfree tracking info */}
                {(p.cashfreeTransferId || p.cashfreeUtr || p.cashfreeStatus) && (
                  <div className="text-xs bg-inset/50 rounded-lg p-2 mb-3 space-y-0.5 text-theme-dim">
                    {p.cashfreeTransferId && <p>Cashfree Transfer ID: <span className="text-theme-secondary font-mono">{p.cashfreeTransferId}</span></p>}
                    {p.cashfreeReferenceId && <p>Cashfree Ref: <span className="text-theme-secondary font-mono">{p.cashfreeReferenceId}</span></p>}
                    {p.cashfreeUtr && <p>UTR: <span className="text-theme-secondary font-mono">{p.cashfreeUtr}</span></p>}
                    {p.cashfreeStatus && <p>Cashfree Status: <span className="text-theme-secondary">{p.cashfreeStatus}</span></p>}
                    {p.disbursedAt && <p>Disbursed: <span className="text-theme-secondary">{new Date(p.disbursedAt).toLocaleString('en-IN')}</span></p>}
                  </div>
                )}

                {/* Actions for PENDING */}
                {p.status === 'pending' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => disbursePayout(p._id)} disabled={actionLoading === p._id || !bankOk} className="flex items-center gap-1.5 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                        {actionLoading === p._id ? <Loader className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Disburse via Cashfree</>}
                      </button>
                      <button onClick={() => setShowManual(showManual === p._id ? null : p._id)} className="px-3 py-2 bg-inset text-theme-muted rounded-lg text-xs hover:text-theme-primary">
                        Manual Override
                      </button>
                      <button onClick={() => { setFailingPayout(p._id); setFailReason(''); }} className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20">
                        Mark Failed
                      </button>
                    </div>
                    {!bankOk && <p className="text-[11px] text-red-400">Cashfree disburse disabled: bank details incomplete</p>}

                    {/* Manual mark-paid form (hidden by default) */}
                    {showManual === p._id && (
                      <div className="flex items-center gap-2 bg-inset/30 rounded-lg p-2">
                        <input type="text" placeholder="Transaction/UTR ID (manual)" value={markingPaid === p._id ? txnId : ''} onChange={e => { setMarkingPaid(p._id); setTxnId(e.target.value); }} className="flex-1 min-w-[180px] px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary placeholder:text-theme-dim" />
                        <button onClick={() => markPaid(p._id)} disabled={markingPaid === p._id && !txnId} className="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20">
                          Mark Paid
                        </button>
                        <button onClick={() => setShowManual(null)} className="px-2 py-1.5 text-theme-dim text-xs">Cancel</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions for PROCESSING */}
                {p.status === 'processing' && (
                  <div className="flex gap-2">
                    <button onClick={() => checkStatus(p._id)} disabled={actionLoading === p._id} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/20">
                      {actionLoading === p._id ? <Loader className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3" /> Check Status</>}
                    </button>
                  </div>
                )}

                {/* Mark failed form */}
                {failingPayout === p._id && (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="text" placeholder="Failure reason (e.g., wrong account number)" value={failReason} onChange={e => setFailReason(e.target.value)} className="flex-1 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim" />
                    <button onClick={() => markFailed(p._id)} disabled={actionLoading === p._id} className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20">
                      {actionLoading === p._id ? <Loader className="w-3 h-3 animate-spin" /> : 'Confirm Failed'}
                    </button>
                    <button onClick={() => setFailingPayout(null)} className="px-3 py-2 bg-inset text-theme-muted rounded-lg text-sm">Cancel</button>
                  </div>
                )}

                {/* Retry for failed/on_hold */}
                {(p.status === 'failed' || p.status === 'on_hold') && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => retryPayout(p._id)} disabled={actionLoading === p._id} className="flex items-center gap-1 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/20">
                      {actionLoading === p._id ? <Loader className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3" /> Move to Pending</>}
                    </button>
                  </div>
                )}

                {p.transactionId && <p className="text-xs text-theme-dim mt-2">Manual Txn: {p.transactionId}</p>}
                {p.paidAt && <p className="text-xs text-theme-dim">Paid: {new Date(p.paidAt).toLocaleDateString('en-IN')}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
