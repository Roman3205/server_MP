const mongoose = require('mongoose')

let operationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    money: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
})

let customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        trim: true
    },
    mail: {
        type: String,
        required: true,
        trim: true
    },
    profilePicture: {
        type: Buffer,
        select: false
    },
    cart_id: {
        type: mongoose.ObjectId,
        ref: 'cart',
        required: true
    },
    orders: [{
        type: mongoose.ObjectId,
        ref: 'order'
    }],
    chats: [{
        type: mongoose.ObjectId,
        ref: 'chat'
    }],
    reviews: [{
        type: mongoose.ObjectId,
        ref: 'review'
    }],
    refunds: [{
        type: mongoose.ObjectId,
        ref: 'refund'
    }],
    operations: [operationSchema],
    googleId: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
    amountRedemption: {
        type: Number,
        required: true
    },
    boughtProducts: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
})

let Customer = mongoose.model('customer', customerSchema)

module.exports = Customer