const { body, param, validationResult } = require('express-validator');

/**
 * Middleware that checks validation results and returns 400 if any errors.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// ---- Order Creation (B2C) ----
const validateOrderCreation = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId')
    .notEmpty().withMessage('Product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('shippingAddress')
    .isObject().withMessage('Shipping address is required'),
  body('shippingAddress.name')
    .notEmpty().withMessage('Shipping name is required'),
  body('shippingAddress.street')
    .notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city')
    .notEmpty().withMessage('City is required'),
  body('shippingAddress.state')
    .notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode')
    .notEmpty().withMessage('Pincode is required')
    .matches(/^\d{6}$/).withMessage('Pincode must be 6 digits'),
  body('shippingAddress.phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
  validate
];

// ---- Payment Verification ----
const validatePaymentVerification = [
  body('orderId')
    .notEmpty().withMessage('orderId is required')
    .isString().withMessage('orderId must be a string'),
  validate
];

// ---- Review Creation ----
const validateReviewCreation = [
  body('productId')
    .notEmpty().withMessage('Product ID is required'),
  body('orderId')
    .notEmpty().withMessage('Order ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('reviewText')
    .optional()
    .isString()
    .isLength({ max: 2000 }).withMessage('Review text cannot exceed 2000 characters'),
  validate
];

// ---- B2B Inquiry ----
const validateB2BInquiry = [
  body('companyName')
    .trim().notEmpty().withMessage('Company name is required')
    .isLength({ max: 200 }).withMessage('Company name too long'),
  body('contactPerson')
    .trim().notEmpty().withMessage('Contact person is required')
    .isLength({ max: 100 }).withMessage('Contact person name too long'),
  body('email')
    .trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('phone')
    .trim().notEmpty().withMessage('Phone is required')
    .matches(/^\d{10,15}$/).withMessage('Phone must be 10-15 digits'),
  body('numberOfEmployees')
    .optional()
    .isInt({ min: 1 }).withMessage('Number of employees must be a positive integer'),
  body('budgetPerGift')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('quantityNeeded')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('occasion')
    .optional()
    .isString().isLength({ max: 200 }).withMessage('Occasion too long'),
  body('specialRequirements')
    .optional()
    .isString().isLength({ max: 2000 }).withMessage('Special requirements too long'),
  validate
];

// ---- Corporate Order Creation ----
const validateCorporateOrder = [
  body('items')
    .isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId')
    .notEmpty().withMessage('Product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('shippingAddress')
    .isObject().withMessage('Shipping address is required'),
  body('shippingAddress.name')
    .notEmpty().withMessage('Shipping name is required'),
  body('shippingAddress.street')
    .notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city')
    .notEmpty().withMessage('City is required'),
  body('shippingAddress.state')
    .notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode')
    .notEmpty().withMessage('Pincode is required'),
  body('shippingAddress.phone')
    .notEmpty().withMessage('Phone number is required'),
  validate
];

module.exports = {
  validate,
  validateOrderCreation,
  validatePaymentVerification,
  validateReviewCreation,
  validateB2BInquiry,
  validateCorporateOrder
};
