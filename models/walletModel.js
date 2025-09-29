const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    transactions: [
        {
            amount: {
                type: Number,
                required: true,
            },
            transactionType: {
                type: String, // 'credit' or 'debit'
                required: true,
            },
            date: {
                type: Date,
                default: Date.now,
            },
            orderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Order', // Assuming you have an Order model
            },
            message: {
                type:String,
            },
        },
    ],
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
