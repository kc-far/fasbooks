const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    googleId: { type: String },
    isAdmin: { type: Boolean, required: true, default: false },
    isBlocked: { type: Boolean, required: true, default: false },
    referralCode: { type: String, unique: true }, 
    referralLink: { type: String, unique: true },
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

userSchema.statics.generateReferralLink=async function(userId){
   try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID');
        }

        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (!user.referralCode) {
            user.referralCode = await this.generateReferralCode();
            await user.save();
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const referralLink = `${baseUrl}?ref=${user.referralCode}`;
        user.referralLink = referralLink;
        await user.save();

        return referralLink;
   } catch (error) {
        throw new Error(`Failed to generate referral link: ${error.message}`);
   }
}


userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    if (!this.referralCode) {
        this.referralCode = await this.constructor.generateReferralCode();
    }
    // if (!this.referralLink) {
    //     const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    //     this.referralLink = `${baseUrl}/signup?ref=${this.referralCode}`;
    // }
    next();
});

module.exports = mongoose.model('User', userSchema);
