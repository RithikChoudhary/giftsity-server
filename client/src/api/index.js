import axios from 'axios';

// Main API (auth, products, orders, admin, reviews, store, wishlist, coupons, b2b)
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// Seller API (seller dashboard, products, orders, shipping) — separate server in production
const SellerAPI = axios.create({
  baseURL: import.meta.env.VITE_SELLER_API_URL || '/api/seller'
});

// Corporate API (corporate portal) — separate server on port 5002
const CorporateAPI = axios.create({
  baseURL: import.meta.env.VITE_CORPORATE_API_URL || '/api/corporate'
});

// Shared interceptors for both instances
function attachAuth(config) {
  const token = localStorage.getItem('giftsity_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

function handleAuthError(err) {
  if (err.response?.status === 401) {
    const url = err.config?.url || '';
    const isAuthRoute = url.includes('/auth/send-otp') || url.includes('/auth/verify-otp') || url.includes('/auth/register');
    if (!isAuthRoute) {
      localStorage.removeItem('giftsity_token');
      localStorage.removeItem('giftsity_user');
    }
  }
  return Promise.reject(err);
}

API.interceptors.request.use(attachAuth);
API.interceptors.response.use((res) => res, handleAuthError);

SellerAPI.interceptors.request.use(attachAuth);
SellerAPI.interceptors.response.use((res) => res, handleAuthError);

CorporateAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('giftsity_corporate_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
CorporateAPI.interceptors.response.use((res) => res, (err) => {
  if (err.response?.status === 401) {
    localStorage.removeItem('giftsity_corporate_token');
    localStorage.removeItem('giftsity_corporate_user');
  }
  return Promise.reject(err);
});

// --- API exports ---

export const authAPI = {
  sendOtp: (email) => API.post('/auth/send-otp', { email }),
  verifyOtp: (email, otp) => API.post('/auth/verify-otp', { email, otp }),
  registerSeller: (data) => API.post('/auth/register-seller', data),
  uploadAvatar: (formData) => API.post('/auth/upload-avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  me: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  updateAddresses: (addresses) => API.put('/auth/addresses', { addresses }),
  getAvailableRoles: () => API.get('/auth/available-roles'),
  switchRole: (role) => API.post('/auth/switch-role', { role }),
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
  getDashboard: () => SellerAPI.get('/dashboard'),
  getProducts: () => SellerAPI.get('/products'),
  createProduct: (data) => SellerAPI.post('/products', data),
  updateProduct: (id, data) => SellerAPI.put(`/products/${id}`, data),
  deleteProduct: (id) => SellerAPI.delete(`/products/${id}`),
  getOrders: (params) => SellerAPI.get('/orders', { params }),
  shipOrder: (id, data) => SellerAPI.put(`/orders/${id}/ship`, data),
  getPayouts: () => SellerAPI.get('/payouts'),
  getSettings: () => SellerAPI.get('/settings'),
  updateSettings: (data) => SellerAPI.put('/settings', data),
  getMarketing: () => SellerAPI.get('/marketing'),
  requestUnsuspend: (reason) => SellerAPI.post('/request-unsuspend', { reason }),
  bulkCsvUpload: (formData) => SellerAPI.post('/products/bulk-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadImage: (formData) => SellerAPI.post('/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const shippingAPI = {
  checkServiceability: (orderId) => SellerAPI.post('/shipping/serviceability', { orderId }),
  createShipment: (orderId, data) => SellerAPI.post(`/shipping/${orderId}/create`, data),
  assignCourier: (orderId, courierId, courierRate) => SellerAPI.post(`/shipping/${orderId}/assign-courier`, { courierId, courierRate }),
  schedulePickup: (orderId) => SellerAPI.post(`/shipping/${orderId}/pickup`),
  getTracking: (orderId) => SellerAPI.get(`/shipping/${orderId}/track`),
  getLabel: (orderId) => SellerAPI.get(`/shipping/${orderId}/label`),
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
  createCorporateUserFromInquiry: (inquiryId) => API.post('/admin/corporate/users/from-inquiry', { inquiryId }),
  // Audit logs
  getActivityLogs: (params) => API.get('/admin/logs/activity', { params }),
  getAuthLogs: (params) => API.get('/admin/logs/auth', { params }),
  getOtpLogs: (params) => API.get('/admin/logs/otp', { params }),
};

export const b2bAPI = {
  submitInquiry: (data) => API.post('/b2b/inquiries', data),
  getInquiries: (params) => API.get('/b2b/inquiries', { params }),
  getInquiry: (id) => API.get(`/b2b/inquiries/${id}`),
  updateInquiry: (id, data) => API.put(`/b2b/inquiries/${id}`, data),
  deleteInquiry: (id) => API.delete(`/b2b/inquiries/${id}`),
};

export const chatAPI = {
  getConversations: () => API.get('/chat/conversations'),
  createConversation: (data) => API.post('/chat/conversations', data),
  getMessages: (id, params) => API.get(`/chat/conversations/${id}/messages`, { params }),
  sendMessage: (id, data) => API.post(`/chat/conversations/${id}/messages`, data),
};

export const notificationAPI = {
  getAll: (params) => API.get('/notifications', { params }),
  getUnreadCount: () => API.get('/notifications/unread-count'),
  markRead: (id) => API.put(`/notifications/${id}/read`),
  markAllRead: () => API.put('/notifications/read-all'),
};

export const returnAPI = {
  create: (data) => API.post('/returns', data),
  getMyRequests: () => API.get('/returns/my-requests'),
  getById: (id) => API.get(`/returns/${id}`),
};

export const sellerReturnAPI = {
  getReturns: (params) => SellerAPI.get('/returns', { params }),
  approve: (id, data) => SellerAPI.put(`/returns/${id}/approve`, data),
  reject: (id, data) => SellerAPI.put(`/returns/${id}/reject`, data),
  markReceived: (id) => SellerAPI.put(`/returns/${id}/received`),
};

export const storeAPI = {
  getTopSellers: () => API.get('/store/featured/top-sellers'),
  getAllSellers: (params) => API.get('/store/sellers', { params }),
  getStore: (slug) => API.get(`/store/${slug}`),
  getProducts: (slug, params) => API.get(`/store/${slug}/products`, { params }),
  getReviews: (slug, params) => API.get(`/store/${slug}/reviews`, { params }),
};

export const reviewAPI = {
  getByProduct: (productId, params) => API.get(`/reviews/product/${productId}`, { params }),
  create: (data) => API.post('/reviews', data),
  hide: (id, reason) => API.put(`/reviews/${id}/hide`, { reason }),
};

export const corporateAPI = {
  sendOtp: (email) => CorporateAPI.post('/auth/send-otp', { email }),
  verifyOtp: (data) => CorporateAPI.post('/auth/verify-otp', data),
  me: () => CorporateAPI.get('/auth/me'),
  updateProfile: (data) => CorporateAPI.put('/auth/profile', data),
  getCatalog: (params) => CorporateAPI.get('/catalog', { params }),
  getCatalogProduct: (id) => CorporateAPI.get(`/catalog/${id}`),
  createOrder: (data) => CorporateAPI.post('/orders', data),
  verifyPayment: (data) => CorporateAPI.post('/orders/verify-payment', data),
  getOrders: (params) => CorporateAPI.get('/orders', { params }),
  getOrder: (id) => CorporateAPI.get(`/orders/${id}`),
  cancelOrder: (id, data) => CorporateAPI.post(`/orders/${id}/cancel`, data),
  getQuotes: () => CorporateAPI.get('/quotes'),
  getQuote: (id) => CorporateAPI.get(`/quotes/${id}`),
  approveQuote: (id, data) => CorporateAPI.post(`/quotes/${id}/approve`, data),
  rejectQuote: (id, data) => CorporateAPI.post(`/quotes/${id}/reject`, data),
  submitInquiry: (data) => CorporateAPI.post('/inquiries', data),
  // Download token + PDF/CSV downloads
  getDownloadToken: () => CorporateAPI.post('/orders/download-token'),
  getInvoiceUrl: (orderId, downloadToken) => `${CorporateAPI.defaults.baseURL}/orders/${orderId}/invoice?downloadToken=${downloadToken}`,
  getExportCsvUrl: (downloadToken) => `${CorporateAPI.defaults.baseURL}/orders/export/csv?downloadToken=${downloadToken}`,
  getQuotePdfUrl: (quoteId, downloadToken) => `${CorporateAPI.defaults.baseURL}/quotes/${quoteId}/pdf?downloadToken=${downloadToken}`,
};

export { SellerAPI, CorporateAPI };
export default API;
