import { useState } from 'react';
import { useCorporateAuth } from '../../context/CorporateAuthContext';
import { corporateAPI } from '../../api';
import { Send, Loader2, CheckCircle } from 'lucide-react';

export default function CorporateInquiry() {
  const { user } = useCorporateAuth();
  const [form, setForm] = useState({
    companyName: user?.companyName || '',
    contactPerson: user?.contactPerson || '',
    email: user?.email || '',
    phone: user?.phone || '',
    numberOfEmployees: '',
    budgetPerGift: '',
    quantityNeeded: '',
    occasion: '',
    specialRequirements: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await corporateAPI.submitInquiry(form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit inquiry');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Inquiry Submitted!</h2>
        <p className="text-theme-muted max-w-md mx-auto">Thank you! Our team will get back to you within 24 hours with a customized quote.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submit a New Inquiry</h1>
        <p className="text-sm text-theme-muted">Need a custom order? Tell us your requirements and we'll prepare a personalized quote.</p>
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-card border border-edge/50 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Company Name *</label>
            <input type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} required
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Contact Person *</label>
            <input type="text" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} required
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Phone *</label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Number of Employees</label>
            <input type="text" value={form.numberOfEmployees} onChange={e => setForm({ ...form, numberOfEmployees: e.target.value })}
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Budget per Gift</label>
            <input type="text" value={form.budgetPerGift} onChange={e => setForm({ ...form, budgetPerGift: e.target.value })} placeholder="Rs."
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Quantity Needed</label>
            <input type="text" value={form.quantityNeeded} onChange={e => setForm({ ...form, quantityNeeded: e.target.value })}
              className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">Occasion</label>
          <select value={form.occasion} onChange={e => setForm({ ...form, occasion: e.target.value })}
            className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">
            <option value="">Select occasion</option>
            <option value="diwali">Diwali</option>
            <option value="new-year">New Year</option>
            <option value="christmas">Christmas</option>
            <option value="employee-welcome">Employee Welcome Kit</option>
            <option value="anniversary">Company Anniversary</option>
            <option value="appreciation">Employee Appreciation</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1">Special Requirements</label>
          <textarea value={form.specialRequirements} onChange={e => setForm({ ...form, specialRequirements: e.target.value })} rows={4} placeholder="Any customization, branding, or special packaging requirements..."
            className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Inquiry</>}
        </button>
      </form>
    </div>
  );
}
