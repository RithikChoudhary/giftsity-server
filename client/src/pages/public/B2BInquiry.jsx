import { useState } from 'react';
import { Briefcase, Send, CheckCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import API from '../../api';

export default function B2BInquiry() {
  const [form, setForm] = useState({ companyName: '', contactPerson: '', email: '', phone: '', numberOfEmployees: '', budgetPerGift: '', quantityNeeded: '', occasion: '', specialRequirements: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyName || !form.contactPerson || !form.email || !form.phone) return toast.error('Fill all required fields');
    setLoading(true);
    try {
      await API.post('/b2b/inquiries', form);
      setSubmitted(true);
      toast.success('Inquiry submitted!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    setLoading(false);
  };

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-theme-primary mb-2">Thank You!</h2>
      <p className="text-theme-muted">We've received your corporate gifting inquiry. Our team will contact you within 24 hours.</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <SEO title="Corporate Gifting" description="Get custom quotes for bulk corporate gifting. Employee rewards, client gifts, event gifts and more. Tailored solutions for Indian businesses." />
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 rounded-2xl mb-4"><Briefcase className="w-7 h-7 text-amber-400" /></div>
        <h1 className="text-3xl font-bold text-theme-primary">Corporate Gifting</h1>
        <p className="text-theme-muted mt-2">Custom gift solutions for your team. Bulk orders, branded packaging, and more.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-edge/50 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Company Name *</label>
            <input type="text" value={form.companyName} onChange={e => update('companyName', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Contact Person *</label>
            <input type="text" value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Email *</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Phone *</label>
            <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Number of Employees</label>
            <input type="number" value={form.numberOfEmployees} onChange={e => update('numberOfEmployees', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Quantity Needed</label>
            <input type="number" value={form.quantityNeeded} onChange={e => update('quantityNeeded', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Budget Per Gift</label>
            <select value={form.budgetPerGift} onChange={e => update('budgetPerGift', e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50">
              <option value="">Select range</option>
              <option value="500-1000">Rs. 500 - 1,000</option>
              <option value="1000-2000">Rs. 1,000 - 2,000</option>
              <option value="2000-5000">Rs. 2,000 - 5,000</option>
              <option value="5000+">Rs. 5,000+</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-theme-muted font-medium mb-1 block">Occasion</label>
            <input type="text" value={form.occasion} onChange={e => update('occasion', e.target.value)} placeholder="Diwali, Employee Anniversary..." className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-theme-muted font-medium mb-1 block">Special Requirements</label>
          <textarea value={form.specialRequirements} onChange={e => update('specialRequirements', e.target.value)} rows={4} placeholder="Branding, customization, delivery timeline..." className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50 resize-none" />
        </div>
        <button type="submit" disabled={loading} className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Inquiry</>}
        </button>
      </form>
    </div>
  );
}
