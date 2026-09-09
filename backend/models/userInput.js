const mongoose = require('mongoose');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

function validateUser(reqBody) {
  console.log('user request', reqBody);
  const schema = Joi.object({
    userID: Joi.objectId().required(),
    amount: Joi.number().required(),
    SenderPhone: Joi.string()
      .pattern(/^233-\d{9}$/)
      .required(),
    receiverPhone: Joi.string()
      .pattern(/^233-\d{9}$/)
      .required(),
    device: Joi.string().required(),
    // status: Joi.string().valid('processing', 'flagged', 'rejected'),
  });

  return schema.validate(reqBody, { allowUnknown: true, abortEarly: false });
}

const userLocation = new mongoose.Schema({
  lat: { type: String, required: true },
  long: { type: String, required: true },
});

const userInput = new mongoose.Schema(
  {
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserRegister',
      required: true,
    },
    amount: { type: Number, required: true },
    SenderPhone: { type: String, required: true },
    receiverPhone: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: 'processing',
      enum: ['processing', 'flagged', 'rejected', 'blocked', 'completed', 'approved'],
    },
    channel: {
      type: String,
      enum: ['send_money', 'cash_out', 'cash_in', 'send', 'transfer', 'buy_goods', 'pay_bill'],
      default: 'send_money',
    },
    transactionType: {
      type: String,
      default: 'send_money',
    },
    reason: { type: String },
    fraudScore: { type: String },
    region: { type: String },
    city: { type: String },
    country: { type: String },
    location: userLocation,
    device: { type: String },
  },
  { timestamps: true },
);

const userInputs = new mongoose.Schema({
  is_new_user: { type: Number, required: true, enum: [0, 1], default: 0 },
  txn_unusual_location: {
    type: Number,
    required: true,
    enum: [0, 1],
    default: 0,
  },
  txn_unusual_time: { type: Number, required: true, enum: [0, 1], default: 0 },
  txn_unusual_amount: {
    type: Number,
    required: true,
    enum: [0, 1],
    default: 0,
  },
  device_changed: { type: Number, required: true, enum: [0, 1], default: 0 },
  ip_mismatch: { type: Number, required: true, enum: [0, 1], default: 0 },
  has_multiple_anomalies: {
    type: Number,
    required: true,
    enum: [0, 1],
    default: 0,
  },
  sim_device_change: { type: Number, required: true, enum: [0, 1], default: 0 },
  account_takeover_risk: {
    type: Number,
    required: true,
    enum: [0, 1],
    default: 0,
  },
  fraud_detected: { type: Number, required: true, enum: [0, 1], default: 0 },
  was_reversed: { type: Number, required: true, enum: [0, 1], default: 0 },
  was_reported: { type: Number, required: true, enum: [0, 1], default: 0 },
  fraud_account_takeover: {
    type: Number,
    required: true,
    enum: [0, 1],
    default: 0,
  },
  platform_mtn_momo: { type: Number, required: true, enum: [0, 1], default: 0 },
  txn_cash_in: { type: Number, required: true, enum: [0, 1], default: 0 },
  txn_cash_out: { type: Number, required: true, enum: [0, 1], default: 0 },
  victim_vulnerability: {
    type: Number,
    required: true,
    enum: [0, 1],
    default: 0,
  },
  detection_score: { type: Number, required: true, enum: [0, 1], default: 0 },
});

const UserInputs = mongoose.model('UserInputs', userInput);

module.exports = { validateUser, UserInputs };
