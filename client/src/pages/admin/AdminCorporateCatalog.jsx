import { useState, useEffect } from 'react';
import API from '../../api';
import { Plus, Trash2, Loader2, Package, Search, Edit3, Save, X } from 'lucide-react';

export default function AdminCorporateCatalog() {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addForm, setAddForm] = useState({ productId: '', corporatePrice: '', minOrderQty: 10, maxOrderQty: 10000, tags: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await API.get('/admin/corporate/catalog');
      setCatalog(res.data.catalog || []);
    } catch {
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCatalog(); }, []);

  const searchProducts = async (q) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await API.get('/admin/products', { params: { search: q, limit: 10 } });
      const existingIds = catalog.map(c => c.productId?._id || c.productId);
      setSearchResults((res.data.products || []).filter(p => !existingIds.includes(p._id)));
    } catch {
      setSearchResults([]);
    }
  };

  const selectProduct = (p) => {
    setAddForm({ ...addForm, productId: p._id });
    setSearch(p.title);
    setSearchResults([]);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.productId) return;
    setAddLoading(true);
    try {
      await API.post('/admin/corporate/catalog', {
        productId: addForm.productId,
        corporatePrice: addForm.corporatePrice ? Number(addForm.corporatePrice) : null,
        minOrderQty: Number(addForm.minOrderQty),
        maxOrderQty: Number(addForm.maxOrderQty),
        tags: addForm.tags ? addForm.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      });
      setShowAdd(false);
      setAddForm({ productId: '', corporatePrice: '', minOrderQty: 10, maxOrderQty: 10000, tags: '' });
      setSearch('');
      fetchCatalog();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdate = async (id) => {
    try {
      await API.put('/admin/corporate/catalog/' + id, {
        ...editForm,
        corporatePrice: editForm.corporatePrice ? Number(editForm.corporatePrice) : null,
        minOrderQty: Number(editForm.minOrderQty),
        maxOrderQty: Number(editForm.maxOrderQty),
        tags: typeof editForm.tags === 'string' ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : editForm.tags
      });
      setEditId(null);
      fetchCatalog();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleRemove = async (id) => {
    if (!confirm('Remove from corporate catalog?')) return;
    try {
      await API.delete('/admin/corporate/catalog/' + id);
      fetchCatalog();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    }
  };

  const startEdit = (entry) => {
    setEditId(entry._id);
    setEditForm({
      corporatePrice: entry.corporatePrice || '',
      minOrderQty: entry.minOrderQty,
      maxOrderQty: entry.maxOrderQty,
      tags: (entry.tags || []).join(', '),
      isActive: entry.isActive
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Corporate Catalog</h1>
          <p className="text-sm text-theme-muted">{catalog.length} products in corporate catalog</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-card border border-edge/50 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Add Product to Corporate Catalog</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
            <input type="text" value={search} onChange={e => searchProducts(e.target.value)} placeholder="Search product by name..."
              className="w-full pl-10 pr-4 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-edge rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {searchResults.map(p => (
                  <button key={p._id} type="button" onClick={() => selectProduct(p)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-inset/50 transition-colors">
                    {p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="w-8 h-8 rounded object-cover" />}
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-theme-dim">Rs. {p.price}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-theme-dim mb-1">Corporate Price</label>
              <input type="number" value={addForm.corporatePrice} onChange={e => setAddForm({ ...addForm, corporatePrice: e.target.value })} placeholder="Leave empty = regular"
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Min Qty</label>
              <input type="number" value={addForm.minOrderQty} onChange={e => setAddForm({ ...addForm, minOrderQty: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Max Qty</label>
              <input type="number" value={addForm.maxOrderQty} onChange={e => setAddForm({ ...addForm, maxOrderQty: e.target.value })}
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
            <div>
              <label className="block text-xs text-theme-dim mb-1">Tags (comma-separated)</label>
              <input type="text" value={addForm.tags} onChange={e => setAddForm({ ...addForm, tags: e.target.value })} placeholder="diwali, welcome-kit"
                className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addLoading || !addForm.productId}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-2">
              {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setSearch(''); }}
              className="px-4 py-2 border border-edge rounded-lg text-sm text-theme-muted hover:text-theme-primary">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" /></div>
      ) : catalog.length === 0 ? (
        <div className="text-center py-12 text-theme-muted">
          <Package className="w-12 h-12 mx-auto mb-3 text-theme-dim" />
          <p>No products in corporate catalog yet</p>
        </div>
      ) : (
        <div className="bg-card border border-edge/50 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge/30 text-left text-theme-dim">
                <th className="p-4">Product</th>
                <th className="p-4">Regular Price</th>
                <th className="p-4">Corporate Price</th>
                <th className="p-4">Min Qty</th>
                <th className="p-4">Max Qty</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Active</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/20">
              {catalog.map(entry => (
                <tr key={entry._id} className="hover:bg-inset/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {entry.productId?.images?.[0]?.url && <img src={entry.productId.images[0].url} alt="" className="w-10 h-10 rounded object-cover" />}
                      <div>
                        <p className="font-medium truncate max-w-[200px]">{entry.productId?.title || 'Deleted'}</p>
                        <p className="text-xs text-theme-dim">Stock: {entry.productId?.stock ?? '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-theme-muted">Rs. {entry.productId?.price?.toLocaleString() || '-'}</td>
                  <td className="p-4">
                    {editId === entry._id ? (
                      <input type="number" value={editForm.corporatePrice} onChange={e => setEditForm({ ...editForm, corporatePrice: e.target.value })}
                        className="w-24 px-2 py-1 bg-inset border border-edge rounded text-sm" placeholder="Null" />
                    ) : (
                      <span className={entry.corporatePrice ? 'text-green-400 font-medium' : 'text-theme-dim'}>
                        {entry.corporatePrice ? 'Rs. ' + entry.corporatePrice.toLocaleString() : 'Regular'}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {editId === entry._id ? (
                      <input type="number" value={editForm.minOrderQty} onChange={e => setEditForm({ ...editForm, minOrderQty: e.target.value })}
                        className="w-20 px-2 py-1 bg-inset border border-edge rounded text-sm" />
                    ) : entry.minOrderQty}
                  </td>
                  <td className="p-4">
                    {editId === entry._id ? (
                      <input type="number" value={editForm.maxOrderQty} onChange={e => setEditForm({ ...editForm, maxOrderQty: e.target.value })}
                        className="w-20 px-2 py-1 bg-inset border border-edge rounded text-sm" />
                    ) : entry.maxOrderQty}
                  </td>
                  <td className="p-4">
                    {editId === entry._id ? (
                      <input type="text" value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                        className="w-32 px-2 py-1 bg-inset border border-edge rounded text-sm" />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags?.map(tag => (
                          <span key={tag} className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={'text-xs ' + (entry.isActive ? 'text-green-400' : 'text-red-400')}>{entry.isActive ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="p-4">
                    {editId === entry._id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdate(entry._id)} className="p-1 text-green-400 hover:text-green-300"><Save className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-theme-muted hover:text-theme-primary"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(entry)} className="p-1 text-theme-muted hover:text-amber-400"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => handleRemove(entry._id)} className="p-1 text-theme-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
