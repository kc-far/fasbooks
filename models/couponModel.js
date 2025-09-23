const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discount: {
        type: Number, // Assuming it's a percentage discount
        required: true,
        min: 1,
        max: 100
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    minOrderValue: {
        type: Number,
        default: 0
    },
    usageLimit: {
        type: Number,
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    isFirstOrder: { type: Boolean, default: true },
    
    


},{ timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);