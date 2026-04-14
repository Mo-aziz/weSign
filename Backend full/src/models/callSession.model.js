const mongoose = require('mongoose');

const transcriptItemSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: ['deafUser', 'caller', 'system'],
      required: true,
    },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const callSessionSchema = new mongoose.Schema(
  {
    callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deafUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'active', 'ended'],
      default: 'ringing',
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    transcript: [transcriptItemSchema],
  },
  { timestamps: true },
);

const CallSession = mongoose.model('CallSession', callSessionSchema);

module.exports = CallSession;

