const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Shiprocket IDs
  shiprocketOrderId: { type: String, default: '' },
  shiprocketShipmentId: { type: String, default: '' },
  awbCode: { type: String, default: '' },

  // Courier
  courierName: { type: String, default: '' },
  courierId: { type: Number, default: 0 },

  // Dates
  pickupScheduledAt: { type: Date, default: null },
  pickedUpAt: { type: Date, default: null },
  estimatedDelivery: { type: Date, default: null },

  // Status
  status: {
    type: String,
    enum: ['created', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'cancelled'],
    default: 'created'
  },

  // URLs
  trackingUrl: { type: String, default: '' },
  labelUrl: { type: String, default: '' },
  manifestUrl: { type: String, default: '' },
  invoiceUrl: { type: String, default: '' },

  // Package details
  weight: { type: Number, default: 500 }, // grams
  dimensions: {
    length: { type: Number, default: 10 },
    width: { type: Number, default: 10 },
    height: { type: Number, default: 10 }
  },
  shippingCharge: { type: Number, default: 0 },

  // Status history
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    location: { type: String, default: '' },
    description: { type: String, default: '' }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

shipmentSchema.index({ orderId: 1 });
shipmentSchema.index({ sellerId: 1 });
shipmentSchema.index({ awbCode: 1 });
shipmentSchema.index({ status: 1 });

shipmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);
