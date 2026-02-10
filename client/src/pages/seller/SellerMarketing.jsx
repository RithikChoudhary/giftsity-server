import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, Copy, Share2, Gift, Users, Star, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../api';

export default function SellerMarketing() {
  const { user } = useAuth();
  const [sp, setSp] = useState(user?.sellerProfile || {});
  const referralCode = sp.referralCode || `${sp.businessName?.toUpperCase().replace(/\s/g, '').slice(0, 8)}2026`;
  const storeUrl = `${window.location.origin}/store/${sp.businessSlug || sp.slug || user?._id}`;
  const referralUrl = `${window.location.origin}/seller/join?ref=${referralCode}`;

  useEffect(() => {
    const fetchMarketing = async () => {
      try {
        const { data } = await API.get('/seller/marketing');
        if (data) setSp(prev => ({ ...prev, ...data }));
      } catch { /* fallback to context data */ }
    };
    fetchMarketing();
  }, []);

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Marketing</h1>

      {/* Store link */}
      <div className="bg-card border border-edge/50 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-amber-400" /> Your Store Link
        </h3>
        <div className="flex items-center gap-2">
          <input type="text" readOnly value={storeUrl} className="flex-1 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-secondary" />
          <button onClick={() => copy(storeUrl)} className="px-3 py-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-theme-dim mt-2">Share this link with your customers on Instagram, WhatsApp, etc.</p>
      </div>

      {/* Referral Program */}
      <div className="bg-card border border-edge/50 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" /> Referral Program
        </h3>
        <p className="text-sm text-theme-muted mb-4">Invite other sellers and earn rewards!</p>
        <div className="bg-inset/50 rounded-lg p-4 mb-4">
          <p className="text-xs text-theme-dim mb-1">Your Referral Code</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-amber-400 tracking-wide">{referralCode}</span>
            <button onClick={() => copy(referralCode)} className="text-theme-dim hover:text-theme-primary"><Copy className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <input type="text" readOnly value={referralUrl} className="flex-1 px-3 py-2 bg-inset border border-edge rounded-lg text-sm text-theme-secondary" />
          <button onClick={() => copy(referralUrl)} className="px-3 py-2 bg-amber-500/10 text-amber-400 rounded-lg"><Copy className="w-4 h-4" /></button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Join Giftsity and sell your products with 0% platform fee! Use my referral code: ${referralCode}\n${referralUrl}`)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors">
            <Share2 className="w-4 h-4" />
          </a>
        </div>
        <div className="bg-card border border-amber-500/20 rounded-lg p-3 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <span className="text-lg font-bold text-amber-400">{sp.referralCount || 0}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">Sellers Referred</p>
            <p className="text-xs text-theme-dim">{sp.referralCount >= 10 ? '0% fee locked for 1 year!' : sp.referralCount >= 5 ? 'Rs. 500 credit earned!' : sp.referralCount >= 3 ? 'Featured on homepage!' : `${3 - (sp.referralCount || 0)} more for featured placement`}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-theme-secondary">
          <p className={`flex items-center gap-2 ${(sp.referralCount || 0) >= 3 ? 'text-green-400' : ''}`}><Gift className="w-4 h-4 text-amber-400" /> 3 referrals: Featured on homepage for 1 week {(sp.referralCount || 0) >= 3 && '✓'}</p>
          <p className={`flex items-center gap-2 ${(sp.referralCount || 0) >= 5 ? 'text-green-400' : ''}`}><Gift className="w-4 h-4 text-amber-400" /> 5 referrals: Rs. 500 Giftsity credit {(sp.referralCount || 0) >= 5 && '✓'}</p>
          <p className={`flex items-center gap-2 ${(sp.referralCount || 0) >= 10 ? 'text-green-400' : ''}`}><Star className="w-4 h-4 text-amber-400" /> 10 referrals: Locked 0% fee for 1 year {(sp.referralCount || 0) >= 10 && '✓'}</p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-card border border-edge/50 rounded-xl p-5">
        <h3 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-400" /> Marketing Tips
        </h3>
        <div className="space-y-3 text-sm text-theme-secondary">
          <p>1. Share your store link on your Instagram bio and stories regularly.</p>
          <p>2. Use high-quality product photos - they increase conversions by 40%.</p>
          <p>3. Respond quickly to orders - fast processing leads to better reviews.</p>
          <p>4. Add detailed product descriptions with dimensions, materials, and use cases.</p>
          <p>5. Keep your inventory updated to avoid cancellations.</p>
        </div>
      </div>
    </div>
  );
}
