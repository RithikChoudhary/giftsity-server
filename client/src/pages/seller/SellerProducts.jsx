import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, Edit3, Trash2, Eye, EyeOff, Loader, X, Upload, Image, Film, FileSpreadsheet, CreditCard, ArrowRight, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API, { SellerAPI, sellerAPI } from '../../api';

export default function SellerProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = { title: '', description: '', price: '', category: '', stock: '', weight: '', shippingPaidBy: 'seller', images: [], isCustomizable: false, customizationOptions: [] };
  const [form, setForm] = useState(emptyForm);
  const [mediaFiles, setMediaFiles] = useState([]); // { file, type: 'image'|'video' }
  const [mediaPreviews, setMediaPreviews] = useState([]); // { url, type: 'image'|'video', isExisting: bool }
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const csvRef = useRef(null);
  const [minPrice, setMinPrice] = useState(200); // dynamic from platform settings
  const [bankDetailsComplete, setBankDetailsComplete] = useState(true);
  const [pickupAddressComplete, setPickupAddressComplete] = useState(true);

  useEffect(() => { loadProducts(); loadCategories(); loadMinPrice(); }, []);

  const canCreateProduct = bankDetailsComplete && pickupAddressComplete;

  const loadMinPrice = async () => {
    try {
      const { data } = await SellerAPI.get('/dashboard');
      if (data.minimumProductPrice) setMinPrice(data.minimumProductPrice);
      if (data.bankDetailsComplete !== undefined) setBankDetailsComplete(data.bankDetailsComplete);
      if (data.pickupAddressComplete !== undefined) setPickupAddressComplete(data.pickupAddressComplete);
    } catch (e) { /* fallback to default */ }
  };

  const loadProducts = async () => {
    try {
      const { data } = await SellerAPI.get('/products');
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      const { data } = await API.get('/products/categories');
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (e) { console.error(e); }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { toast.error('Please select a CSV file'); return; }
    setCsvUploading(true);
    setCsvResult(null);
    try {
      const fd = new FormData();
      fd.append('csv', file);
      const { data } = await sellerAPI.bulkCsvUpload(fd);
      setCsvResult(data);
      toast.success(data.message);
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'CSV upload failed');
    } finally {
      setCsvUploading(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  };

  const openForm = (product = null) => {
    if (product) {
      setEditing(product._id);
      setForm({ title: product.title, description: product.description, price: product.price, category: product.category, stock: product.stock, weight: product.weight || '', shippingPaidBy: product.shippingPaidBy || 'seller', images: product.images || [], isCustomizable: product.isCustomizable || false, customizationOptions: product.customizationOptions || [] });
      // Build previews from existing images + media
      const existingPreviews = (product.images || []).map(i => ({ url: i.url, type: 'image', isExisting: true }));
      const existingMedia = (product.media || []).filter(m => m.type === 'video').map(m => ({ url: m.thumbnailUrl || m.url, type: 'video', isExisting: true }));
      setMediaPreviews([...existingPreviews, ...existingMedia]);
    } else {
      setEditing(null);
      setForm(emptyForm);
      setMediaPreviews([]);
    }
    setMediaFiles([]);
    setShowForm(true);
  };

  const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      const isVideo = f.type.startsWith('video/');
      if (isVideo && f.size > MAX_VIDEO_SIZE) {
        toast.error(`Video "${f.name}" is too large (${(f.size / (1024 * 1024)).toFixed(1)}MB). Max 30MB.`);
        return;
      }
      setMediaFiles(prev => [...prev, { file: f, type: isVideo ? 'video' : 'image' }]);
      setMediaPreviews(prev => [...prev, { url: URL.createObjectURL(f), type: isVideo ? 'video' : 'image', isExisting: false }]);
    });
  };

  const removeMedia = (idx) => {
    const preview = mediaPreviews[idx];
    setMediaPreviews(prev => prev.filter((_, i) => i !== idx));
    if (preview?.isExisting) {
      // Remove from existing images in form
      const existingImageCount = form.images?.length || 0;
      if (idx < existingImageCount) {
        setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
      }
    } else {
      // Remove from new files
      const existingCount = mediaPreviews.filter(p => p.isExisting).length;
      const fileIdx = idx - existingCount;
      setMediaFiles(prev => prev.filter((_, i) => i !== fileIdx));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category || !form.stock) return toast.error('Fill required fields');
    if (Number(form.price) < minPrice) return toast.error(`Minimum product price is Rs. ${minPrice}`);
    if (!form.weight || Number(form.weight) <= 0) return toast.error('Weight is required for shipping calculation');
    if (form.isCustomizable && form.customizationOptions.length > 0) {
      const emptyLabel = form.customizationOptions.find(opt => !opt.label?.trim());
      if (emptyLabel) return toast.error('All customization options must have a label');
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('price', form.price);
      formData.append('category', form.category);
      formData.append('stock', form.stock);
      if (form.weight) formData.append('weight', form.weight);
      formData.append('shippingPaidBy', form.shippingPaidBy || 'seller');
      formData.append('isCustomizable', form.isCustomizable ? 'true' : 'false');
      if (form.isCustomizable && form.customizationOptions.length > 0) {
        formData.append('customizationOptions', JSON.stringify(form.customizationOptions));
      }
      if (form.images) formData.append('existingImages', JSON.stringify(form.images));
      mediaFiles.forEach(({ file }) => formData.append('media', file));

      if (editing) {
        await SellerAPI.put(`/products/${editing}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product updated');
      } else {
        await SellerAPI.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product created');
      }
      setShowForm(false);
      loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  const toggleActive = async (id, isActive) => {
    try {
      await SellerAPI.put(`/products/${id}`, { isActive: !isActive });
      loadProducts();
      toast.success(isActive ? 'Product hidden' : 'Product visible');
    } catch (e) { toast.error('Failed'); }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await SellerAPI.delete(`/products/${id}`);
      loadProducts();
      toast.success('Deleted');
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Products</h1>
        <div className="flex items-center gap-2">
          <input type="file" accept=".csv" ref={csvRef} onChange={handleCsvUpload} className="hidden" />
          <button onClick={() => csvRef.current?.click()} disabled={csvUploading}
            className="flex items-center gap-2 px-4 py-2 border border-edge/30 text-theme-muted hover:text-theme-primary rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            {csvUploading ? <Loader className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Import CSV
          </button>
          <button onClick={() => { if (!canCreateProduct) { toast.error(!bankDetailsComplete ? 'Add bank details in Settings first' : 'Add pickup address in Settings first'); return; } openForm(); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${canCreateProduct ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950' : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'}`}>
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Setup required banners */}
      {!bankDetailsComplete && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-400">Bank Details Required</p>
            <p className="text-sm text-theme-muted mt-1">You must add your bank account details before you can create products.</p>
            <Link to="/seller/settings" className="inline-flex items-center gap-1 mt-2 px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors">
              Go to Settings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
      {!pickupAddressComplete && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-400">Pickup Address Required</p>
            <p className="text-sm text-theme-muted mt-1">You must add your pickup address before you can create products. This is needed for shipping.</p>
            <Link to="/seller/settings" className="inline-flex items-center gap-1 mt-2 px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors">
              Go to Settings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* CSV Import Result */}
      {csvResult && (
        <div className="p-4 rounded-xl bg-inset/50 border border-edge/30 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{csvResult.message}</p>
            <button onClick={() => setCsvResult(null)} className="text-theme-dim hover:text-theme-primary"><X className="w-4 h-4" /></button>
          </div>
          {csvResult.errors?.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {csvResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">Row {e.row}: {e.error}</p>
              ))}
            </div>
          )}
          <p className="text-xs text-theme-dim">CSV format: title, description, price, stock, category, sku, tags (semicolon-separated), compareatprice</p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-edge rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-theme-primary">{editing ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setShowForm(false)} className="text-theme-dim hover:text-theme-primary"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Price (Rs.) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} min={minPrice} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Stock *</label>
                  <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} min="0" className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c._id || c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Weight (grams) *</label>
                  <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} min="1" placeholder="e.g. 500" className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
                  <p className="text-[10px] text-theme-dim mt-1">Required for shipping rate calculation</p>
                </div>
              </div>
              {/* Shipping */}
              <div className="bg-inset/50 border border-edge/50 rounded-xl p-4">
                <label className="text-xs text-theme-muted font-medium mb-2 block">Who pays for shipping?</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setForm(f => ({ ...f, shippingPaidBy: 'seller' }))}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors ${form.shippingPaidBy === 'seller' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-edge bg-inset text-theme-muted hover:text-theme-primary'}`}>
                    I'll pay
                    <span className="block text-[10px] mt-0.5 opacity-70">Free shipping for customers</span>
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, shippingPaidBy: 'customer' }))}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors ${form.shippingPaidBy === 'customer' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-edge bg-inset text-theme-muted hover:text-theme-primary'}`}>
                    Customer pays
                    <span className="block text-[10px] mt-0.5 opacity-70">Shipping fee added at checkout</span>
                  </button>
                </div>
              </div>
              {/* Customization */}
              <div className="bg-inset/50 border border-edge/50 rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isCustomizable} onChange={e => setForm(f => ({ ...f, isCustomizable: e.target.checked, customizationOptions: e.target.checked ? f.customizationOptions : [] }))} className="rounded border-edge text-amber-500 focus:ring-amber-500" />
                  <span className="text-xs font-medium text-theme-primary">Customizable Product</span>
                  <span className="text-[10px] text-theme-dim">(name, photos, color, etc.)</span>
                </label>
                {form.isCustomizable && (
                  <div className="space-y-3">
                    {form.customizationOptions.map((opt, idx) => (
                      <div key={idx} className="bg-card border border-edge/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-theme-dim">Option {idx + 1}</span>
                          <button type="button" onClick={() => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Label (e.g. Name on bag)" value={opt.label} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, label: e.target.value } : o) }))} className="px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary focus:outline-none focus:border-amber-500/50" />
                          <select value={opt.type} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, type: e.target.value } : o) }))} className="px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary focus:outline-none focus:border-amber-500/50">
                            <option value="text">Text Input</option>
                            <option value="image">Image Upload</option>
                            <option value="select">Dropdown</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" placeholder="Placeholder text" value={opt.placeholder || ''} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, placeholder: e.target.value } : o) }))} className="px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary focus:outline-none col-span-2" />
                          <input type="number" placeholder="Extra Rs." value={opt.extraPrice || ''} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, extraPrice: Number(e.target.value) || 0 } : o) }))} className="px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary focus:outline-none" />
                        </div>
                        {opt.type === 'select' && (
                          <input type="text" placeholder="Options (comma separated, e.g. Red,Blue,Green)" value={(opt.selectOptions || []).join(',')} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, selectOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : o) }))} className="w-full px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary focus:outline-none" />
                        )}
                        {opt.type === 'image' && (
                          <input type="number" placeholder="Max files (default 5)" value={opt.maxFiles || ''} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, maxFiles: Number(e.target.value) || 5 } : o) }))} className="w-full px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary focus:outline-none" />
                        )}
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={opt.required || false} onChange={e => setForm(f => ({ ...f, customizationOptions: f.customizationOptions.map((o, i) => i === idx ? { ...o, required: e.target.checked } : o) }))} className="rounded border-edge text-amber-500 focus:ring-amber-500" />
                          <span className="text-[10px] text-theme-muted">Required</span>
                        </label>
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm(f => ({ ...f, customizationOptions: [...f.customizationOptions, { label: '', type: 'text', required: false, placeholder: '', maxLength: 100, maxFiles: 5, selectOptions: [], extraPrice: 0 }] }))} className="w-full py-2 border-2 border-dashed border-edge hover:border-amber-500/50 rounded-lg text-xs text-theme-muted hover:text-amber-400 transition-colors">
                      + Add Customization Option
                    </button>
                  </div>
                )}
              </div>
              {/* Images & Videos */}
              <div>
                <label className="text-xs text-theme-muted font-medium mb-2 block">Images & Videos</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {mediaPreviews.map((preview, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-inset border border-edge">
                      {preview.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                          <Film className="w-6 h-6 text-amber-400" />
                          <span className="absolute bottom-0.5 left-0.5 text-[8px] text-white bg-black/60 px-1 rounded">Video</span>
                        </div>
                      ) : (
                        <img src={preview.url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button type="button" onClick={() => removeMedia(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-edge hover:border-amber-500/50 flex flex-col items-center justify-center cursor-pointer transition-colors gap-0.5">
                    <Upload className="w-5 h-5 text-theme-dim" />
                    <span className="text-[8px] text-theme-dim">IMG/VID</span>
                    <input type="file" accept="image/*,video/mp4,video/webm" multiple onChange={handleMediaChange} className="hidden" />
                  </label>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : editing ? 'Update Product' : 'Create Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Package className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No products yet. Add your first product!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p._id} className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-inset rounded-lg overflow-hidden shrink-0">
                {p.images?.[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <Image className="w-6 h-6 text-theme-dim m-auto mt-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-theme-primary truncate">{p.title}</h3>
                  {!p.isActive && <span className="px-1.5 py-0.5 bg-inset text-theme-dim text-[10px] rounded">Hidden</span>}
                </div>
                <p className="text-xs text-theme-muted mt-0.5">Rs. {p.price?.toLocaleString('en-IN')} &middot; Stock: {p.stock} &middot; {p.category}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleActive(p._id, p.isActive)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-theme-primary" title={p.isActive ? 'Hide' : 'Show'}>
                  {p.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => openForm(p)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-theme-primary"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => deleteProduct(p._id)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
