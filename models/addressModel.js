// models/addressModel.js

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true,
    },
    // fullName: { // Added for better clarity when selecting addresses
    //     type: String,
    //     required: true,
    // },
    // street: {
    //     type: String,
    //     required: true,
    // },
    // city: {
    //     type: String,
    //     required: true,
    // },
    // state: {
    //     type: String,
    //     required: true,
    // },
    // country: {
    //     type: String,
    //     required: true,
    // },
    // postalCode: {
    //     type: String,
    //     required: true,
    // },
    // isDefault: {
    //     type: Boolean,
    //     default: false, // Flag to indicate if this is the default address
    // },
    addresses: [
        {
            name: { type: String, required: true },
            phone: { type: String, required: true },
            pincode: { type: String, required: true },
            locality: { type: String, required: true },
            city: { type: String, required: true },
            state: { type: String, required: true },
            address: { type: String, required: true },
            landmark: { type: String },
            alternatePhone: { type: String },
            isDefault: { type: Boolean, default: false }

        }
    ],
}) //{ timestamps: true });


module.exports = mongoose.model('Address', addressSchema);
