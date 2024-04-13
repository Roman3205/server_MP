let mongoose = require('mongoose')

let cartSchema = new mongoose.Schema({
    products: [{
        type: mongoose.ObjectId,
        ref: 'product'
    }],
    totalCost: Number
}, {
    timestamps: true
})

let Cart = mongoose.model('cart', cartSchema)

module.exports = Cart