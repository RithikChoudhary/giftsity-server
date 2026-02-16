import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { returnAPI } from '../../api';
import SEO from '../../components/SEO';

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

export default function ReturnRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    returnAPI.getMyRequests()
      .then(res => setRequests(res.data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <SEO title="Return Requests" noIndex />
      <h1 className="text-2xl font-bold text-theme-primary mb-6 flex items-center gap-2">
        <RotateCcw className="w-6 h-6" /> Return Requests
      </h1>

      {loading ? (
        <div className="text-center py-12 text-theme-muted">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <RotateCcw className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No return requests</p>
          <Link to="/orders" className="text-sm text-amber-500 hover:text-amber-400 mt-2 inline-block">View your orders</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r._id} className="bg-theme-card border border-theme-border rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(expanded === r._id ? null : r._id)} className="w-full text-left p-4 flex items-center justify-between hover:bg-theme-hover transition-colors">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-theme-primary">
                      {r.type === 'return' ? 'Return' : 'Exchange'} - Order #{r.orderId?.orderNumber || '...'}
                    </p>
                    <p className="text-xs text-theme-muted mt-0.5">
                      {r.reason.replace(/_/g, ' ')} &middot; {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || 'bg-zinc-500/20 text-zinc-500'}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  {expanded === r._id ? <ChevronUp className="w-4 h-4 text-theme-dim" /> : <ChevronDown className="w-4 h-4 text-theme-dim" />}
                </div>
              </button>

              {expanded === r._id && (
                <div className="px-4 pb-4 border-t border-theme-border/50 pt-3 space-y-3">
                  {/* Items */}
                  <div>
                    <p className="text-xs font-medium text-theme-muted mb-1">Items</p>
                    {r.items?.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-theme-secondary">
                        {item.image && <img src={item.image} alt="" className="w-8 h-8 rounded object-cover" />}
                        <span>{item.title || 'Item'} x{item.quantity}</span>
                        <span className="text-theme-dim">Rs.{item.price}</span>
                      </div>
                    ))}
                  </div>

                  {r.reasonDetails && (
                    <div>
                      <p className="text-xs font-medium text-theme-muted mb-0.5">Details</p>
                      <p className="text-sm text-theme-secondary">{r.reasonDetails}</p>
                    </div>
                  )}

                  {r.rejectionReason && (
                    <div className="bg-red-500/10 p-2 rounded">
                      <p className="text-xs font-medium text-red-500">Rejection reason</p>
                      <p className="text-sm text-theme-secondary">{r.rejectionReason}</p>
                    </div>
                  )}

                  {r.refundAmount > 0 && (
                    <p className="text-sm text-theme-secondary">Refund amount: <span className="font-medium text-green-500">Rs.{r.refundAmount}</span></p>
                  )}

                  {r.images?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {r.images.map((img, i) => (
                        <img key={i} src={img} alt="" className="w-16 h-16 rounded object-cover border border-theme-border" />
                      ))}
                    </div>
                  )}

                  {/* Status history */}
                  {r.statusHistory?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-theme-muted mb-1">Timeline</p>
                      <div className="space-y-1">
                        {r.statusHistory.map((sh, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-theme-secondary capitalize">{sh.status.replace(/_/g, ' ')}</span>
                            {sh.note && <span className="text-theme-dim">- {sh.note}</span>}
                            <span className="text-theme-dim ml-auto">{new Date(sh.timestamp).toLocaleDateString('en-IN')}</span>
                          </div>
                        ))}
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
