import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Gift, Mail, ArrowRight, Loader, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';

export default function Auth() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState('email'); // email | otp
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (user) {
      const redirect = searchParams.get('redirect') || '/';
      if (user.userType === 'admin') navigate('/admin');
      else if (user.userType === 'seller') navigate('/seller');
      else navigate(redirect);
    }
  }, [user]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startResendTimer = useCallback(() => {
    setResendTimer(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!email) return toast.error('Enter your email');
    submittingRef.current = true;
    setLoading(true);
    try {
      const { data } = await API.post('/auth/send-otp', { email });
      setIsNew(data.isNew);
      setStep('otp');
      startResendTimer();
      toast.success('OTP sent to your email!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    }
    submittingRef.current = false;
    setLoading(false);
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await API.post('/auth/send-otp', { email });
      setOtp('');
      startResendTimer();
      toast.success('New OTP sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!otp.trim()) return toast.error('Enter OTP');
    if (isNew && !name.trim()) return toast.error('Enter your name');
    if (isNew && !/^[0-9]{10}$/.test(phone.trim())) return toast.error('Enter a valid 10-digit phone number');
    submittingRef.current = true;
    setLoading(true);
    try {
      const body = { email, otp: otp.trim() };
      if (isNew) { body.name = name; body.phone = phone; }
      const { data } = await API.post('/auth/verify-otp', body);
      login(data.token, data.user);
      toast.success(`Welcome${isNew ? '' : ' back'}, ${data.user.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      submittingRef.current = false; // Allow retry only on failure
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 rounded-2xl mb-4">
            <Gift className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-theme-primary">Welcome to Giftsity</h1>
          <p className="text-sm text-theme-muted mt-1">Sign in with your email</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="text-xs text-theme-muted font-medium mb-1 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-10 pr-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" autoFocus />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <p className="text-sm text-theme-muted text-center mb-2">OTP sent to <span className="text-theme-primary font-medium">{email}</span></p>
            {isNew && (
              <>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Your Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-theme-muted font-medium mb-1 block">Phone Number *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={10} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-theme-muted font-medium mb-1 block">Enter OTP</label>
              <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="w-full px-4 py-2.5 bg-card border border-edge rounded-xl text-sm text-theme-primary text-center tracking-[0.5em] font-mono placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" autoFocus />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
            </button>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { setStep('email'); setOtp(''); }} className="text-sm text-theme-muted hover:text-theme-primary transition-colors">Change email</button>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendTimer > 0 || loading}
                className="text-sm text-amber-400 hover:text-amber-300 disabled:text-theme-dim disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>
            <p className="text-[11px] text-theme-dim text-center">OTP expires in 10 minutes</p>
          </form>
        )}
      </div>
    </div>
  );
}
