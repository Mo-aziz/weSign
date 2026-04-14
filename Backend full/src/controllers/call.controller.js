const CallSession = require('../models/callSession.model');
const { notifyIncomingCall } = require('../services/notifications');

async function createCall(req, res, next) {
  try {
    const { deafUserId } = req.body;

    if (!deafUserId) {
      return res
        .status(400)
        .json({ message: 'deafUserId is required to create a call' });
    }

    const call = await CallSession.create({
      callerId: req.user.id,
      deafUserId,
      status: 'ringing',
      startedAt: new Date(),
    });

    notifyIncomingCall(deafUserId, call._id.toString(), { callerId: req.user.id }).catch((err) =>
      console.error('[createCall] notifyIncomingCall failed', err),
    );

    res.status(201).json({
      id: call._id.toString(),
      callerId: call.callerId.toString(),
      deafUserId: call.deafUserId.toString(),
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      transcript: call.transcript,
    });
  } catch (err) {
    next(err);
  }
}

function isCallParticipant(call, userId) {
  const uid = String(userId);
  return String(call.callerId) === uid || String(call.deafUserId) === uid;
}

async function acceptCall(req, res, next) {
  try {
    const { id } = req.params;

    const call = await CallSession.findById(id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    if (!isCallParticipant(call, req.user.id)) {
      return res.status(403).json({ message: 'Not a participant of this call' });
    }

    const updated = await CallSession.findByIdAndUpdate(
      id,
      { status: 'active' },
      { new: true },
    );

    res.json({
      id: updated._id.toString(),
      status: updated.status,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
      transcript: updated.transcript,
    });
  } catch (err) {
    next(err);
  }
}

async function endCall(req, res, next) {
  try {
    const { id } = req.params;

    const call = await CallSession.findById(id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    if (!isCallParticipant(call, req.user.id)) {
      return res.status(403).json({ message: 'Not a participant of this call' });
    }

    const updated = await CallSession.findByIdAndUpdate(
      id,
      { status: 'ended', endedAt: new Date() },
      { new: true },
    );

    res.json({
      id: updated._id.toString(),
      status: updated.status,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
      transcript: updated.transcript,
    });
  } catch (err) {
    next(err);
  }
}

async function getCall(req, res, next) {
  try {
    const { id } = req.params;
    const call = await CallSession.findById(id).lean().exec();

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    if (!isCallParticipant(call, req.user.id)) {
      return res.status(403).json({ message: 'Not a participant of this call' });
    }

    res.json({
      id: call._id.toString(),
      callerId: call.callerId.toString(),
      deafUserId: call.deafUserId.toString(),
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      transcript: call.transcript,
    });
  } catch (err) {
    next(err);
  }
}

async function addTranscript(req, res, next) {
  try {
    const { id } = req.params;
    const { from, text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'text is required' });
    }
    const validFrom = ['deafUser', 'caller', 'system'];
    if (!from || !validFrom.includes(from)) {
      return res.status(400).json({ message: 'from must be one of: deafUser, caller, system' });
    }

    const call = await CallSession.findById(id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    if (!isCallParticipant(call, req.user.id)) {
      return res.status(403).json({ message: 'Not a participant of this call' });
    }

    const entry = { from, text, createdAt: new Date() };
    const updated = await CallSession.findByIdAndUpdate(
      id,
      { $push: { transcript: entry } },
      { new: true },
    )
      .lean()
      .exec();

    res.status(201).json({
      id: updated._id.toString(),
      transcript: updated.transcript,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCall,
  acceptCall,
  endCall,
  getCall,
  addTranscript,
};

