import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function ShippingPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SEO title="Shipping Policy" description="Giftsity shipping policy. Learn about delivery timelines, shipping costs, tracking, and our shipping partners." url="https://giftsity.com/shipping-policy" />
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary mb-6"><ArrowLeft className="w-4 h-4" /> Back to Home</Link>
      <h1 className="text-3xl font-bold text-theme-primary mb-2">Shipping Policy</h1>
      <p className="text-sm text-theme-dim mb-8">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="prose-sm space-y-6 text-theme-secondary leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">1. Overview</h2>
          <p>Giftsity partners with leading logistics providers through the Shiprocket network to deliver your orders across India. Shipping is coordinated between the creator/seller, our logistics partners, and the platform to ensure timely and safe delivery of your orders.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">2. Shipping Partners</h2>
          <p>We work with multiple courier partners including Delhivery, BlueDart, DTDC, Ecom Express, and others through our integrated shipping network. The most suitable courier is selected based on your delivery pincode, package weight, and service availability.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">3. Delivery Timelines</h2>
          <p>Estimated delivery timelines vary by location:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Metro cities</strong> (Delhi, Mumbai, Bangalore, Chennai, Hyderabad, Kolkata): 3-5 business days</li>
            <li><strong>Tier 2 cities</strong>: 5-7 business days</li>
            <li><strong>Remote / rural areas</strong>: 7-10 business days</li>
          </ul>
          <p className="mt-2">These are estimates and may vary depending on the seller's location, courier availability, and unforeseen circumstances (weather, holidays, etc.). Sellers are required to ship orders within 48-72 hours of order confirmation.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">4. Shipping Costs</h2>
          <p>Shipping costs depend on the seller's shipping policy for each product:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Seller-paid shipping</strong>: The seller absorbs the shipping cost. You pay only the product price.</li>
            <li><strong>Customer-paid shipping</strong>: The shipping charge is calculated based on the package weight, dimensions, and delivery pincode. The exact amount is shown at checkout before you pay.</li>
          </ul>
          <p className="mt-2">Each product listing clearly indicates whether shipping is paid by the seller or the customer.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">5. Order Tracking</h2>
          <p>Once your order is shipped, you will receive a tracking number via email and in your <strong>My Orders</strong> page. You can track your order in real-time using:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The <Link to="/track" className="text-amber-400 hover:text-amber-300">Track Order</Link> page on our website.</li>
            <li>The courier partner's tracking page using the AWB (airway bill) number.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">6. Undeliverable Packages</h2>
          <p>If a package cannot be delivered due to an incorrect or incomplete address, the recipient being unavailable after multiple delivery attempts, or the package being refused, the shipment will be returned to the seller. In such cases:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The customer will be notified via email.</li>
            <li>A refund may be issued minus any applicable return shipping charges.</li>
            <li>Please ensure your shipping address is accurate and complete at checkout.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">7. Packaging</h2>
          <p>Sellers are responsible for securely packaging products to prevent damage during transit. Giftsity encourages sellers to use eco-friendly packaging materials where possible. If you receive a damaged package, please report it immediately through the <Link to="/returns" className="text-amber-400 hover:text-amber-300">Returns</Link> section.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">8. Shipping Restrictions</h2>
          <p>Currently, Giftsity only ships within India. We do not support international shipping at this time. Certain remote pincodes may not be serviceable by all courier partners. Serviceability is checked during checkout.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-2">9. Contact Us</h2>
          <p>For shipping-related queries, reach out to us at <a href="mailto:support@giftsity.com" className="text-amber-400 hover:text-amber-300">support@giftsity.com</a> or visit our <Link to="/contact" className="text-amber-400 hover:text-amber-300">Contact page</Link>.</p>
        </section>
      </div>
    </div>
  );
}
