import { useState, useEffect } from 'react';
import API from '../../api';
import { FileText, Plus, Loader2, Search, Edit3, ChevronDown, ChevronUp, Save, X, Eye } from 'lucide-react';

export default function AdminCorporateQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    companyName: '', contactEmail: '', contactPhone: '', discountPercent: 0, validUntil: '', adminNotes: '',
    items: [{ productId: '', quantity: 1, unitPrice: '' }]
  });
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const res = await API.get('/admin/corporate/quotes', { params });
      setQuotes(res.data.quotes || []);
    } catch { setQuotes([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuotes(); }, [filter]);

  const searchProducts = async (q, idx) => {
    setProductSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await API.get('/admin/products', { params: { search: q, limit: 5 } });
      setSearchResults(res.data.products?.map(p => ({ ...p, _itemIdx: idx })) || []);
    } catch { setSearchResults([]); }
  };

  const selectProduct = (p) => {
    const items = [...createForm.items];
    items[p._itemIdx] = { productId: p._id, quantity: items[p._itemIdx].quantity || 10, unitPrice: p.price, _title: p.title };
    setCreateForm({ ...createForm, items });
    setSearchResults([]);
    setProductSearch('');
  };

  const addItem = () => {
    setCreateForm({ ...createForm, items: [...createForm.items, { productId: '', quantity: 1, unitPrice: '' }] });
  };

  const removeItem = (i) => {
    setCreateForm({ ...createForm, items: createForm.items.filter((_, idx) => idx !== i) });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.companyName || !createForm.contactEmail) { alert('Company name and email required'); return; }
    if (!createForm.items.some(i => i.productId)) { alert('Add at least one product'); return; }
    setCreateLoading(true);
    try {
      await API.post('/admin/corporate/quotes', {
        ...createForm,
        items: createForm.items.filter(i => i.productId)
      });
      setShowCreate(false);
      setCreateForm({ companyName: '', contactEmail: '', contactPhone: '', discountPercent: 0, validUntil: '', adminNotes: '', items: [{ productId: '', quantity: 1, unitPrice: '' }] });
      fetchQuotes();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create quote');
    } finally { setCreateLoading(false); }
  };

  const statusColor = {
    draft: 'bg-gray-500/10 text-gray-400',
    sent: 'bg-blue-500/10 text-blue-400',
    approved: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
    expired: 'bg-gray-500/10 text-gray-400',
    converted: 'bg-green-500/10 text-green-400'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Corporate Quotes</h1>
          <p className="text-sm text-theme-muted">Create and manage quotes for corporate clients</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
          <Plus className="w-4 h-4" /> Create Quote
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'sent', 'approved', 'rejected', 'expired', 'converted'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-amber-500 text-white' : 'bg-card border border-edge/50 text-theme-muted hover:text-theme-primary'}`}>
            {f === '' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-card border border-edge/50 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">New Quote</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-theme-dim mb-1">Company Name *</label>
              <input type="text" value={createForm.companyName} onChange={e => setCreateForm({ ...createForm, companyName: e.target.value })} required
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Contact Email *</label>
              <input type="email" value={createForm.contactEmail} onChange={e => setCreateForm({ ...createForm, contactEmail: e.target.value })} required
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Phone</label>
              <input type="tel" value={createForm.contactPhone} onChange={e => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-theme-dim mb-2">Items</label>
            {createForm.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <div className="flex-1 relative">
                  <input type="text" value={item._title || ''} onChange={e => searchProducts(e.target.value, i)} placeholder="Search product..."
                    className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                  {searchResults.length > 0 && searchResults[0]?._itemIdx === i && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-edge rounded-lg shadow-lg max-h-36 overflow-y-auto z-10">
                      {searchResults.map(p => (
                        <button key={p._id} type="button" onClick={() => selectProduct(p)}
                          className="w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-inset/50">{p.title} - Rs. {p.price}</button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="number" value={item.quantity} onChange={e => { const items = [...createForm.items]; items[i].quantity = parseInt(e.target.value) || 1; setCreateForm({ ...createForm, items }); }}
                  className="w-20 px-2 py-2 bg-inset border border-edge rounded-lg text-sm" placeholder="Qty" />
                <input type="number" value={item.unitPrice} onChange={e => { const items = [...createForm.items]; items[i].unitPrice = e.target.value; setCreateForm({ ...createForm, items }); }}
                  className="w-24 px-2 py-2 bg-inset border border-edge rounded-lg text-sm" placeholder="Price" />
                {createForm.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-theme-dim mb-1">Discount %</label>
              <input type="number" value={createForm.discountPercent} onChange={e => setCreateForm({ ...createForm, discountPercent: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Valid Until</label>
              <input type="date" value={createForm.validUntil} onChange={e => setCreateForm({ ...createForm, validUntil: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Admin Notes</label>
              <input type="text" value={createForm.adminNotes} onChange={e => setCreateForm({ ...createForm, adminNotes: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={createLoading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-2">
              {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create & Send
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-edge rounded-lg text-sm text-theme-muted">Cancel</button>
          </div>
        </form>
      )}

      {/* Quotes List */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12 text-theme-muted">
          <FileText className="w-12 h-12 mx-auto mb-3 text-theme-dim" />
          <p>No quotes found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(quote => (
            <div key={quote._id} className="bg-card border border-edge/50 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === quote._id ? null : quote._id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-inset/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{quote.quoteNumber}</p>
                    <p className="text-xs text-theme-muted">{quote.companyName} &middot; {quote.contactEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[quote.status] || ''}`}>{quote.status}</span>
                  <span className="text-sm font-bold">Rs. {quote.finalAmount?.toLocaleString()}</span>
                  <span className="text-xs text-theme-dim">{new Date(quote.createdAt).toLocaleDateString()}</span>
                  {expandedId === quote._id ? <ChevronUp className="w-4 h-4 text-theme-dim" /> : <ChevronDown className="w-4 h-4 text-theme-dim" />}
                </div>
              </button>

              {expandedId === quote._id && (
                <div className="border-t border-edge/30 p-4 space-y-3">
                  <div className="space-y-2">
                    {quote.items?.map((item, i) => (
                      <div key={i} className="flex justify-between p-2 bg-inset/50 rounded-lg text-sm">
                        <span>{item.title} x {item.quantity}</span>
                        <span className="font-medium">Rs. {item.subtotal?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-theme-muted">Subtotal</span>
                    <span>Rs. {quote.totalAmount?.toLocaleString()}</span>
                  </div>
                  {quote.discountPercent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">Discount ({quote.discountPercent}%)</span>
                      <span className="text-green-400">-Rs. {(quote.totalAmount - quote.finalAmount)?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>Rs. {quote.finalAmount?.toLocaleString()}</span>
                  </div>
                  {quote.adminNotes && <p className="text-xs text-theme-dim">Notes: {quote.adminNotes}</p>}
                  {quote.clientNotes && <p className="text-xs text-red-400">Client feedback: {quote.clientNotes}</p>}
                  {quote.validUntil && <p className="text-xs text-theme-dim">Valid until: {new Date(quote.validUntil).toLocaleDateString()}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
