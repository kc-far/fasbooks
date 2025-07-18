const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    googleId: { type: String },
    isAdmin: { type: Boolean, required: true, default: false },
    isBlocked: { type: Boolean, required: true, default: false },
    referralCode: { type: String, unique: true }, // Add referralCode field
    gender: { type: String, enum: ['male', 'female', 'other'] },
    otp: String,
    otpExpires: Date,
});

userSchema.statics.generateReferralCode = async function () {
    let code;
    let exists;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Example format
        exists = await this.findOne({ referralCode: code });
    } while (exists);
    return code;
};


userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    if (!this.referralCode) {
        this.referralCode = await this.constructor.generateReferralCode();
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
