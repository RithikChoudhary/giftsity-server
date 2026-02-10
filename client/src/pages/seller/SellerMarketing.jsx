import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Megaphone, Copy, Share2, Gift, Users, Star, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SellerMarketing() {
  const { user } = useAuth();
  const sp = user?.sellerProfile || {};
  const referralCode = sp.referralCode || `${sp.businessName?.toUpperCase().replace(/\s/g, '').slice(0, 8)}2026`;
  const storeUrl = `${window.location.origin}/store/${sp.slug || user?._id}`;
  const referralUrl = `${window.location.origin}/seller/join?ref=${referralCode}`;

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
        </div>
        <div className="space-y-2 text-sm text-theme-secondary">
          <p className="flex items-center gap-2"><Gift className="w-4 h-4 text-amber-400" /> 3 referrals: Featured on homepage for 1 week</p>
          <p className="flex items-center gap-2"><Gift className="w-4 h-4 text-amber-400" /> 5 referrals: Rs. 500 Giftsity credit</p>
          <p className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> 10 referrals: Locked 0% fee for 1 year</p>
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
