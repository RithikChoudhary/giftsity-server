import { useState, useEffect } from 'react';
import { FolderTree, Plus, Edit3, Trash2, X, Loader, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '', displayOrder: 0 });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const { data } = await API.get('/admin/categories');
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openForm = (cat = null) => {
    if (cat) {
      setEditing(cat._id);
      setForm({ name: cat.name || '', description: cat.description || '', icon: cat.icon || '', displayOrder: cat.displayOrder || 0 });
    } else {
      setEditing(null);
      setForm({ name: '', description: '', icon: '', displayOrder: 0 });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Category name is required');
    setSubmitting(true);
    try {
      if (editing) {
        await API.put(`/admin/categories/${editing}`, form);
        toast.success('Category updated');
      } else {
        await API.post('/admin/categories', form);
        toast.success('Category created');
      }
      setShowForm(false);
      loadCategories();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await API.delete(`/admin/categories/${id}`);
      toast.success('Deleted');
      loadCategories();
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Categories ({categories.length})</h1>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-edge rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-theme-primary">{editing ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowForm(false)} className="text-theme-dim hover:text-theme-primary"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Icon (emoji)</label>
                  <input type="text" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🎁" className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Display Order</label>
                  <input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: +e.target.value }))} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : editing ? 'Update' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Categories list */}
      {categories.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <FolderTree className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No categories yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map(cat => (
            <div key={cat._id} className="bg-card border border-edge/50 rounded-xl p-4 flex items-center gap-4">
              <div className="text-2xl w-10 h-10 flex items-center justify-center bg-inset rounded-lg">{cat.icon || '🎁'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-theme-primary">{cat.name}</h3>
                  <span className="text-xs text-theme-dim">({cat.productCount || 0} products)</span>
                  {!cat.isActive && <span className="px-1.5 py-0.5 bg-inset text-theme-dim text-[10px] rounded">Hidden</span>}
                </div>
                {cat.description && <p className="text-xs text-theme-muted mt-0.5">{cat.description}</p>}
                <p className="text-[10px] text-theme-dim mt-0.5">Slug: {cat.slug} &middot; Order: {cat.displayOrder || 0}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openForm(cat)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-theme-primary"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => deleteCategory(cat._id)} className="p-2 rounded-lg bg-inset text-theme-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
