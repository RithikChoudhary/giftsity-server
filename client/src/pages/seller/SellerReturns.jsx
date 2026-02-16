import { useState, useEffect } from 'react';
import { RotateCcw, Check, X, Package } from 'lucide-react';
import { sellerReturnAPI } from '../../api';
import toast from 'react-hot-toast';

const statusColors = {
  requested: 'bg-yellow-500/20 text-yellow-500',
  approved: 'bg-blue-500/20 text-blue-500',
  rejected: 'bg-red-500/20 text-red-500',
  shipped_back: 'bg-purple-500/20 text-purple-500',
  received: 'bg-teal-500/20 text-teal-500',
  refunded: 'bg-green-500/20 text-green-500',
  exchanged: 'bg-green-500/20 text-green-500',
  cancelled: 'bg-zinc-500/20 text-zinc-500'
};

export default function SellerReturns() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchReturns = () => {
    setLoading(true);
    sellerReturnAPI.getReturns(filter ? { status: filter } : {})
      .then(res => setRequests(res.data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReturns(); }, [filter]);

  const approve = async (id) => {
    try {
      await sellerReturnAPI.approve(id, { note: 'Approved by seller' });
      toast.success('Return approved');
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason');
    try {
      await sellerReturnAPI.reject(rejectModal, { reason: rejectReason.trim() });
      toast.success('Return rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const markReceived = async (id) => {
    try {
      await sellerReturnAPI.markReceived(id);
      toast.success('Item marked as received, refund initiated');
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
          <RotateCcw className="w-5 h-5" /> Return Requests
        </h1>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="text-sm bg-theme-input border border-theme-border rounded-lg px-3 py-1.5 text-theme-primary">
          <option value="">All</option>
          <option value="requested">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-theme-muted">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <RotateCcw className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No return requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r._id} className="bg-theme-card border border-theme-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-theme-dim">{r.type === 'return' ? 'Return' : 'Exchange'}</span>
                  </div>
                  <p className="text-sm font-medium text-theme-primary">
                    Order #{r.orderId?.orderNumber || '...'}
                  </p>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Customer: {r.customerId?.name || 'Unknown'} &middot; {r.customerId?.email || ''}
                  </p>
                  <p className="text-xs text-theme-secondary mt-1">
                    Reason: <span className="capitalize">{r.reason?.replace(/_/g, ' ')}</span>
                    {r.reasonDetails && <span className="text-theme-dim"> - {r.reasonDetails}</span>}
                  </p>

                  {/* Items */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-theme-secondary bg-theme-hover px-2 py-1 rounded">
                        {item.image && <img src={item.image} alt="" className="w-5 h-5 rounded object-cover" />}
                        <span>{item.title || 'Item'} x{item.quantity} (Rs.{item.price})</span>
                      </div>
                    ))}
                  </div>

                  {r.images?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {r.images.map((img, i) => <img key={i} src={img} alt="" className="w-12 h-12 rounded object-cover border border-theme-border" />)}
                    </div>
                  )}

                  <p className="text-xs text-theme-dim mt-2">
                    Refund amount: Rs.{r.refundAmount || 0} &middot; {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>

                {/* Actions */}
                {r.status === 'requested' && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => approve(r._id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500">
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => setRejectModal(r._id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-500">
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
                {(r.status === 'approved' || r.status === 'shipped_back') && (
                  <button onClick={() => markReceived(r._id)} className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-500">
                    <Package className="w-3 h-3" /> Mark Received
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-theme-card border border-theme-border rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-theme-primary mb-3">Reject Return</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why you're rejecting this return..."
              className="w-full bg-theme-input border border-theme-border rounded-lg p-3 text-sm text-theme-primary min-h-[100px] focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary">Cancel</button>
              <button onClick={reject} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-500">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
