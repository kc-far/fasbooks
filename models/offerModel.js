const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100 // Discount percentage should be between 0 and 100
    },
    applicableProducts: [
        {
            type: mongoose.Schema.Types.ObjectId, // Array of product IDs
            ref: 'Book' // Reference to the Book (product) model
        }
    ],
    applicableCategories: [
        {
            type: mongoose.Schema.Types.ObjectId, // Array of category IDs
            ref: 'Category' // Reference to the Category model
        }
    ],
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true // Set to true by default
    }
});

// Create the Offer model
const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
