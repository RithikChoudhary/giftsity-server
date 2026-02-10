import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import SEO from '../../components/SEO';
import API from '../../api';

export default function Contact() {
  const [info, setInfo] = useState({});
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    API.get('/store/info').then(r => setInfo(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return toast.error('Please fill required fields');
    setSending(true);
    try {
      await API.post('/b2b/inquiries', {
        companyName: form.name,
        contactPerson: form.name,
        email: form.email,
        phone: '-',
        specialRequirements: `[CONTACT FORM] Subject: ${form.subject}\n\n${form.message}`,
        occasion: 'General Inquiry'
      });
      toast.success('Message sent! We\'ll get back to you soon.');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      toast.error('Failed to send. Please email us directly.');
    }
    setSending(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <SEO title="Contact Us" description="Get in touch with Giftsity. Questions about orders, selling, corporate gifting, or partnerships — we're here to help." />
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-theme-primary mb-3">Contact Us</h1>
        <p className="text-theme-muted max-w-xl mx-auto">Have a question, feedback, or need help with an order? We'd love to hear from you.</p>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Contact Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-edge/50 rounded-2xl p-6 space-y-5">
            {info.supportEmail && (
              <a href={`mailto:${info.supportEmail}`} className="flex items-start gap-3 group">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-theme-primary">Email</p>
                  <p className="text-sm text-theme-muted group-hover:text-amber-400 transition-colors">{info.supportEmail}</p>
                </div>
              </a>
            )}
            {info.supportPhone && (
              <a href={`tel:${info.supportPhone}`} className="flex items-start gap-3 group">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-theme-primary">Phone</p>
                  <p className="text-sm text-theme-muted group-hover:text-amber-400 transition-colors">{info.supportPhone}</p>
                </div>
              </a>
            )}
            {info.whatsappNumber && (
              <a href={`https://wa.me/${info.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-theme-primary">WhatsApp</p>
                  <p className="text-sm text-theme-muted group-hover:text-green-400 transition-colors">Chat with us</p>
                </div>
              </a>
            )}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-theme-primary">Location</p>
                <p className="text-sm text-theme-muted">India</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 text-center">
            <p className="text-sm font-medium text-theme-primary mb-1">Business Hours</p>
            <p className="text-xs text-theme-muted">Mon - Sat: 10 AM - 7 PM IST</p>
            <p className="text-xs text-theme-muted">Sunday: Closed</p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-3">
          <form onSubmit={handleSubmit} className="bg-card border border-edge/50 rounded-2xl p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-theme-muted mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-muted mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  placeholder="you@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-muted mb-1.5">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full px-3 py-2.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="How can we help?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-muted mb-1.5">Message *</label>
              <textarea
                rows={5}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full px-3 py-2.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
                placeholder="Tell us more..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
