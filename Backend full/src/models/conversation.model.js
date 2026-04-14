const mongoose = require('mongoose');

const conversationMessageSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: ['user', 'other', 'system'],
      default: 'user',
    },
    text: { type: String, required: true },
    language: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    locationType: { type: String },
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    messages: [conversationMessageSchema],
  },
  { timestamps: true },
);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

