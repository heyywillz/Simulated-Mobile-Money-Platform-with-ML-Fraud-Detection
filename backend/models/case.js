const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String },
    score: { type: Number, default: 0 },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const analystNoteSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => `note_${Date.now()}` },
    author: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const caseSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true },
    transactionId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserRegister' },
    userName: { type: String, default: 'Anonymous User' },
    userPhone: { type: String, default: '0240000000' },
    detectionType: {
      type: String,
      enum: ['atod', 'transaction_anomaly'],
      default: 'transaction_anomaly',
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'approved', 'blocked', 'escalated'],
      default: 'open',
    },
    transaction: { type: mongoose.Schema.Types.Mixed },
    signals: [signalSchema],
    userProfile: { type: mongoose.Schema.Types.Mixed },
    analystNotes: [analystNoteSchema],
  },
  { timestamps: true },
);

// Virtual for id mapping to caseId
caseSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret.caseId || ret._id;
    return ret;
  },
});

const Case = mongoose.model('Case', caseSchema);

module.exports = { Case };
