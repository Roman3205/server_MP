const mongoose = require('mongoose')

let orderSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'product'
    },
    status: {
        type: String,
        required: true,
        trim: true
    },
    way: {
        type: String
    },
    money: {
        type: Number,
        required: true
    },
    customer_id: {
        type: mongoose.ObjectId,
        ref: 'customer',
        required: true
    }
}, {
    timestamps: true
})

let Order = mongoose.model('order', orderSchema)

module.exports = Order