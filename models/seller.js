const mongoose = require('mongoose')

let sellerSchema = new mongoose.Schema({
    brandName: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    mail: {
        type: String,
        required: true,
        trim: true
    },
    tel: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    products: [{
        type: mongoose.ObjectId,
        ref: 'product'
    }],
    orders: [{
        type: mongoose.ObjectId,
        ref: 'order'
    }],
    balance: {
        type: Number,
        required: true
    },
    sold: {
        type: Number,
        required: true
    },
    activeOrders: {
        type: Number,
        required: true
    },
    returns: {
        type: Number,
        required: true
    },
    activeReturns: {
        type: Number,
        required: true
    },
    chats: [{
        type: mongoose.ObjectId,
        ref: 'chat'
    }],
    refunds: [{
        type: mongoose.ObjectId,
        ref: 'refund'
    }],
    storages: [{
        type: String
    }]
}, {
    timestamps: true
})

let Seller = mongoose.model('seller', sellerSchema)

module.exports = Seller