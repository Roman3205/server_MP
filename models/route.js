const mongoose = require('mongoose')

let routeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    money: {
        type: String,
        required: true
    },
    distance: {
        type: String,
        required: true
    },
    hours: {
        type: String,
        required: true
    }
}, {
    timestamps: true
})

let Route = mongoose.model('route', routeSchema)

module.exports = Route