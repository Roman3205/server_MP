const mongoose = require('mongoose')

let chatSchema = new mongoose.Schema({
    people: [{
        type: mongoose.ObjectId,
        ref: 'seller'
    }, {
        type: mongoose.ObjectId,
        ref: 'customer'
    }],
    messages: [{
        type: mongoose.ObjectId,
        ref: 'message'
    }],
    uniqueId: {
        type: Number,
        required: true,
        trim: true
    }
}, {
    timestamps: true
})

let Chat = mongoose.model('chat', chatSchema)

module.exports = Chat