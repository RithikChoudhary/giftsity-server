import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Gift, ArrowRight, Check, Loader, Upload, Instagram, Mail, Phone, Store, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';

export default function SellerJoin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('info'); // info | otp | details
  const [loading, setLoading] = useState(false);

  // Step 1: basic info
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Step 2: seller details
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('individual');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  useEffect(() => {
    if (user?.userType === 'seller') navigate('/seller');
  }, [user]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email || !name || !phone) return toast.error('Fill all required fields');
    setLoading(true);
    try {
      await API.post('/api/auth/send-otp', { email });
      setOtpSent(true);
      setStep('otp');
      toast.success('OTP sent to your email!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) return toast.error('Enter OTP');
    setLoading(true);
    try {
      const { data } = await API.post('/api/auth/verify-otp', { email, otp, name, phone, userType: 'seller' });
      login(data.token, data.user);
      setStep('details');
      toast.success('Email verified!');
    } catch (err) { toast.error(err.response?.data?.message || 'Invalid OTP'); }
    setLoading(false);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitDetails = async (e) => {
    e.preventDefault();
    if (!businessName) return toast.error('Business name is required');
    if (!instagramUsername) return toast.error('Instagram username is required');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('businessName', businessName);
      formData.append('businessType', businessType);
      formData.append('instagramUsername', instagramUsername);
      if (gstNumber) formData.append('gstNumber', gstNumber);
      if (profilePhoto) formData.append('profilePhoto', profilePhoto);

      const { data } = await API.post('/api/auth/register-seller', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      login(data.token, data.user);
      toast.success('Registration submitted! Awaiting admin approval.');
      navigate('/seller');
    } catch (err) { toast.error(err.response?.data?.message || 'Registration failed'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-surface via-card to-surface py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium mb-6">LIMITED TIME: 0% PLATFORM FEE!</div>
          <h1 className="text-3xl md:text-5xl font-black text-theme-primary mb-4">Sell Gifts on <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Giftsity</span></h1>
          <p className="text-lg text-theme-muted max-w-xl mx-auto mb-8">Keep 97% of every sale. Only payment gateway fee (3%). No listing fees. No monthly charges.</p>

          {/* Comparison table */}
          <div className="bg-card border border-edge/50 rounded-2xl overflow-hidden max-w-2xl mx-auto mb-12">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge/50">
                  <th className="px-4 py-3 text-left text-theme-muted font-medium"></th>
                  <th className="px-4 py-3 text-center text-amber-400 font-bold">Giftsity</th>
                  <th className="px-4 py-3 text-center text-theme-dim font-medium">Etsy</th>
                  <th className="px-4 py-3 text-center text-theme-dim font-medium">Amazon</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Platform Fee', '0%*', '6.5%', '15-20%'],
                  ['Listing Fee', 'Free', 'Rs.18', 'Free'],
                  ['Payment Fee', '3%', '3-5%', '2-3%'],
                  ['You Keep', '97%', '~87%', '~77%'],
                ].map(([label, ...vals], i) => (
                  <tr key={i} className="border-b border-edge/30">
                    <td className="px-4 py-2.5 text-theme-secondary">{label}</td>
                    {vals.map((v, j) => (
                      <td key={j} className={`px-4 py-2.5 text-center ${j === 0 ? 'text-amber-400 font-bold' : 'text-theme-dim'}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-theme-dim px-4 py-2">*Limited time offer. Rate may increase with notice.</p>
          </div>
        </div>
      </section>

      {/* Registration */}
      <section className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <div className="bg-card border border-edge/50 rounded-2xl p-6 md:p-8">
          {/* Steps indicator */}
          <div className="flex items-center gap-3 mb-6">
            {['Account', 'Verify', 'Details'].map((s, i) => {
              const stepIdx = step === 'info' ? 0 : step === 'otp' ? 1 : 2;
              return (
                <div key={i} className="flex-1">
                  <div className={`h-1 rounded-full ${i <= stepIdx ? 'bg-amber-500' : 'bg-inset'}`} />
                  <p className={`text-xs mt-1 ${i <= stepIdx ? 'text-amber-400' : 'text-theme-dim'}`}>{s}</p>
                </div>
              );
            })}
          </div>

          {step === 'info' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <h2 className="text-lg font-bold text-theme-primary mb-2">Create Seller Account</h2>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
                </div>
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Mobile Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <h2 className="text-lg font-bold text-theme-primary mb-2">Verify Email</h2>
              <p className="text-sm text-theme-muted">OTP sent to <span className="text-theme-primary font-medium">{email}</span></p>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Enter OTP</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary text-center tracking-[0.5em] font-mono focus:outline-none focus:border-amber-500/50" autoFocus />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
              </button>
              <button type="button" onClick={() => setStep('info')} className="w-full text-sm text-theme-muted hover:text-theme-primary">Back</button>
            </form>
          )}

          {step === 'details' && (
            <form onSubmit={handleSubmitDetails} className="space-y-4">
              <h2 className="text-lg font-bold text-theme-primary mb-2">Business Details</h2>

              {/* Profile Photo */}
              <div className="flex justify-center">
                <label className="relative cursor-pointer group">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-inset border-2 border-edge flex items-center justify-center">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-theme-dim" />
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center group-hover:bg-amber-400 transition-colors">
                    <Upload className="w-3 h-3 text-zinc-950" />
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-theme-dim text-center">Profile photo (should match your Instagram)</p>

              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Business Name *</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" required />
                </div>
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Business Type</label>
                <select value={businessType} onChange={e => setBusinessType(e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50">
                  <option value="individual">Individual</option>
                  <option value="proprietorship">Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="pvt_ltd">Pvt Ltd</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">Instagram Username *</label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
                  <input type="text" value={instagramUsername} onChange={e => setInstagramUsername(e.target.value)} placeholder="@yourbrand" className="w-full pl-10 pr-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500/50" required />
                </div>
              </div>
              <div>
                <label className="text-xs text-theme-muted font-medium mb-1 block">GST Number (optional)</label>
                <input type="text" value={gstNumber} onChange={e => setGstNumber(e.target.value)} className="w-full px-4 py-2.5 bg-inset border border-edge rounded-xl text-sm text-theme-primary focus:outline-none focus:border-amber-500/50" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <>Submit for Approval <Check className="w-4 h-4" /></>}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'Zero Commission', desc: 'Start selling with 0% platform fee. You keep 97% of every sale.' },
            { title: 'Easy Setup', desc: 'List products in minutes. Manage from your seller dashboard.' },
            { title: 'Growing Audience', desc: 'Reach thousands of gift buyers. We drive traffic to your products.' },
          ].map((b, i) => (
            <div key={i} className="bg-card border border-edge/50 rounded-xl p-5 text-center">
              <h3 className="font-semibold text-theme-primary mb-2">{b.title}</h3>
              <p className="text-sm text-theme-muted">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
