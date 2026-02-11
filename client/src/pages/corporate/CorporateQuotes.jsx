import { useState, useEffect } from 'react';
import { corporateAPI } from '../../api';
import { FileText, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export default function CorporateQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    corporateAPI.getQuotes()
      .then(res => setQuotes(res.data.quotes || []))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (quoteId) => {
    if (!confirm('Approve this quote? You will be redirected to payment.')) return;
    setActionLoading(quoteId);
    try {
      const res = await corporateAPI.approveQuote(quoteId, {});
      if (res.data.cashfreeOrder?.paymentSessionId) {
        const cashfree = await window.Cashfree?.({ mode: res.data.env === 'production' ? 'production' : 'sandbox' });
        if (cashfree) {
          cashfree.checkout({ paymentSessionId: res.data.cashfreeOrder.paymentSessionId, redirectTarget: '_self' });
          return;
        }
      }
      // Refresh quotes
      setQuotes(quotes.map(q => q._id === quoteId ? { ...q, status: 'approved' } : q));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve quote');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (quoteId) => {
    setActionLoading(quoteId);
    try {
      await corporateAPI.rejectQuote(quoteId, { reason: rejectReason });
      setQuotes(quotes.map(q => q._id === quoteId ? { ...q, status: 'rejected', clientNotes: rejectReason } : q));
      setRejectReason('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject quote');
    } finally {
      setActionLoading('');
    }
  };

  const statusBadge = (status) => {
    const map = {
      sent: { color: 'bg-blue-500/10 text-blue-400', icon: Clock, label: 'Pending Review' },
      approved: { color: 'bg-green-500/10 text-green-400', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-500/10 text-red-400', icon: XCircle, label: 'Rejected' },
      expired: { color: 'bg-gray-500/10 text-gray-400', icon: AlertTriangle, label: 'Expired' },
      converted: { color: 'bg-green-500/10 text-green-400', icon: CheckCircle, label: 'Converted to Order' },
    };
    const s = map[status] || map.sent;
    return (
      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
        <s.icon className="w-3 h-3" /> {s.label}
      </span>
    );
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Quotes</h1>
      <p className="text-sm text-theme-muted">Review and respond to quotes from our team</p>

      {quotes.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 text-theme-dim mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No quotes yet</h2>
          <p className="text-theme-muted">Once our team sends you a quote, it will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quotes.map(quote => (
            <div key={quote._id} className="bg-card border border-edge/50 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === quote._id ? null : quote._id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-inset/30 transition-colors">
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{quote.quoteNumber}</p>
                    <p className="text-xs text-theme-muted">{quote.items?.length} items &middot; Created {new Date(quote.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(quote.status)}
                  <p className="text-lg font-bold">Rs. {quote.finalAmount?.toLocaleString()}</p>
                  {expandedId === quote._id ? <ChevronUp className="w-4 h-4 text-theme-dim" /> : <ChevronDown className="w-4 h-4 text-theme-dim" />}
                </div>
              </button>

              {expandedId === quote._id && (
                <div className="border-t border-edge/30 p-5 space-y-4">
                  {/* Items */}
                  <div className="space-y-2">
                    {quote.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-inset/50">
                        <div className="flex items-center gap-3">
                          {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded object-cover" />}
                          <div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-theme-dim">Rs. {item.unitPrice} x {item.quantity}</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold">Rs. {item.subtotal?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="flex justify-end">
                    <div className="text-right space-y-1">
                      <p className="text-sm text-theme-muted">Subtotal: Rs. {quote.totalAmount?.toLocaleString()}</p>
                      {quote.discountPercent > 0 && <p className="text-sm text-green-400">Discount: {quote.discountPercent}%</p>}
                      <p className="text-lg font-bold">Total: Rs. {quote.finalAmount?.toLocaleString()}</p>
                      {quote.validUntil && <p className="text-xs text-theme-dim">Valid until: {new Date(quote.validUntil).toLocaleDateString()}</p>}
                    </div>
                  </div>

                  {quote.adminNotes && (
                    <div className="p-3 bg-inset/50 rounded-lg">
                      <p className="text-xs text-theme-dim mb-1">Note from team:</p>
                      <p className="text-sm text-theme-muted">{quote.adminNotes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {quote.status === 'sent' && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button onClick={() => handleApprove(quote._id)} disabled={actionLoading === quote._id}
                        className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50">
                        {actionLoading === quote._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve & Pay
                      </button>
                      <div className="flex items-center gap-2">
                        <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (optional)"
                          className="px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 w-48" />
                        <button onClick={() => handleReject(quote._id)} disabled={actionLoading === quote._id}
                          className="flex items-center gap-2 px-4 py-2 border border-red-400/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
