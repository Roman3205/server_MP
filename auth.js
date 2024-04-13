const passport = require('passport')
let User = require('./models/customer')
let Cart = require('./models/cart')

let path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, './.env') })

let googleStrategy = require('passport-google-oauth20').Strategy
passport.use(new googleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    passReqToCallback: true,
}, async (request, accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id })
        if (user) {
            done(null, user)
        } else {
            let cart = new Cart({
                products: [],
                totalCost: 0
            })

            await cart.save()
            let newUser = {
                name: profile.displayName,
                password: "",
                mail: profile._json.email,
                profilePicture: 'user.png',
                cart_id: cart._id,
                orders: [],
                chats: [],
                reviews: [],
                refunds: [],
                operations: [],
                googleId: profile.id,
                balance: 0,
                amountRedemption: 0,
                boughtProducts: 0
            }
            let user = await User.create(newUser)
            done(null, user)
        }
    } catch (error) {
        console.log(error);
    }
}))

passport.serializeUser((user, done) => {
    done(null, String(user._id))
})

passport.deserializeUser((id, done) => {
    User.findOne({ _id: id }).exec().then((user) => {
        done(null, String(user._id))
    }).catch((error) => {
        done(error, null)
    })
})