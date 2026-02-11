import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { WishlistProvider } from './context/WishlistContext';
import { CorporateAuthProvider } from './context/CorporateAuthContext';
import LoadingSpinner from './components/LoadingSpinner';

// Layouts (always loaded)
import Layout from './components/Layout';
import SellerLayout from './components/SellerLayout';
import AdminLayout from './components/AdminLayout';
import CorporateLayout from './components/CorporateLayout';

// Public pages (lazy loaded)
const Home = lazy(() => import('./pages/public/Home'));
const Shop = lazy(() => import('./pages/public/Shop'));
const ProductDetail = lazy(() => import('./pages/public/ProductDetail'));
const TrackOrder = lazy(() => import('./pages/public/TrackOrder'));
const Auth = lazy(() => import('./pages/public/Auth'));
const B2BInquiry = lazy(() => import('./pages/public/B2BInquiry'));
const SellerJoin = lazy(() => import('./pages/public/SellerJoin'));
const Cart = lazy(() => import('./pages/public/Cart'));
const SellerStore = lazy(() => import('./pages/public/SellerStore'));
const AllSellers = lazy(() => import('./pages/public/AllSellers'));
const Terms = lazy(() => import('./pages/public/Terms'));
const Privacy = lazy(() => import('./pages/public/Privacy'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));

// Customer pages
const CustomerOrders = lazy(() => import('./pages/customer/CustomerOrders'));
const OrderDetail = lazy(() => import('./pages/customer/OrderDetail'));
const CustomerProfile = lazy(() => import('./pages/customer/CustomerProfile'));
const WishlistPage = lazy(() => import('./pages/customer/Wishlist'));
const OrderConfirmation = lazy(() => import('./pages/customer/OrderConfirmation'));

// Seller pages
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'));
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerPayouts = lazy(() => import('./pages/seller/SellerPayouts'));
const SellerMarketing = lazy(() => import('./pages/seller/SellerMarketing'));
const SellerSettings = lazy(() => import('./pages/seller/SellerSettings'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminSellers = lazy(() => import('./pages/admin/AdminSellers'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPayouts = lazy(() => import('./pages/admin/AdminPayouts'));
const AdminB2B = lazy(() => import('./pages/admin/AdminB2B'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminCorporateUsers = lazy(() => import('./pages/admin/AdminCorporateUsers'));
const AdminCorporateCatalog = lazy(() => import('./pages/admin/AdminCorporateCatalog'));
const AdminCorporateQuotes = lazy(() => import('./pages/admin/AdminCorporateQuotes'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));

// Corporate pages
const CorporateLogin = lazy(() => import('./pages/corporate/CorporateLogin'));
const CorporateDashboard = lazy(() => import('./pages/corporate/CorporateDashboard'));
const CorporateCatalog = lazy(() => import('./pages/corporate/CorporateCatalog'));
const CorporateCart = lazy(() => import('./pages/corporate/CorporateCart'));
const CorporateOrders = lazy(() => import('./pages/corporate/CorporateOrders'));
const CorporateOrderDetail = lazy(() => import('./pages/corporate/CorporateOrderDetail'));
const CorporateQuotes = lazy(() => import('./pages/corporate/CorporateQuotes'));
const CorporateProfile = lazy(() => import('./pages/corporate/CorporateProfile'));
const CorporateInquiry = lazy(() => import('./pages/corporate/CorporateInquiry'));

const NotFound = lazy(() => import('./components/NotFound'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CartProvider>
        <WishlistProvider>
        <CorporateAuthProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: 'var(--toast-bg)', color: 'var(--toast-text)', border: '1px solid var(--toast-border)', fontSize: '14px' },
              success: { iconTheme: { primary: '#f59e0b', secondary: '#000' } },
            }}
          />
          <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/track" element={<TrackOrder />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/b2b" element={<B2BInquiry />} />
              <Route path="/seller/join" element={<SellerJoin />} />
              <Route path="/sellers" element={<AllSellers />} />
              <Route path="/store/:slug" element={<SellerStore />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<CustomerOrders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders/:id/confirmation" element={<OrderConfirmation />} />
              <Route path="/profile" element={<CustomerProfile />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
            </Route>
            <Route element={<SellerLayout />}>
              <Route path="/seller" element={<SellerDashboard />} />
              <Route path="/seller/products" element={<SellerProducts />} />
              <Route path="/seller/orders" element={<SellerOrders />} />
              <Route path="/seller/payouts" element={<SellerPayouts />} />
              <Route path="/seller/marketing" element={<SellerMarketing />} />
              <Route path="/seller/settings" element={<SellerSettings />} />
            </Route>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/sellers" element={<AdminSellers />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/payouts" element={<AdminPayouts />} />
              <Route path="/admin/b2b" element={<AdminB2B />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/coupons" element={<AdminCoupons />} />
              <Route path="/admin/corporate/users" element={<AdminCorporateUsers />} />
              <Route path="/admin/corporate/catalog" element={<AdminCorporateCatalog />} />
              <Route path="/admin/corporate/quotes" element={<AdminCorporateQuotes />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
            </Route>
            <Route path="/corporate/login" element={<CorporateLogin />} />
            <Route element={<CorporateLayout />}>
              <Route path="/corporate" element={<CorporateDashboard />} />
              <Route path="/corporate/catalog" element={<CorporateCatalog />} />
              <Route path="/corporate/cart" element={<CorporateCart />} />
              <Route path="/corporate/orders" element={<CorporateOrders />} />
              <Route path="/corporate/orders/:id" element={<CorporateOrderDetail />} />
              <Route path="/corporate/quotes" element={<CorporateQuotes />} />
              <Route path="/corporate/profile" element={<CorporateProfile />} />
              <Route path="/corporate/inquiry" element={<CorporateInquiry />} />
            </Route>
            <Route element={<Layout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </Suspense>
        </CorporateAuthProvider>
        </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
