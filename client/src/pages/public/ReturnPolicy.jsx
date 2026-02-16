import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function ReturnPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SEO title="Return & Refund Policy" description="Giftsity return and refund policy. Learn about our return eligibility, refund process, exchanges, and cancellation policy." url="https://giftsity.com/return-policy" />
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6"><ArrowLeft className="w-4 h-4" /> Back to Home</Link>
      <h1 className="text-3xl font-bold text-theme-primary mb-2">Return &amp; Refund Policy</h1>
      <p className="text-sm text-theme-dim mb-8">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="prose-sm space-y-6 text-theme-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">1. Overview</h2>
          <p>Giftsity is a multi-vendor marketplace. Products are sold by independent creators and sellers. Each seller is responsible for the quality and accuracy of their products. This Return &amp; Refund Policy outlines the process for returning products purchased through our platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">2. Return Eligibility</h2>
          <p>You may request a return within <strong>7 days of delivery</strong>, provided the following conditions are met:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The product is unused, unworn, and in its original condition.</li>
            <li>The product is in its original packaging with all tags and labels intact.</li>
            <li>You have proof of purchase (order confirmation email or order ID).</li>
            <li>The product is not in the non-returnable category (see below).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">3. Non-Returnable Items</h2>
          <p>The following categories of products cannot be returned or exchanged:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Customized / Personalized products</strong> &mdash; items made to order with custom text, images, or engravings.</li>
            <li><strong>Perishable goods</strong> &mdash; food items, flowers, and other items with a limited shelf life.</li>
            <li><strong>Intimate / hygiene products</strong> &mdash; items that cannot be resold for hygiene reasons.</li>
            <li><strong>Digital products</strong> &mdash; downloadable content or digital gift cards.</li>
            <li><strong>Products marked as "Final Sale"</strong> by the seller.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">4. How to Initiate a Return</h2>
          <p>To request a return:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to <strong>My Orders</strong> in your account.</li>
            <li>Select the order containing the item you wish to return.</li>
            <li>Click <strong>"Request Return"</strong> and select the reason for return.</li>
            <li>Upload photos of the product (required for damaged/defective items).</li>
            <li>Submit your request. The seller will review it within 2-3 business days.</li>
          </ol>
          <p className="mt-2">Once the seller approves the return, you will receive shipping instructions. The return shipping cost may be borne by the customer or the seller depending on the reason for return.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">5. Refund Process</h2>
          <p>Once the returned item is received and inspected by the seller:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Approved refunds</strong> will be processed within <strong>5-7 business days</strong> to your original payment method (via Cashfree).</li>
            <li>The refund amount will include the product price. Shipping charges are non-refundable unless the return is due to a seller error or defective product.</li>
            <li>You will receive an email notification when the refund is initiated.</li>
          </ul>
          <p className="mt-2">Please note that your bank or card issuer may take additional time to reflect the refund in your account.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">6. Exchanges</h2>
          <p>If you wish to exchange a product for a different size, colour, or variant, you may request an exchange through the same return process. Select <strong>"Exchange"</strong> as the return type and specify the desired replacement. Exchanges are subject to product availability with the seller.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">7. Cancellation Before Shipment</h2>
          <p>You may cancel an order at any time before it has been shipped. Cancellation can be done from the <strong>My Orders</strong> page. If the order has already been shipped, you will need to wait for delivery and then initiate a return. Refunds for cancelled orders are processed within <strong>5-7 business days</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">8. Damaged or Defective Items</h2>
          <p>If you receive a product that is damaged, defective, or materially different from what was described:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Report the issue within <strong>48 hours of delivery</strong>.</li>
            <li>Provide photographs clearly showing the damage or defect.</li>
            <li>We will prioritize your return request and ensure a full refund or replacement at no additional cost.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">9. Auto-Cancellation</h2>
          <p>If a seller fails to ship your order within 72 hours of order confirmation, the order will be <strong>automatically cancelled</strong> and a full refund will be initiated to your original payment method.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">10. Seller Disputes</h2>
          <p>If a seller rejects your return request and you believe it is unjustified, you may contact Giftsity support. We will mediate the dispute and take appropriate action, which may include overriding the seller's decision.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">11. Contact Us</h2>
          <p>For any questions about returns or refunds, reach out to us at <a href="mailto:support@giftsity.com" className="text-amber-400 hover:text-amber-300">support@giftsity.com</a> or visit our <Link to="/contact" className="text-amber-400 hover:text-amber-300">Contact page</Link>.</p>
        </section>
      </div>
    </div>
  );
}
