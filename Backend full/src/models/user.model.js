const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, unique: true, sparse: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, trim: true },
    dob: { type: Date, required: true },
    password: { type: String, required: true },
    isDeafMute: { type: Boolean, required: true },
    deviceTokens: [{ type: String }],
    resetToken: { type: String },
    resetTokenExpiresAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

const UserModel = mongoose.model('User', userSchema);

class User {
  static async findById(id) {
    const user = await UserModel.findById(id).lean().exec();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  }

  static async findByPhoneNumber(phoneNumber) {
    const user = await UserModel.findOne({ phoneNumber }).lean().exec();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  }

  static async findByEmail(email) {
    const user = await UserModel.findOne({ email }).lean().exec();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  }

  static async findByUsername(username) {
    const user = await UserModel.findOne({ username }).lean().exec();
    if (!user) return null;
    return { ...user, id: user._id.toString() };
  }

  static async create(data) {
    const created = await UserModel.create(data);
    const user = created.toObject();
    return { ...user, id: user._id.toString() };
  }

  static async updateById(id, data) {
    const updated = await UserModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    })
      .lean()
      .exec();
    if (!updated) return null;
    return { ...updated, id: updated._id.toString() };
  }

  static async deleteById(id) {
    const res = await UserModel.findByIdAndDelete(id).exec();
    return !!res;
  }

  static async createResetToken(id) {
    const token = `${id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const updated = await UserModel.findByIdAndUpdate(
      id,
      {
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) return null;

    return { token, expiresAt };
  }

  static async resetPassword(id, token, newPassword) {
    const user = await UserModel.findById(id).exec();
    if (!user) return false;

    if (
      !user.resetToken ||
      user.resetToken !== token ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      return false;
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();
    return true;
  }

  static async addDeviceToken(id, token) {
    await UserModel.findByIdAndUpdate(
      id,
      { $addToSet: { deviceTokens: token } },
      { new: true },
    ).exec();
  }

  static async getDeviceTokens(id) {
    const user = await UserModel.findById(id, 'deviceTokens').lean().exec();
    return user?.deviceTokens || [];
  }

  static async findByUsernamePattern(pattern) {
    const users = await UserModel.find({
      username: { $regex: pattern, $options: 'i' }
    })
      .limit(10)
      .lean()
      .exec();
    
    return users.map(user => ({ ...user, id: user._id.toString() }));
  }
}

module.exports = User;

