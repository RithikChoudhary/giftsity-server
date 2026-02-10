import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('giftsity_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('giftsity_token');
      localStorage.removeItem('giftsity_user');
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  sendOtp: (email) => API.post('/auth/send-otp', { email }),
  verifyOtp: (email, otp) => API.post('/auth/verify-otp', { email, otp }),
  registerSeller: (data) => API.post('/auth/register-seller', data),
  uploadAvatar: (formData) => API.post('/auth/upload-avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  me: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  updateAddresses: (addresses) => API.put('/auth/addresses', { addresses }),
};

export const productAPI = {
  getAll: (params) => API.get('/products', { params }),
  getFeatured: () => API.get('/products/featured'),
  getCategories: () => API.get('/products/categories'),
  getBySlug: (slug) => API.get(`/products/${slug}`),
};

export const orderAPI = {
  create: (data) => API.post('/orders', data),
  verifyPayment: (data) => API.post('/orders/verify-payment', data),
  getMyOrders: () => API.get('/orders/my-orders'),
  getById: (id) => API.get(`/orders/${id}`),
};

export const sellerAPI = {
  getDashboard: () => API.get('/seller/dashboard'),
  getProducts: () => API.get('/seller/products'),
  createProduct: (data) => API.post('/seller/products', data),
  updateProduct: (id, data) => API.put(`/seller/products/${id}`, data),
  deleteProduct: (id) => API.delete(`/seller/products/${id}`),
  getOrders: (params) => API.get('/seller/orders', { params }),
  shipOrder: (id, data) => API.put(`/seller/orders/${id}/ship`, data),
  getPayouts: () => API.get('/seller/payouts'),
  getSettings: () => API.get('/seller/settings'),
  updateSettings: (data) => API.put('/seller/settings', data),
  getMarketing: () => API.get('/seller/marketing'),
  requestUnsuspend: (reason) => API.post('/seller/request-unsuspend', { reason }),
};

export const shippingAPI = {
  checkServiceability: (orderId) => API.post('/seller/shipping/serviceability', { orderId }),
  createShipment: (orderId, data) => API.post(`/seller/shipping/${orderId}/create`, data),
  assignCourier: (orderId, courierId) => API.post(`/seller/shipping/${orderId}/assign-courier`, { courierId }),
  schedulePickup: (orderId) => API.post(`/seller/shipping/${orderId}/pickup`),
  getTracking: (orderId) => API.get(`/seller/shipping/${orderId}/track`),
  getLabel: (orderId) => API.get(`/seller/shipping/${orderId}/label`),
};

export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getSettings: () => API.get('/admin/settings'),
  updateSettings: (data) => API.put('/admin/settings', data),
  getSellers: (params) => API.get('/admin/sellers', { params }),
  getSeller: (id) => API.get(`/admin/sellers/${id}`),
  approveSeller: (id) => API.put(`/admin/sellers/${id}/approve`),
  suspendSeller: (id, reason) => API.put(`/admin/sellers/${id}/suspend`, { reason }),
  setSellerCommission: (id, rate) => API.put(`/admin/sellers/${id}/commission`, { commissionRate: rate }),
  getProducts: (params) => API.get('/admin/products', { params }),
  featureProduct: (id) => API.put(`/admin/products/${id}/feature`),
  toggleProduct: (id) => API.put(`/admin/products/${id}/toggle`),
  getOrders: (params) => API.get('/admin/orders', { params }),
  updateOrder: (id, data) => API.put(`/admin/orders/${id}`, data),
  getCategories: () => API.get('/admin/categories'),
  createCategory: (data) => API.post('/admin/categories', data),
  updateCategory: (id, data) => API.put(`/admin/categories/${id}`, data),
  deleteCategory: (id) => API.delete(`/admin/categories/${id}`),
  getPayouts: (params) => API.get('/admin/payouts', { params }),
  calculatePayouts: (data) => API.post('/admin/payouts/calculate', data),
  markPayoutPaid: (id, data) => API.put(`/admin/payouts/${id}/mark-paid`, data),
  getUsers: () => API.get('/admin/users'),
  getCustomers: (params) => API.get('/admin/customers', { params }),
  getSellerHealth: (id) => API.get(`/admin/sellers/${id}/health`),
  runCron: () => API.post('/admin/cron/run'),
};

export const b2bAPI = {
  submitInquiry: (data) => API.post('/b2b/inquiries', data),
  getInquiries: (params) => API.get('/b2b/inquiries', { params }),
  getInquiry: (id) => API.get(`/b2b/inquiries/${id}`),
  updateInquiry: (id, data) => API.put(`/b2b/inquiries/${id}`, data),
  deleteInquiry: (id) => API.delete(`/b2b/inquiries/${id}`),
};

export const storeAPI = {
  getTopSellers: () => API.get('/store/featured/top-sellers'),
  getStore: (slug) => API.get(`/store/${slug}`),
  getProducts: (slug, params) => API.get(`/store/${slug}/products`, { params }),
  getReviews: (slug, params) => API.get(`/store/${slug}/reviews`, { params }),
};

export const reviewAPI = {
  getByProduct: (productId, params) => API.get(`/reviews/product/${productId}`, { params }),
  create: (data) => API.post('/reviews', data),
  hide: (id, reason) => API.put(`/reviews/${id}/hide`, { reason }),
};

export default API;
