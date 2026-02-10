import { useState, useEffect } from 'react';
import { Briefcase, Phone, Mail, Building, Calendar, ChevronDown, Loader, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import API from '../../api';

const statusColors = {
  new: 'text-blue-400 bg-blue-400/10',
  contacted: 'text-yellow-400 bg-yellow-400/10',
  quoted: 'text-purple-400 bg-purple-400/10',
  converted: 'text-green-400 bg-green-400/10',
  lost: 'text-red-400 bg-red-400/10',
};

export default function AdminB2B() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => { loadInquiries(); }, []);

  const loadInquiries = async () => {
    try {
      const { data } = await API.get('/api/admin/b2b');
      setInquiries(Array.isArray(data) ? data : data.inquiries || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await API.put(`/api/admin/b2b/${id}`, { status });
      toast.success(`Status updated to ${status}`);
      loadInquiries();
    } catch (err) { toast.error('Failed'); }
  };

  const addNote = async (id) => {
    if (!noteText.trim()) return;
    try {
      await API.put(`/api/admin/b2b/${id}`, { adminNotes: noteText });
      toast.success('Note added');
      setNoteText('');
      loadInquiries();
    } catch (err) { toast.error('Failed'); }
  };

  const filtered = filter === 'all' ? inquiries : inquiries.filter(i => i.status === filter);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">B2B Inquiries ({inquiries.length})</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'new', 'contacted', 'quoted', 'converted', 'lost'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>
            {f} ({f === 'all' ? inquiries.length : inquiries.filter(i => i.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-edge/50 rounded-xl">
          <Briefcase className="w-12 h-12 text-theme-dim mx-auto mb-3" />
          <p className="text-theme-muted">No inquiries found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inq => (
            <div key={inq._id} className="bg-card border border-edge/50 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-amber-400" />
                    <h3 className="font-semibold text-theme-primary">{inq.companyName}</h3>
                  </div>
                  <p className="text-xs text-theme-muted mt-0.5">{inq.contactPerson} &middot; {new Date(inq.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inq.status] || 'bg-inset text-theme-muted'}`}>{inq.status}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-theme-muted mb-3">
                <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {inq.email}</div>
                <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {inq.phone}</div>
                {inq.quantityNeeded && <div>Qty: {inq.quantityNeeded}</div>}
                {inq.budgetPerGift && <div>Budget: Rs. {inq.budgetPerGift}</div>}
              </div>

              {inq.occasion && <p className="text-xs text-theme-dim mb-2">Occasion: {inq.occasion}</p>}
              {inq.specialRequirements && <p className="text-xs text-theme-secondary mb-2">"{inq.specialRequirements}"</p>}

              <button onClick={() => setExpandedId(expandedId === inq._id ? null : inq._id)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-3">
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedId === inq._id ? 'rotate-180' : ''}`} />
                Actions
              </button>

              {expandedId === inq._id && (
                <div className="animate-fade-in space-y-3 pt-3 border-t border-edge/50">
                  <div>
                    <p className="text-xs text-theme-muted mb-2">Update Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {['new', 'contacted', 'quoted', 'converted', 'lost'].map(s => (
                        <button key={s} onClick={() => updateStatus(inq._id, s)} className={`px-2 py-1 rounded text-xs font-medium ${inq.status === s ? 'bg-amber-500 text-zinc-950' : 'bg-inset text-theme-muted hover:text-theme-primary'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-theme-muted mb-2">Admin Notes</p>
                    {inq.adminNotes && <p className="text-xs text-theme-secondary bg-inset/50 rounded-lg p-2 mb-2">{inq.adminNotes}</p>}
                    <div className="flex gap-2">
                      <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add note..." className="flex-1 px-3 py-1.5 bg-inset border border-edge rounded-lg text-xs text-theme-primary placeholder:text-theme-dim" />
                      <button onClick={() => addNote(inq._id)} className="px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-medium">Save</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
