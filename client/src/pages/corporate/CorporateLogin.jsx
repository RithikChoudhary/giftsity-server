import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCorporateAuth } from '../../context/CorporateAuthContext';
import { corporateAPI } from '../../api';
import { Gift, Building2, ArrowRight, Loader2, Mail, KeyRound } from 'lucide-react';

export default function CorporateLogin() {
  const [step, setStep] = useState('email'); // email | otp | register
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [form, setForm] = useState({ companyName: '', contactPerson: '', phone: '', designation: '', companySize: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useCorporateAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await corporateAPI.sendOtp(email);
      setIsNewUser(res.data.isNewUser);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (isNewUser) {
      setStep('register');
      return;
    }
    setLoading(true);
    try {
      const res = await corporateAPI.verifyOtp({ email, otp });
      login(res.data.token, res.data.user);
      navigate('/corporate');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.companyName || !form.contactPerson) {
      setError('Company name and contact person are required');
      return;
    }
    setLoading(true);
    try {
      const res = await corporateAPI.verifyOtp({ email, otp, ...form });
      login(res.data.token, res.data.user);
      navigate('/corporate');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Gift className="w-8 h-8 text-amber-400" />
            <span className="text-2xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Giftsity</span>
          </Link>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-theme-primary">Corporate Portal</h1>
          </div>
          <p className="text-sm text-theme-muted">Sign in with your corporate email to access bulk gifting</p>
        </div>

        <div className="bg-card border border-edge/50 rounded-2xl p-6 shadow-lg">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Corporate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourcompany.com" required
                    className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                </div>
                <p className="text-xs text-theme-dim mt-1.5">Personal emails (Gmail, Yahoo, etc.) are not accepted</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Send OTP</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-theme-muted">OTP sent to <strong className="text-theme-primary">{email}</strong></p>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">Enter OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={6} required
                    className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded-lg text-sm text-theme-primary tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                </div>
              </div>
              <button type="submit" disabled={loading || otp.length < 6}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="w-full py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors">Change email</button>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-sm text-amber-400 font-medium">Welcome! Complete your company profile:</p>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Company Name *</label>
                <input type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} required
                  className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Contact Person *</label>
                <input type="text" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} required
                  className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Designation</label>
                  <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Company Size</label>
                <select value={form.companySize} onChange={e => setForm({ ...form, companySize: e.target.value })}
                  className="w-full px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-amber-400/50">
                  <option value="">Select</option>
                  <option value="1-50">1-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-1000">201-1000 employees</option>
                  <option value="1000+">1000+ employees</option>
                </select>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-theme-dim mt-4">
          Want to place a one-time order? <Link to="/b2b" className="text-amber-400 hover:underline">Submit an inquiry</Link>
        </p>
      </div>
    </div>
  );
}
