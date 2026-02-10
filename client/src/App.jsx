import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';

import Layout from './components/Layout';
import SellerLayout from './components/SellerLayout';
import AdminLayout from './components/AdminLayout';

import Home from './pages/public/Home';
import Shop from './pages/public/Shop';
import ProductDetail from './pages/public/ProductDetail';
import Auth from './pages/public/Auth';
import B2BInquiry from './pages/public/B2BInquiry';
import SellerJoin from './pages/public/SellerJoin';
import Cart from './pages/public/Cart';
import SellerStore from './pages/public/SellerStore';

import CustomerOrders from './pages/customer/CustomerOrders';
import OrderDetail from './pages/customer/OrderDetail';
import CustomerProfile from './pages/customer/CustomerProfile';

import SellerDashboard from './pages/seller/SellerDashboard';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';
import SellerPayouts from './pages/seller/SellerPayouts';
import SellerMarketing from './pages/seller/SellerMarketing';
import SellerSettings from './pages/seller/SellerSettings';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSellers from './pages/admin/AdminSellers';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminB2B from './pages/admin/AdminB2B';
import AdminCustomers from './pages/admin/AdminCustomers';

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: 'var(--toast-bg)', color: 'var(--toast-text)', border: '1px solid var(--toast-border)', fontSize: '14px' },
              success: { iconTheme: { primary: '#f59e0b', secondary: '#000' } },
            }}
          />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/b2b" element={<B2BInquiry />} />
              <Route path="/seller/join" element={<SellerJoin />} />
              <Route path="/store/:slug" element={<SellerStore />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<CustomerOrders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/profile" element={<CustomerProfile />} />
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
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
