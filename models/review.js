const mongoose = require('mongoose')

let reviewSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    author_id: {
        type: mongoose.ObjectId,
        ref: 'customer',
        required: true
    },
    product_id: {
        type: mongoose.ObjectId,
        ref: 'product',
        required: true
    }
}, {
    timestamps: true
})

let Review = mongoose.model('review', reviewSchema)

module.exports = Review