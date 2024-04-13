const mongoose = require('mongoose')

let productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    size: {
        type: String,
        required: true,
    },
    weight: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true,
        trim: true
    },
    averageRating: {
        type: Number,
        required: true,
        trim: true
    },
    amountReviews: {
        type: Number,
        required: true,
        trim: true
    },
    article: {
        type: Number,
        required: true,
        trim: true
    },
    amountSold: {
        type: Number,
        required: true,
        trim: true
    },
    discount: {
        type: Number,
        required: true,
        trim: true
    },
    picture: {
        type: String,
        required: true,
        trim: true
    },
    runOut: {
        type: Boolean,
        required: true,
        trim: true
    },
    brand_id: {
        required: true,
        type: mongoose.ObjectId,
        ref: 'seller'
    },
    reviews: [{
        type: mongoose.ObjectId,
        ref: 'review'
    }]
}, {
    timestamps: true
})

let Product = mongoose.model('product', productSchema)

module.exports = Product