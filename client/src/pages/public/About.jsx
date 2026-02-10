import { Link } from 'react-router-dom';
import { Gift, Users, Truck, Shield, Star, ArrowRight, Zap, Heart } from 'lucide-react';
import SEO from '../../components/SEO';

export default function About() {
  return (
    <div>
      <SEO title="About" description="Giftsity is India's gift marketplace connecting you with verified gift sellers. Tech gadgets, artisan crafts, hampers and more. 0% seller platform fee." />
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
        <div className="max-w-4xl mx-auto text-center relative">
          <h1 className="text-4xl md:text-5xl font-black text-theme-primary mb-4">
            The Gift Marketplace <br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Built for India</span>
          </h1>
          <p className="text-lg text-theme-muted max-w-2xl mx-auto mb-8">
            Giftsity connects you with India's finest gift sellers -- from artisan crafts to tech gadgets.
            One platform, hundreds of unique gifts, delivered to your door.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/shop" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold transition-colors">
              Browse Gifts <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/seller/join" className="inline-flex items-center gap-2 px-6 py-3 bg-card border border-edge hover:border-edge-strong text-theme-primary rounded-xl font-semibold transition-colors">
              Sell on Giftsity
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-theme-primary text-center mb-12">How Giftsity Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Gift, title: 'Browse & Discover', desc: 'Explore gifts from verified sellers across India. Filter by category, price, and occasion.' },
            { icon: Shield, title: 'Secure Checkout', desc: 'Pay safely with Cashfree payment gateway. Your payment details are never stored on our servers.' },
            { icon: Truck, title: 'Track & Receive', desc: 'Sellers ship directly to you with tracked delivery via Shiprocket logistics partners.' },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-edge/50 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="font-semibold text-theme-primary mb-2">{item.title}</h3>
              <p className="text-sm text-theme-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Giftsity */}
      <section className="bg-card/50 border-y border-edge/30 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-theme-primary text-center mb-12">Why Choose Giftsity</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Heart, title: 'Curated Selection', desc: 'Every seller is manually verified by our team before they can list products.' },
              { icon: Zap, title: '0% Platform Fee', desc: 'Our sellers keep more, so you get better prices and happier gifting.' },
              { icon: Star, title: 'Honest Reviews', desc: 'Real reviews from verified buyers. No fake ratings, ever.' },
              { icon: Users, title: 'B2B & B2C', desc: 'Gift for yourself, or get a custom quote for corporate bulk orders.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-theme-primary mb-1">{item.title}</h3>
                  <p className="text-xs text-theme-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Sellers */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-theme-primary mb-4">Sell on Giftsity</h2>
        <p className="text-theme-muted mb-8 max-w-2xl mx-auto">
          Whether you're an Instagram seller, a small business, or an artisan, Giftsity gives you a
          professional storefront with zero listing fees. You keep 97% of every sale.
        </p>
        <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-8">
          <div>
            <p className="text-2xl font-bold text-amber-400">0%</p>
            <p className="text-xs text-theme-muted">Platform Fee</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400">3%</p>
            <p className="text-xs text-theme-muted">Gateway Fee Only</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400">97%</p>
            <p className="text-xs text-theme-muted">You Keep</p>
          </div>
        </div>
        <Link to="/seller/join" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-semibold transition-colors">
          Start Selling Free <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Corporate */}
      <section className="bg-card/50 border-y border-edge/30 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-theme-primary mb-4">Corporate Gifting</h2>
          <p className="text-theme-muted mb-8 max-w-2xl mx-auto">
            Need gifts for your team, clients, or events? We handle bulk orders with custom packaging,
            branded options, and doorstep delivery across India.
          </p>
          <Link to="/b2b" className="inline-flex items-center gap-2 px-6 py-3 bg-card border border-edge hover:border-amber-500/30 text-theme-primary rounded-xl font-semibold transition-colors">
            Get a Custom Quote <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
