const axios = require('axios');

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiry = null;

// Get auth token (cached for 10 days)
async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await axios.post(`${SHIPROCKET_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD
  });

  cachedToken = res.data.token;
  tokenExpiry = Date.now() + (9 * 24 * 60 * 60 * 1000); // 9 days (refresh before 10-day expiry)
  return cachedToken;
}

function shiprocketHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Check courier serviceability
async function checkServiceability({ pickupPincode, deliveryPincode, weight, cod = 0 }) {
  const token = await getToken();
  const res = await axios.get(`${SHIPROCKET_BASE}/courier/serviceability/`, {
    params: {
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight: weight / 1000, // convert grams to kg
      cod
    },
    headers: shiprocketHeaders(token)
  });
  return res.data;
}

// Create order on Shiprocket
async function createShiprocketOrder(orderData) {
  const token = await getToken();
  const res = await axios.post(`${SHIPROCKET_BASE}/orders/create/adhoc`, orderData, {
    headers: shiprocketHeaders(token)
  });
  return res.data;
}

// Assign courier (AWB)
async function assignCourier({ shipmentId, courierId }) {
  const token = await getToken();
  const res = await axios.post(`${SHIPROCKET_BASE}/courier/assign/awb`, {
    shipment_id: shipmentId,
    courier_id: courierId
  }, { headers: shiprocketHeaders(token) });
  return res.data;
}

// Schedule pickup
async function schedulePickup({ shipmentId }) {
  const token = await getToken();
  const res = await axios.post(`${SHIPROCKET_BASE}/courier/generate/pickup`, {
    shipment_id: [shipmentId]
  }, { headers: shiprocketHeaders(token) });
  return res.data;
}

// Track by AWB
async function trackByAwb(awbCode) {
  const token = await getToken();
  const res = await axios.get(`${SHIPROCKET_BASE}/courier/track/awb/${awbCode}`, {
    headers: shiprocketHeaders(token)
  });
  return res.data;
}

// Get registered pickup locations
async function getPickupLocations() {
  const token = await getToken();
  const res = await axios.get(`${SHIPROCKET_BASE}/settings/company/pickup`, {
    headers: shiprocketHeaders(token)
  });
  // Returns { data: { shipping_address: [ { pickup_location, ... }, ... ] } }
  const locations = res.data?.data?.shipping_address || res.data?.shipping_address || [];
  return locations;
}

// Generate label
async function generateLabel({ shipmentId }) {
  const token = await getToken();
  const res = await axios.post(`${SHIPROCKET_BASE}/courier/generate/label`, {
    shipment_id: [shipmentId]
  }, { headers: shiprocketHeaders(token) });
  return res.data;
}

// Generate manifest
async function generateManifest({ shipmentId }) {
  const token = await getToken();
  const res = await axios.post(`${SHIPROCKET_BASE}/manifests/generate`, {
    shipment_id: [shipmentId]
  }, { headers: shiprocketHeaders(token) });
  return res.data;
}

module.exports = {
  checkServiceability,
  createShiprocketOrder,
  assignCourier,
  schedulePickup,
  trackByAwb,
  generateLabel,
  generateManifest,
  getPickupLocations,
  getToken
};
