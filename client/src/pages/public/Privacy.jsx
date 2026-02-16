import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SEO title="Privacy Policy" description="Giftsity privacy policy. Learn how we collect, use, and protect your data on our gift marketplace." url="https://giftsity.com/privacy" />
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6"><ArrowLeft className="w-4 h-4" /> Back to Home</Link>
      <h1 className="text-3xl font-bold text-theme-primary mb-2">Privacy Policy</h1>
      <p className="text-sm text-theme-dim mb-8">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="prose-sm space-y-6 text-theme-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">1. Information We Collect</h2>
          <p><strong className="text-theme-primary">Account Information:</strong> When you create an account, we collect your name, email address, and phone number. Creators additionally provide business details, Instagram profile, bank information, and a profile photo.</p>
          <p><strong className="text-theme-primary">Order Information:</strong> When you place an order, we collect your shipping address and payment details (processed securely by Cashfree -- we do not store your card/UPI details).</p>
          <p><strong className="text-theme-primary">Usage Data:</strong> We collect information about how you interact with our Platform, including pages viewed and actions taken.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To create and manage your account</li>
            <li>To process orders and facilitate deliveries</li>
            <li>To send transactional emails (OTP codes, order confirmations, shipping updates)</li>
            <li>To calculate and process creator payouts</li>
            <li>To improve the Platform and user experience</li>
            <li>To prevent fraud and ensure security</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">3. Information Sharing</h2>
          <p>We share your information only in the following cases:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-theme-primary">With Creators:</strong> Your name, shipping address, and phone number are shared with the creator when you place an order so they can fulfill it.</li>
            <li><strong className="text-theme-primary">Payment Processor:</strong> Cashfree processes your payment data under their own privacy policy.</li>
            <li><strong className="text-theme-primary">Shipping Partners:</strong> Shiprocket and courier partners receive the information needed to deliver your order.</li>
            <li><strong className="text-theme-primary">Legal Requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
          </ul>
          <p className="mt-2">We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">4. Data Storage &amp; Security</h2>
          <p>Your data is stored on secure MongoDB Atlas servers. We use JWT tokens for authentication (no passwords are stored). All communications are encrypted via HTTPS. Bank account details for creators are stored with appropriate security measures.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">5. Cookies &amp; Local Storage</h2>
          <p>We use browser local storage to persist your authentication token, shopping cart, and theme preference. No third-party tracking cookies are used.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Update or correct your information via your profile page</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for marketing communications</li>
          </ul>
          <p className="mt-2">To exercise these rights, contact us at <a href="mailto:support@giftsity.com" className="text-amber-400 hover:text-amber-300">support@giftsity.com</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">7. Data Retention</h2>
          <p>We retain your personal data for as long as your account is active. Order records are retained for 5 years for tax and legal compliance purposes. You may request account deletion at any time.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">8. Children's Privacy</h2>
          <p>Our Platform is not intended for individuals under 18 years of age. We do not knowingly collect personal information from minors.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. Your continued use of the Platform constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">10. Contact Us</h2>
          <p>For privacy-related inquiries, contact our Data Protection Officer at <a href="mailto:support@giftsity.com" className="text-amber-400 hover:text-amber-300">support@giftsity.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
