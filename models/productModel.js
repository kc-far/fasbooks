const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: {
        type: [String], 
        required: true
    },
    price: {
        type: Number, 
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true 
    },
    categoryId: {
        type:mongoose.Schema.Types.ObjectId, 
        required: true,
        ref:'Category'
    },
    discountPercentage: { type: Number, default: 0 },
    discountPrice: { type: Number,default: 0},
}, { timestamps: true });

bookSchema.virtual('discountedPrice').get(function () {
    return this.price - (this.price * (this.discountPercentage / 100));
});
const Book = mongoose.model('Book', bookSchema);

module.exports = Book; 
