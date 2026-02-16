import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SEO title="Terms & Conditions" description="Giftsity terms of service. Read our terms and conditions for using the gift marketplace platform." url="https://giftsity.com/terms" />
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6"><ArrowLeft className="w-4 h-4" /> Back to Home</Link>
      <h1 className="text-3xl font-bold text-theme-primary mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-theme-dim mb-8">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="prose-sm space-y-6 text-theme-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">1. Overview</h2>
          <p>Welcome to Giftsity ("Platform", "we", "us"). By accessing or using our website and services, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">2. User Accounts</h2>
          <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials. We use email OTP-based authentication; no passwords are stored. You must be at least 18 years of age to use this Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">3. Marketplace Model</h2>
          <p>Giftsity operates as a multi-vendor marketplace. Products listed on the Platform are sold by independent third-party creators. Giftsity facilitates the transaction but is not the creator of record. We do not guarantee, endorse, or assume responsibility for any product offered by creators.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">4. Orders &amp; Payments</h2>
          <p>All payments are processed through our payment gateway partner (Cashfree). By placing an order, you authorize us to charge the specified amount. Prices are listed in Indian Rupees (INR) and include applicable taxes unless otherwise stated. Orders are subject to product availability and creator acceptance.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">5. Shipping &amp; Delivery</h2>
          <p>Shipping is handled by third-party logistics partners coordinated through the Platform. Delivery timelines are estimates and may vary based on location and courier availability. Creators are responsible for packaging and dispatching orders within the specified timeframe.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">6. Cancellations &amp; Refunds</h2>
          <p>Customers may cancel orders before they are shipped. Once an order has been shipped, cancellation is not possible. Refunds for cancelled orders will be processed within 5-7 business days to the original payment method. For damaged or incorrect items, customers should contact us within 48 hours of delivery.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">7. Creator Obligations</h2>
          <p>Creators must provide accurate product descriptions, images, and pricing. Products must comply with all applicable laws and regulations. Creators are responsible for fulfilling orders in a timely manner. Giftsity reserves the right to suspend or terminate creator accounts that violate these terms or receive consistent negative feedback.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">8. Commission &amp; Fees</h2>
          <p>Giftsity charges a platform commission on sales made through the marketplace. Commission rates are set by the Platform and may vary. Payment gateway processing fees are deducted from creator earnings. Detailed commission breakdowns are visible in the creator dashboard.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">9. Intellectual Property</h2>
          <p>All content on the Platform, including logos, designs, and text, is owned by Giftsity or its licensors. Creators retain ownership of their product images and descriptions but grant Giftsity a license to display them on the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">10. Limitation of Liability</h2>
          <p>Giftsity shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Platform. Our total liability is limited to the amount paid by you for the specific transaction in question.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">11. Governing Law</h2>
          <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">12. Changes to Terms</h2>
          <p>We reserve the right to update these terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated terms. We will notify registered users of material changes via email.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">13. Contact</h2>
          <p>For questions about these terms, contact us at <a href="mailto:support@giftsity.com" className="text-amber-400 hover:text-amber-300">support@giftsity.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
