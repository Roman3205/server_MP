const mongoose = require('mongoose')

let refundSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        trim: true
    },
    uniqueNumber: {
        type: Number,
        required: true
    },
    product_id: {
        type: mongoose.ObjectId,
        ref: 'product',
        required: true,
    },
    albumLink: {
        type: String,
        required: true,
        trim: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    returnMoney: {
        type: Boolean,
        required: true
    },
    order_id: {
        type: mongoose.ObjectId,
        ref: 'order',
        required: true
    },
    author_id: {
        type: mongoose.ObjectId,
        ref: 'customer',
        required: true
    }
}, {
    timestamps: true
})

let Refund = mongoose.model('refund', refundSchema)

module.exports = Refund