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
          <p>All payments are processed securely through our payment gateway partner, Cashfree Payments. By placing an order, you authorize us to charge the specified amount. Prices are listed in Indian Rupees (INR) and include applicable taxes unless otherwise stated. The minimum product listing price on the Platform is Rs. 100. Orders are subject to product availability and creator acceptance. The total amount at checkout includes the product price and shipping charges (if applicable). All prices shown at checkout are final.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">5. Shipping &amp; Delivery</h2>
          <p>Shipping is handled by third-party logistics partners (including Shiprocket and its courier network) coordinated through the Platform. Delivery timelines displayed at checkout are estimates and may vary based on location, courier availability, and product weight. Shipping costs may be borne by the creator (displayed as "Free Shipping" to the customer) or charged to the customer at checkout, depending on the creator's preference for each product. Creators are responsible for packaging and dispatching orders within 3 business days of order confirmation. Shipping charges, once paid, are non-refundable for shipped orders unless the order is returned to origin (RTO) or cancelled before pickup.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">6. Cancellations &amp; Refunds</h2>
          <p>Customers may cancel orders before the package has been picked up by the courier. Once the package has been physically picked up, cancellation is not possible from the customer side. If a shipment is returned to origin (RTO) by the courier, the order is automatically cancelled and a full refund is initiated. Refunds for cancelled orders are processed within 5-7 business days to the original payment method via Cashfree. For damaged or incorrect items, customers may request a return within 7 days of delivery as per our <Link to="/return-policy" className="text-amber-400 hover:text-amber-300">Return &amp; Refund Policy</Link>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">7. Returns &amp; Exchanges</h2>
          <p>Customers may request a return or exchange within 7 days of delivery for reasons including defective products, wrong items, items not as described, or size issues. Return requests are reviewed by the creator, who may approve or reject them with a valid reason. For approved returns, the customer is responsible for shipping the product back to the creator. Once the returned item is received and verified by the creator, a refund is initiated to the customer's original payment method. Customized or personalized products are non-returnable unless defective or damaged. For full details, refer to our <Link to="/return-policy" className="text-amber-400 hover:text-amber-300">Return &amp; Refund Policy</Link>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">8. Creator Obligations</h2>
          <p>Creators must provide accurate product descriptions, images, and pricing. Products must comply with all applicable Indian laws and regulations. Creators are responsible for fulfilling orders within 3 business days and ensuring proper packaging. A valid pickup address and bank account details must be provided to receive orders and payouts respectively. Giftsity reserves the right to suspend or terminate creator accounts that violate these terms, consistently fail to fulfill orders on time, or receive persistent negative feedback. Creators agree to the <Link to="/seller-agreement" className="text-amber-400 hover:text-amber-300">Seller Agreement</Link> upon registration.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">9. Commission, Fees &amp; Payouts</h2>
          <p>Giftsity currently charges 0% platform commission on sales (promotional rate, subject to change with 30 days prior notice). A payment gateway fee of 3% is deducted from each transaction to cover payment processing costs (Cashfree). Creators retain 97% of every sale. Detailed earnings breakdowns are visible in the creator dashboard. Payouts for delivered orders are processed on a biweekly basis (1st and 15th of each month) via bank transfer (NEFT/IMPS) to the creator's registered bank account. The minimum payout amount is Rs. 100. Orders that are pending, cancelled, returned, or refunded are excluded from payout calculations. If shipping is paid by the creator, the actual shipping cost is deducted from the payout.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">10. Intellectual Property</h2>
          <p>All content on the Platform, including logos, designs, and text, is owned by Giftsity or its licensors. Creators retain ownership of their product images and descriptions but grant Giftsity a license to display them on the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">11. Limitation of Liability</h2>
          <p>Giftsity shall not be liable for any indirect, incidental, or consequential damages arising from the use of the Platform. Our total liability is limited to the amount paid by you for the specific transaction in question.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">12. Governing Law</h2>
          <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in New Delhi, India.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">13. Changes to Terms</h2>
          <p>We reserve the right to update these terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated terms. We will notify registered users of material changes via email.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">14. Contact</h2>
          <p>For questions about these terms, contact us at <a href="mailto:support@giftsity.com" className="text-amber-400 hover:text-amber-300">support@giftsity.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
