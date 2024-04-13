const mongoose = require('mongoose')

let messageSchema = new mongoose.Schema({
    from: mongoose.ObjectId,
    to: mongoose.ObjectId,
    text: {
        type: String,
        trim: true,
        required: true
    }
}, {
    timestamps: true
})

let Message = mongoose.model('message', messageSchema)

module.exports = Message