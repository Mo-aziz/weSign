function userToJson(user) {
  return {
    id: user.id || (user._id && user._id.toString()),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    email: user.email,
    dob: user.dob,
    isDeafMute: user.isDeafMute,
  };
}

module.exports = {
  userToJson,
};

