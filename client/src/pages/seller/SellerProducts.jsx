import { useState, useEffect } from 'react';
import { Package, Plus, Edit3, Trash2, Eye, EyeOff, Loader, X, Upload, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function SellerProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = { title: '', description: '', price: '', category: '', stock: '', weight: '', images: [] };
  const [form, setForm] = useState(emptyForm);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => { loadProducts(); loadCategories(); }, []);

  const loadProducts = async () => {
    try {
      const { data } = await API.get('/api/seller/products');
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      const { data } = await API.get('/api/products/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const openForm = (product = null) => {
    if (product) {
      setEditing(product._id);
      setForm({ title: product.title, description: product.description, price: product.price, category: product.category, stock: product.stock, weight: product.weight || '', images: product.images || [] });
      setImagePreviews(product.images?.map(i => i.url) || []);
    } else {
      setEditing(null);
      setForm(emptyForm);
      setImagePreviews([]);
    }
    setImageFiles([]);
    setShowForm(true);
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    files.forEach(f => setImagePreviews(prev => [...prev, URL.createObjectURL(f)]));
  };

  const removeImage = (idx) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
    if (idx < (form.images?.length || 0)) {
      setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
    } else {
      const fileIdx = idx - (form.images?.length || 0);
      setImageFiles(prev => prev.filter((_, i) => i !== fileIdx));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category || !form.stock) return toast.error('Fill required fields');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('price', form.price);
      formData.append('category', form.category);
      formData.append('stock', form.stock);
      if (form.weight) formData.append('weight', form.weight);
      if (form.images) formData.append('existingImages', JSON.stringify(form.images));
      imageFiles.forEach(f => formData.append('images', f));

      if (editing) {
        await API.put(`/api/seller/products/${editing}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product updated');
      } else {
        await API.post('/api/seller/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product created');
      }
      setShowForm(false);
      loadProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  const toggleActive = async (id, isActive) => {
    try {
      await API.put(`/api/seller/products/${id}`, { isActive: !isActive });
      loadProducts();
      toast.success(isActive ? 'Product hidden' : 'Product visible');
    } catch (e) { toast.error('Failed'); }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await API.delete(`/api/seller/products/${id}`);
      loadProducts();
      toast.success('Deleted');
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Products</h1>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

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
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} min="200" className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
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
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Weight (grams)</label>
                  <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
              {/* Images */}
              <div>
                <label className="text-xs text-theme-muted font-medium mb-2 block">Images</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {imagePreviews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-inset border border-edge">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-edge hover:border-amber-500/50 flex items-center justify-center cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 text-theme-dim" />
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
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
