const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    OrderId: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
            quantity: { type: Number, required: true },
            isCancelled: { type: Boolean, default: false }, // New field to track canceled status
            cancelledAt: { type: Date }, // Optional: Timestamp when canceled
            titleAtOrder: { type: String, required: true }, // Snapshot of product title
            priceAtOrder: { type: Number, required: true },
            returnReason: { type: String }, 
            returnStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'requested'], default: 'pending' }, // Return status
            returnedAt: { type: Date },// Snapshot of product price
            isReturned:{ type: Boolean, default: false },
        }
    ],
    address: {
        fullName: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
        postalCode: { type: String, required: true }
    },
    paymentMethod: { type: String, enum: ['wallet', 'cashOnDelivery', 'razorpay'], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },  // New field for combined offer and coupon discounts
    shipping: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['failed', 'shipped', 'delivered', 'cancelled', 'paid', 'returned', 'pending'], default: 'pending' },
    cancelledAt: { type: Date },
    deliveredAt: { type: Date },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }
}, { timestamps: true });

orderSchema.pre('save', function (next) {
    if (this.isNew) {
        this.OrderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
