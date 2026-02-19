import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function SellerAgreement() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SEO title="Seller Agreement" description="Giftsity Seller Agreement. Terms and conditions for creators and sellers listing products on the Giftsity marketplace." url="https://giftsity.com/seller-agreement" />
      <Link to="/seller/join" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6"><ArrowLeft className="w-4 h-4" /> Back to Registration</Link>
      <h1 className="text-3xl font-bold text-theme-primary mb-2">Seller Agreement</h1>
      <p className="text-sm text-theme-dim mb-8">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="prose-sm space-y-6 text-theme-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">1. Introduction</h2>
          <p>This Seller Agreement (&quot;Agreement&quot;) is a legally binding contract between you (&quot;Seller&quot;, &quot;Creator&quot;, &quot;You&quot;) and Giftsity (&quot;Platform&quot;, &quot;We&quot;, &quot;Us&quot;). By registering as a seller on Giftsity, you agree to be bound by the terms outlined in this Agreement, as well as our <Link to="/terms" className="text-amber-400 underline">Terms of Service</Link> and <Link to="/privacy" className="text-amber-400 underline">Privacy Policy</Link>.</p>
          <p className="mt-2">Giftsity is a multi-vendor marketplace that connects independent creators and sellers with customers across India.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">2. Eligibility</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You must be at least 18 years of age.</li>
            <li>You must have a valid email address, phone number, and an active Instagram account (for verification).</li>
            <li>You must provide accurate and truthful business information during registration.</li>
            <li>Your account is subject to admin approval. We reserve the right to reject any application without providing a reason.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">3. Fees and Commission</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Platform Fee:</strong> Currently 0% (zero percent). This is a promotional rate and may change with prior notice.</li>
            <li><strong>Payment Gateway Fee:</strong> 3% of the total order amount is deducted to cover payment processing costs (Cashfree). This fee is non-negotiable and is deducted automatically from your earnings.</li>
            <li><strong>You Keep:</strong> 97% of every sale (after the 3% payment gateway fee).</li>
            <li>If platform commission is introduced in the future, you will be notified at least 30 days in advance. You may choose to deactivate your account if you disagree with the revised terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">4. Payouts</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Payouts are calculated on a <strong>biweekly basis</strong> (1st and 15th of each month) for all delivered orders.</li>
            <li>You must provide valid bank account details (account holder name, account number, IFSC code, bank name) before receiving any payout.</li>
            <li>Payouts are processed manually via bank transfer (NEFT/IMPS). Processing may take 3-5 business days after the payout date.</li>
            <li>Orders that are pending, cancelled, returned, or refunded are excluded from payout calculations.</li>
            <li>If shipping is paid by the seller, the actual shipping cost is deducted from the payout amount.</li>
            <li>We reserve the right to withhold payouts if fraudulent activity is detected on your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">5. Product Listing Rules</h2>
          <p>You are solely responsible for the products you list. By listing a product, you represent and warrant that:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You are the rightful owner or authorized reseller of the product.</li>
            <li>The product description, images, pricing, and stock information are accurate and not misleading.</li>
            <li>The product complies with all applicable Indian laws and regulations.</li>
            <li>The product does not infringe on any third-party intellectual property rights (trademarks, copyrights, patents).</li>
          </ul>
          <p className="mt-2"><strong>Prohibited Items:</strong> The following are strictly not allowed:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Counterfeit, replica, or knockoff products</li>
            <li>Illegal substances, drugs, or drug paraphernalia</li>
            <li>Weapons, ammunition, or explosives</li>
            <li>Adult / sexually explicit content</li>
            <li>Products that promote hate, violence, or discrimination</li>
            <li>Stolen property</li>
            <li>Any product banned by the Government of India</li>
          </ul>
          <p className="mt-2">Listing prohibited items will result in immediate account suspension.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">6. Shipping Responsibilities</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You must provide a valid pickup address for order fulfillment.</li>
            <li>Orders must be shipped within <strong>3 business days</strong> of confirmation. Failure to ship on time may affect your seller health score.</li>
            <li>Shipping can be set as &quot;seller-paid&quot; (cost deducted from your earnings) or &quot;customer-paid&quot; (customer pays at checkout). This is configurable per product.</li>
            <li>Giftsity provides integrated shipping via Shiprocket with multiple courier partners. You may use this service or arrange your own shipping.</li>
            <li>You are responsible for proper packaging to prevent damage during transit.</li>
            <li>In case of shipping disputes, the shipping provider&apos;s tracking data will be used as evidence.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">7. Returns and Refunds</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Customers may request a return within <strong>7 days of delivery</strong> as per our <Link to="/return-policy" className="text-amber-400 underline">Return Policy</Link>.</li>
            <li>You must respond to return requests within <strong>3 business days</strong>. If no response is received, the return is automatically approved.</li>
            <li>For approved returns, refunds are processed to the customer. The corresponding amount is deducted from your earnings or future payouts.</li>
            <li>Customized / personalized products are non-returnable unless defective or damaged.</li>
            <li>Disputes between sellers and customers are mediated by Giftsity. Our decision in such disputes is final.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">8. Account Suspension and Termination</h2>
          <p>Giftsity may suspend or terminate your seller account if:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You violate any terms of this Agreement or the Terms of Service.</li>
            <li>Your seller health score drops below acceptable thresholds (high cancellation rate, late shipments, customer complaints).</li>
            <li>Fraudulent activity is detected on your account.</li>
            <li>You list prohibited or counterfeit items.</li>
            <li>Customer complaints consistently indicate misrepresentation of products.</li>
          </ul>
          <p className="mt-2">Upon suspension, your product listings are hidden from customers. You may request reactivation from your dashboard Settings page. Giftsity will review your request within 5 business days.</p>
          <p className="mt-2">You may voluntarily deactivate your account at any time. Pending payouts for delivered orders will still be processed.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">9. Intellectual Property</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You retain full ownership of your product images, descriptions, and brand assets.</li>
            <li>By listing on Giftsity, you grant us a non-exclusive, royalty-free license to display your product content on our platform and in marketing materials (social media, email campaigns, advertisements).</li>
            <li>This license terminates when you remove the product or close your account.</li>
            <li>Giftsity&apos;s brand assets (logo, name, website content) are our property and may not be used without written permission.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">10. Data and Privacy</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Customer personal information (name, address, phone number) is shared with you solely for order fulfillment purposes.</li>
            <li>You must not use customer data for marketing, spam, or any purpose other than fulfilling their order.</li>
            <li>You must not share customer data with any third party.</li>
            <li>Violation of customer data privacy may result in immediate account termination.</li>
            <li>For complete details, refer to our <Link to="/privacy" className="text-amber-400 underline">Privacy Policy</Link>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">11. Limitation of Liability</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Giftsity acts as a marketplace platform and is not a party to the transaction between you and the customer.</li>
            <li>We are not liable for product defects, delays in shipping by courier partners, or disputes between you and customers beyond our mediation role.</li>
            <li>Our total liability in any matter related to this Agreement shall not exceed the fees collected from you in the preceding 3 months.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">12. Dispute Resolution</h2>
          <p>Any disputes arising from this Agreement shall be resolved through:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li><strong>Good Faith Negotiation:</strong> Both parties shall first attempt to resolve the matter informally via email (support@giftsity.com).</li>
            <li><strong>Mediation:</strong> If negotiation fails, the dispute shall be referred to a mutually agreed mediator.</li>
            <li><strong>Jurisdiction:</strong> This Agreement is governed by the laws of India. Any legal proceedings shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">13. Amendments</h2>
          <p>Giftsity reserves the right to modify this Agreement at any time. We will notify you via email or dashboard notification at least <strong>30 days</strong> before any material changes take effect. Continued use of the platform after such notice constitutes acceptance of the revised terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">14. Contact</h2>
          <p>If you have questions about this Agreement, contact us at:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Email:</strong> support@giftsity.com</li>
            <li><strong>Website:</strong> <a href="https://giftsity.com/contact" className="text-amber-400 underline">giftsity.com/contact</a></li>
          </ul>
        </section>

        <div className="border-t border-edge/50 pt-6 mt-8">
          <p className="text-xs text-theme-dim">By registering as a seller on Giftsity, you acknowledge that you have read, understood, and agree to be bound by this Seller Agreement.</p>
        </div>
      </div>
    </div>
  );
}
