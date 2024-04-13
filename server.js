let express = require('express')
let app = express()
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let cookieParser = require('cookie-parser')
let path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, './.env') })
let frontHost = process.env.FRONTEND_HOST
let backPort = process.env.VITE_BACKEND_PORT
let backHost = process.env.VITE_BACKEND_HOST
let paymentSite = process.env.PAYMENT_SITE

app.listen(backPort, () => {
    console.log('http://' + backHost + ':' + backPort)
})

let cors = require('cors')
app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
        if ([frontHost, paymentSite].includes(origin) || !origin) {
            callback(null, true)
        } else {
            throw Error('Not allowed by CORS')
        }
    }
}))


// app.use((req, res, next) => {
//     if (req.get('User-Agent').toLowerCase().includes('postman')) {
//         return res.status(403).send('Запрещено')
//     }

//     next()
// })

app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())

let mongoose = require('mongoose')
mongoose.set('strictQuery', false)
let uri = process.env.MONGODB_HOST
mongoose.connect(uri).catch(error => {
    console.log('Произошла ошибка с подключением бд');
})

const Cart = require('./models/cart')
const Chat = require('./models/chat')
const Customer = require('./models/customer')
const Order = require('./models/order')
const Message = require('./models/message')
const Refund = require('./models/refund')
const Review = require('./models/review')
const Seller = require('./models/seller')
const Product = require('./models/product')
const Route = require('./models/route')

const session = require('express-session')

let mongodbSession = require('connect-mongodb-session')(session)
let store = new mongodbSession({
    uri: process.env.MONGODB_HOST,
    collection: 'mySessions',
    expires: 1000 * 3600 * 24 * 3
})
app.use(
    session({
        secret: process.env.TOKEN_USER,
        saveUninitialized: false,
        resave: false,
        store: store,
        name: process.env.COOKIE_USER,
        cookie: {
            secure: true,
            maxAge: 1000 * 3600 * 24 * 3,
            httpOnly: true,
        }
    })
);

const passport = require('passport')
require('./auth')
app.use(passport.initialize())
app.use(passport.session())

let VerifyTokenUser = (req, res, next) => {
    if (!req.session.user && !req.user) {
        return res.status(401).send('Вы не авторизованы')
    }
    req.userId = req.session.user || req.user
    next()
}

let VerifyTokenSeller = (req, res, next) => {
    if (!req.session.seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    req.sellerId = req.session.seller

    next()
}

let CreateNumPay = () => {
    let result = ''
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 40; i++) {
        let random = Math.floor(Math.random() * characters.length)
        result += characters.charAt(random)
    }

    return result
}

let getRandomArticle = () => {
    let min = 100000
    let max = 999999
    return Math.floor(Math.random() * (max - min) + min)
}

let CreateArticle = async () => {
    while (true) {
        article = getRandomArticle()
        let existArticle = await Product.findOne({ article: article })
        if (!existArticle) {
            return article
        }
    }
}

let CreateUniqueChatId = async () => {
    while (true) {
        let chatId = getRandomArticle()
        let existId = await Chat.findOne({ uniqueId: chatId })
        if (!existId) {
            return chatId
        }
    }
}

let CreateUniqueRefundId = async () => {
    while (true) {
        let refundId = getRandomArticle()
        let existRefundId = await Refund.findOne({ uniqueNumber: refundId })
        if (!existRefundId) {
            return refundId
        }
    }
}

app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }))
app.get('/google/callback', passport.authenticate('google', { successRedirect: process.env.FRONTEND_HOST, failureRedirect: process.env.FRONTEND_HOST }))

app.post('/registration', async (req, res) => {
    try {
        let { name, password, mail } = req.body

        if (!name || !password || !mail) {
            return res.status(400).send('Пропущены требуемые поля запроса')

        }

        let checkMail = await Customer.findOne({ mail: mail })

        if (checkMail) {
            return res.status(409).send('Аккаунт с введенной почтой уже существует')
        }

        let salt = await bcrypt.genSalt(10)
        let hashedPassword = await bcrypt.hash(password, salt)

        let cart = new Cart({
            products: [],
            totalCost: 0
        })

        await cart.save()

        let customer = new Customer({
            name: name,
            password: hashedPassword,
            mail: mail,
            profilePicture: 'user.png',
            cart_id: cart._id,
            orders: [],
            chats: [],
            reviews: [],
            refunds: [],
            operations: [],
            balance: 0,
            amountRedemption: 0,
            boughtProducts: 0
        })

        await customer.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/login', async (req, res) => {
    try {
        let { mail, password } = req.body
        if (!mail || !password) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }


        let customer = await Customer.findOne({ mail: mail })
        if (!customer) {
            return res.status(404).send('Аккаунт пользователя не найден')
        }

        let passwordCheck = await bcrypt.compare(password, customer.password)

        if (!passwordCheck) {
            return res.status(400).send('Неверные данные')
        }
        if (req.session.seller) {
            return res.status(400).send('Вы уже авторизованы как продавец')
        }
        req.session.user = String(customer._id)
        req.session.save((err) => console.log(err))

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/main', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId }).select('+profilePicture')
        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }
        if (customer.profilePicture == 'user.png') {
            return res.send({ ...customer.toObject(), profilePicture: undefined })
        }
        res.send({ ...customer.toObject(), profilePicture: !customer.profilePicture ? false : true })
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/mail/change', VerifyTokenUser, async (req, res) => {
    try {
        let mail = req.body.mail

        if (!mail) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let check = await Customer.findOne({ mail: mail })

        if (check) {
            return res.status(409).send('Аккаунт с введенной почтой уже существует')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        customer.mail = mail

        await customer.save()

        res.status(200).send('Почта успешно изменена')
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/name/change', VerifyTokenUser, async (req, res) => {
    try {
        let name = req.body.name

        if (!name) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }


        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        customer.name = name

        await customer.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/products/all', async (req, res) => {
    try {
        let products = await Product.find().populate({ path: 'brand_id', select: 'brandName' }).limit(40).select('title price category picture brand_id discount article')

        res.send(products)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/products/category', async (req, res) => {
    try {
        let category = req.query.category

        if (!category) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let products = await Product.find({ category: category }).populate({ path: 'brand_id', select: 'brandName' }).limit(40).select('title price category picture brand_id discount article')

        res.send(products)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/products/filter', async (req, res) => {
    try {
        let value = req.query.value
        if (!value) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let products = await Product.find({ title: RegExp(value, 'i') }).populate({ path: 'brand_id', select: 'brandName' }).limit(40).select('title price category picture brand_id discount article')

        res.send(products)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/product', async (req, res) => {
    try {
        let article = req.query.article
        if (!article) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let product = await Product.findOne({ article: article }).populate({
            path: 'reviews',
            populate: {
                path: 'author_id'
            },
            options: {
                sort: {
                    createdAt: -1
                }
            }
        }).populate('brand_id')

        if (!product) {
            return res.status(404).send('Такого товара не найдено')
        }

        res.send(product)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/balance/topup', VerifyTokenUser, async (req, res) => {
    try {
        let money = req.body.money
        if (!money) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let uniqueToken = jwt.sign({ money: money, random: CreateNumPay(), userId: customer._id }, process.env.UNIQUE_CODE)

        res.status(200).send({
            money: money,
            toCard: 2023859628616081,
            unique: uniqueToken,
            redirectTo: `${frontHost}/lk/mywallet/purchases`,
            routeTopUp: `${process.env.SELF_URL}/balance/pay`,
            servBank: `${process.env.SERV_BANK}`
        })
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/balance/pay', async (req, res) => {
    try {
        let { codePay } = req.body
        if (!codePay) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        jwt.verify(codePay, process.env.UNIQUE_CODE, (error, decoded) => {
            if (error) {
                return res.status(409).send('Ошибка с пополнением')
            }

            req.money = decoded.money
            req.userId = decoded.userId
        })

        let customer = await Customer.findOne({ _id: req.userId })

        customer.balance += req.money

        customer.operations.push({
            name: 'replenishment',
            money: req.money
        })

        await customer.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/balance/operations', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId }).populate('operations')

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let data = customer.operations.sort((a, b) => b.createdAt - a.createdAt)

        res.send(data)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/reviews/all', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId }).populate({
            path: 'reviews',
            populate: [
                { path: 'author_id' },
                {
                    path: 'product_id',
                    populate: 'brand_id'
                }
            ]
        })

        customer.reviews.sort((a, b) => b.createdAt - a.createdAt)

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        res.send(customer)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/review/remove', VerifyTokenUser, async (req, res) => {
    try {
        let { article, id } = req.body
        if (!article || !id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId }).populate('reviews')

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        await Review.deleteOne({ _id: id })

        customer.reviews.pull(id)

        await customer.save()

        let product = await Product.findOne({ article: article }).populate('reviews')

        let averageCount = 0
        for (let i = 0; i < product.reviews.length; i++) {
            averageCount += product.reviews[i].rating
        }

        if (product.reviews.length >= 1) {
            product.averageRating = (averageCount / product.reviews.length).toFixed(1)
        } else {
            product.averageRating = 0
        }

        product.amountReviews--
        product.reviews.pull(id)

        await product.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/review/create', VerifyTokenUser, async (req, res) => {
    try {
        let { article, text, rating } = req.body
        if (!article || !text || !rating) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId }).populate({
            path: 'reviews',
            populate: {
                path: 'product_id'
            }
        }).populate({
            path: 'orders',
            populate: 'product_id'
        })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ article: article }).populate('reviews')

        let check = customer.reviews.some(review => {
            return review.product_id.article == article
        })

        if (check) {
            return res.status(409).send('Отзыв на данный товар уже оставлен вами')
        }

        let orders = await Order.findOne({ product_id: product._id, customer_id: customer._id, status: 'Получен' })

        if (!orders) {
            return res.status(403).send('Отзыв можно оставить только после покупки')
        }

        let review = new Review({
            text: text,
            rating: rating,
            author_id: customer._id,
            product_id: product._id
        })

        await review.save()

        customer.reviews.push(review._id)

        await customer.save()

        let averageCount = 0
        for (let i = 0; i < product.reviews.length; i++) {
            averageCount += product.reviews[i].rating
        }

        if (product.reviews.length >= 1) {
            product.averageRating = ((averageCount + rating) / (product.reviews.length + 1)).toFixed(1)
        } else {
            product.averageRating = 0
        }

        product.amountReviews++
        product.reviews.push(review._id)

        await product.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/cart/add', VerifyTokenUser, async (req, res) => {
    try {
        let article = req.body.article

        if (!article) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId }).populate('cart_id')

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ article: article })
        if (product.quantity <= 0) {
            return res.status(400).send('Товар закончился на складе')
        }

        let cart = await Cart.findOne({ _id: customer.cart_id })

        if (cart.products.includes(product._id)) {
            return res.status(409).send('Данный товар уже находится в корзине')
        }

        cart.products.push(product._id)
        cart.totalCost += product.price

        await cart.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/cart/remove', VerifyTokenUser, async (req, res) => {
    try {
        let article = req.body.article

        if (!article) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId }).populate('cart_id')

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ article: article })

        let cart = await Cart.findOne({ _id: customer.cart_id })

        cart.products.pull(product._id)
        cart.totalCost -= product.price

        await cart.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/product/check', VerifyTokenUser, async (req, res) => {
    try {
        let article = req.query.article

        if (!article) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ article: article })

        if (!product) {
            return res.status(404).send('Товар не найден')
        }

        let cart = await Cart.findOne({ _id: customer.cart_id })

        let check = cart.products.includes(product._id)

        if (check) {
            return res.status(409).send('Товар уже в вашей корзине')
        }

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/cart', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let cart = await Cart.findOne({ _id: customer.cart_id }).populate({
            path: 'products',
            populate: {
                path: 'brand_id'
            },
            options: {
                sort: {
                    updatedAt: 1
                }
            }
        })

        res.send({ customer, cart })
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/delivery/city', VerifyTokenUser, async (req, res) => {
    try {
        let { city } = req.body

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let cart = await Cart.findOne({ _id: customer.cart_id }).populate({
            path: 'products',
            populate: 'brand_id'
        })
        let productsOtherCities = cart.products.filter(product => {
            return !product.brand_id.storages.includes(city)
        })

        let prices = []
        let hours = []
        let distance = []
        for (const product of productsOtherCities) {
            let routesForCompany = [];
            for (const storage of product.brand_id.storages) {
                const cityName = city.replace('City ', '')
                const storageName = storage.replace('City ', '')

                const regex1 = new RegExp(storageName + "-" + cityName)
                const regex2 = new RegExp(cityName + "-" + storageName)
                routesForCompany = [...routesForCompany, ...await Route.find({ $or: [{ name: regex1 }, { name: regex2 }] })]
            }
            let distances = routesForCompany.map(product => product.distance)
            let moneys = routesForCompany.map(product => product.money)
            let hoursProd = routesForCompany.map(product => product.hours)
            let bestDistance = Math.min(...distances)
            let bestMoney = Math.min(...moneys)
            let bestHour = Math.min(...hoursProd)
            let bestDistanceRoute = routesForCompany.find(product => product.distance == bestDistance)
            let bestPriceRoute = routesForCompany.find(product => product.money == bestMoney)
            let bestHoursRoute = routesForCompany.find(product => product.hours == bestHour)
            prices.push({ name: bestPriceRoute.name, money: bestPriceRoute.money, hours: bestPriceRoute.hours, distance: bestPriceRoute.distance })
            hours.push({ name: bestHoursRoute.name, money: bestHoursRoute.money, hours: bestHoursRoute.hours, distance: bestHoursRoute.distance })
            distance.push({ name: bestDistanceRoute.name, money: bestDistanceRoute.money, hours: bestDistanceRoute.hours, distance: bestDistanceRoute.distance })
        }
        prices = prices.filter((item, index, array) => { return array.findIndex(obj => obj.name === item.name) === index; })
        hours = hours.filter((item, index, array) => { return array.findIndex(obj => obj.name === item.name) === index; })
        distance = distance.filter((item, index, array) => { return array.findIndex(obj => obj.name === item.name) === index; })


        let fullName1 = '';
        prices.forEach(prod => {
            fullName1 = fullName1 + '-' + prod.name
        })

        let fullName2 = '';
        hours.forEach(prod => {
            fullName2 = fullName2 + '-' + prod.name
        })

        let fullName3 = '';
        distance.forEach(prod => {
            fullName3 = fullName3 + '-' + prod.name
        })

        let fullName1Arr = fullName1.replace(' ', '').split('-')
        fullName1Arr = fullName1Arr.filter(item => item !== '')
        let fullName2Arr = fullName2.replace(' ', '').split('-')
        fullName2Arr = fullName2Arr.filter(item => item !== '')
        let fullName3Arr = fullName3.replace(' ', '').split('-')
        fullName3Arr = fullName3Arr.filter(item => item !== '')
        if (fullName1Arr[0] == city.replace('City ', '')) {
            fullName1Arr = fullName1Arr.reverse()
        }
        if (fullName2Arr[0] == city.replace('City ', '')) {
            fullName2Arr = fullName2Arr.reverse()
        }
        if (fullName3Arr[0] == city.replace('City ', '')) {
            fullName3Arr = fullName3Arr.reverse()
        }
        if (fullName1Arr.indexOf(city.replace('City ', '')) !== fullName1Arr.length - 1) {
            fullName1Arr.splice(fullName1Arr.indexOf(city.replace('City ', '')), 1)

        }
        if (fullName2Arr.indexOf(city.replace('City ', '')) !== fullName2Arr.length - 1) {
            fullName2Arr.splice(fullName2Arr.indexOf(city.replace('City ', '')), 1)

        }
        if (fullName3Arr.indexOf(city.replace('City ', '')) !== fullName3Arr.length - 1) {
            fullName3Arr.splice(fullName3Arr.indexOf(city.replace('City ', '')), 1)

        }

        let finalPriceRoute = {
            name: fullName1Arr.join('-'),
            price: prices.reduce((acc, i) => acc + parseInt(i.money), 0),
            distance: prices.reduce((acc, i) => acc + parseInt(i.distance), 0),
            hours: prices.reduce((acc, i) => acc + parseInt(i.hours), 0)
        };
        let finalDistanceRoute = {
            name: fullName3Arr.join('-'),
            price: distance.reduce((acc, i) => acc + parseInt(i.money), 0),
            distance: distance.reduce((acc, i) => acc + parseInt(i.distance), 0),
            hours: distance.reduce((acc, i) => acc + parseInt(i.hours), 0)
        };
        let finalHoursRoute = {
            name: fullName2Arr.join('-'),
            price: hours.reduce((acc, i) => acc + parseInt(i.money), 0),
            distance: hours.reduce((acc, i) => acc + parseInt(i.distance), 0),
            hours: hours.reduce((acc, i) => acc + parseInt(i.hours), 0)
        };
        res.send({
            bestPrice: finalPriceRoute,
            bestHours: finalHoursRoute,
            bestDistance: finalDistanceRoute
        })
    } catch (e) {
        console.log(e);
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/order/create', VerifyTokenUser, async (req, res) => {
    try {
        let { way, products } = req.body

        if (!way || !products) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let cart = await Cart.findOne({ _id: customer.cart_id }).populate('products')

        let check = cart.products.some(product => {
            return product.runOut == true
        })

        if (check) {
            let runOutProducts = cart.products.filter(product => product.runOut == true)
            return res.status(400).send({
                message: 'Товар в корзине закончился',
                data: runOutProducts
            })
        }

        cart.products = cart.products.map(product => product.quantity -= 1)
        await cart.save()

        customer.balance = customer.balance - cart.totalCost

        if (customer.balance < 0) {
            return res.status(409).send('Недостаточно средств')
        }

        let orders = products.map((product) => ({
            product_id: product._id,
            status: 'Создан',
            money: product.price,
            way: way,
            customer_id: customer._id
        }))

        let createdOrders = await Order.insertMany(orders)

        let getOrder = createdOrders.map((order) => order._id)
        let amountRedemption = createdOrders.reduce((total, order) => total + order.money, 0)

        customer.orders.push(...getOrder)

        customer.operations.push({
            name: 'withdrawals',
            money: cart.totalCost
        })

        customer.amountRedemption += amountRedemption

        await customer.save()

        cart.products = []
        cart.totalCost = 0

        await cart.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/orders/all', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId }).populate({
            path: 'orders',
            populate: 'product_id',
            match: { status: { $ne: 'Получен' } }
        })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        customer.orders.sort((a, b) => b.createdAt - a.createdAt)

        res.send(customer)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/order/recieved', VerifyTokenUser, async (req, res) => {
    try {
        let id = req.body.id
        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let order = await Order.findOne({ _id: id }).populate({
            path: 'product_id',
            populate: 'brand_id'
        })

        let changedStatus

        if (order.status === 'Готов к получению') {
            changedStatus = 'Получен'
        } else {
            return
        }

        order.status = changedStatus

        await order.save()

        order.product_id.brand_id.balance += order.money
        order.product_id.brand_id.sold++
        order.product_id.brand_id.activeOrders--

        await order.product_id.brand_id.save()

        let product = await Product.findOne({ _id: order.product_id })

        product.amountSold++

        await product.save()

        customer.boughtProducts++

        await customer.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/purchases', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId }).populate({
            path: 'orders',
            match: { status: 'Получен' },
            populate: {
                path: 'product_id',
                populate: 'brand_id'
            }
        })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        customer.orders.sort((a, b) => b.createdAt - a.createdAt)

        res.send(customer)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/chat/create', VerifyTokenUser, async (req, res) => {
    try {
        let id = req.body.id
        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let check = await Chat.findOne({ people: { $all: [id, customer._id] } })

        if (check) {
            return res.status(409).send('Чат уже создан')
        }

        let chat = new Chat({
            people: [id, customer._id,],
            messages: [],
            uniqueId: await CreateUniqueChatId()
        })

        await chat.save()

        customer.chats.push(chat._id)

        await customer.save()

        let seller = await Seller.findOne({ _id: id })

        seller.chats.push(chat._id)

        await seller.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/chats/all', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let chats = await Chat.aggregate([
            {
                $match: { people: customer._id }
            },

            {
                $lookup: {
                    from: 'sellers',
                    localField: 'people',
                    foreignField: '_id',
                    as: 'seller'
                }
            },

            {
                $unwind: '$seller'
            },

            {
                $replaceRoot: {
                    newRoot: {
                        _id: '$_id',
                        people: [
                            {
                                _id: '$seller._id',
                                brandName: '$seller.brandName'
                            }
                        ],
                        messages: '$messages',
                        uniqueId: '$uniqueId',
                        createdAt: '$createdAt',
                        updatedAt: '$updatedAt'
                    }
                }
            },
        ])

        let chatsAll = chats.sort((a, b) => b.createdAt - a.createdAt)

        res.send(chatsAll)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/user/chat', VerifyTokenUser, async (req, res) => {
    try {
        let id = req.query.id
        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let messages = await Chat.findOne({ uniqueId: id }).populate('messages')

        let chat = await Chat.aggregate([
            {
                $match: {
                    $and: [
                        { people: customer._id },
                        { uniqueId: Number(id) }
                    ]
                }
            },

            {
                $lookup: {
                    from: 'sellers',
                    localField: 'people',
                    foreignField: '_id',
                    as: 'seller'
                }
            },

            {
                $unwind: '$seller'
            },

            {
                $replaceRoot: {
                    newRoot: {
                        _id: '$_id',
                        people: [
                            {
                                _id: '$seller._id',
                                brandName: '$seller.brandName'
                            }
                        ],
                        messages: '$messages',
                        uniqueId: '$uniqueId',
                        createdAt: '$createdAt',
                        updatedAt: '$updatedAt'
                    }
                }
            },
        ])

        if (chat.length == 0) {
            return res.status(404).send('Чат не найден')
        }

        let check = await Customer.findOne({ _id: customer._id, chats: { $in: messages._id } })

        if (!check) {
            return res.status(409).send('Вы не являетесь участником данного чата')
        }

        res.send({ chat, messages })
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/user/message/send', VerifyTokenUser, async (req, res) => {
    try {
        let { text, to, id } = req.body

        if (!text || !to || !id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let message = new Message({
            from: customer._id,
            to: to,
            text: text
        })

        await message.save()

        let chat = await Chat.findOne({ uniqueId: id })

        chat.messages.push(message._id)

        await chat.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/refund/create', VerifyTokenUser, async (req, res) => {
    try {
        let productId = req.body.productId
        let sellerId = req.body.sellerId
        let orderId = req.body.orderId

        if (!productId || !sellerId || !orderId) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let check = await Refund.findOne({ order_id: orderId })

        if (check) {
            return res.status(409).send('Возврат на этот заказ уже создан')
        }

        let refund = new Refund({
            status: 'Ожидает заполнения',
            uniqueNumber: await CreateUniqueRefundId(),
            product_id: productId,
            order_id: orderId,
            albumLink: '',
            text: '',
            returnMoney: false,
            author_id: customer._id
        })

        await refund.save()

        customer.refunds.push(refund._id)

        await customer.save()

        let seller = await Seller.findOne({ _id: sellerId })

        seller.refunds.push(refund._id)

        await seller.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/refund/all', VerifyTokenUser, async (req, res) => {
    try {
        let customer = await Customer.findOne({ _id: req.userId }).populate({
            path: 'refunds',
            match: { status: { $ne: 'Завершен' } }
        })

        if (!customer) {
            res.status(401).send('Вы не авторизованы')
        }

        let data = customer.refunds.sort((a, b) => b.createdAt - a.createdAt)

        res.send(data)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/refund', VerifyTokenUser, async (req, res) => {
    try {
        let id = req.query.id
        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId }).populate('refunds')

        if (!customer) {
            res.status(401).send('Вы не авторизованы')
        }

        let refund = await Refund.findOne({ _id: id }).populate({
            path: 'product_id',
            populate: 'brand_id'
        })

        res.send(refund)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/refund/fill', VerifyTokenUser, async (req, res) => {
    try {
        let { id, albumLink, text } = req.body
        if (!id || !albumLink || !text) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId }).populate('refunds')

        if (!customer) {
            res.status(401).send('Вы не авторизованы')
        }

        let refund = await Refund.findOne({ _id: id })

        refund.albumLink = albumLink
        refund.text = text
        refund.status = 'Ожидает подтверждения'

        await refund.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/refund/return/money', VerifyTokenUser, async (req, res) => {
    try {
        let id = req.body.id
        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let refund = await Refund.findOne({ _id: id }).populate({
            path: 'product_id',
            populate: 'brand_id'
        })

        if (refund.returnMoney) {
            return res.status(409).send('Средства уже возвращены')
        }

        refund.returnMoney = true

        await refund.save()

        let seller = await Seller.findOne({ _id: refund.product_id.brand_id._id })

        seller.balance -= refund.product_id.price
        seller.returns++
        seller.activeReturns--

        await seller.save()

        customer.balance += refund.product_id.price
        customer.operations.push({
            name: 'refund',
            money: refund.product_id.price
        })

        await customer.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/logout', async (req, res) => {
    try {
        req.session.destroy((err) => console.log(err))

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/registration/seller', async (req, res) => {
    try {
        let { brandName, name, mail, tel, description, password, storages } = req.body
        if (!brandName || !name || !mail || !tel || !description || !password || !storages) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let check = await Seller.findOne({ mail: mail })

        if (check) {
            return res.status(409).send('Аккаунт с введенной почтой уже существует')
        }

        let salt = await bcrypt.genSalt(10)
        let hashedPassword = await bcrypt.hash(password, salt)

        let seller = new Seller({
            brandName: brandName,
            name: name,
            mail: mail,
            tel: tel,
            description: description,
            password: hashedPassword,
            products: [],
            orders: [],
            balance: 0,
            sold: 0,
            activeOrders: 0,
            returns: 0,
            activeReturns: 0,
            chats: [],
            refunds: [],
            storages: [...storages]
        })

        await seller.save()

        res.sendStatus(200)
    } catch (e) {
        console.log(e.message);
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/login/seller', async (req, res) => {
    try {
        let { mail, password } = req.body

        if (!mail || !password) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ mail: mail })

        if (!seller) {
            return res.status(404).send('Аккаунт продавца не найден')
        }

        let passwordCheck = await bcrypt.compare(password, seller.password)

        if (!passwordCheck) {
            return res.status(400).send('Неверные данные')
        }
        if (req.session.user) {
            return res.status(400).send('Вы уже авторизованы как пользователь')

        }
        req.session.seller = String(seller._id)
        req.session.save((err) => console.log(err))

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }

})

app.get('/seller/main', VerifyTokenSeller, async (req, res) => {
    try {
        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        res.send(seller)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/product/create', VerifyTokenSeller, async (req, res) => {
    try {
        let { title, description, price, category, picture, size, quantity, weight } = req.body

        if (!title || !description || !price || !category || !picture || !size || !quantity || !weight) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let check = await Product.findOne({ $or: [{ description: description }, { picture: picture }] })

        if (check) {
            return res.status(409).send('Ошибка при создании')
        }

        let product = new Product({
            title: title,
            description: description,
            category: category,
            price: price,
            averageRating: 0,
            amountReviews: 0,
            article: await CreateArticle(),
            amountSold: 0,
            discount: 0,
            runOut: false,
            picture: picture,
            brand_id: seller._id,
            reviews: [],
            quantity: quantity,
            size: size,
            weight: weight
        })

        await product.save()

        seller.products.push(product._id)

        await seller.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/seller/products/all', VerifyTokenSeller, async (req, res) => {
    try {
        let seller = await Seller.findOne({ _id: req.sellerId }).populate('products')

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        res.send(seller)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/product/remove', VerifyTokenSeller, async (req, res) => {
    try {
        let id = req.body.id

        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId }).populate('products')

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ _id: id })
        if (!seller.products.includes(product._id)) {
            return res.status(400).send('Это не ваш товар')
        }

        product.runOut = true

        await product.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/product/return/sell', VerifyTokenSeller, async (req, res) => {
    try {
        let id = req.body.id

        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ _id: id })
        if (!seller.products.includes(product._id)) {
            return res.status(400).send('Это не ваш товар')
        }
        product.runOut = false

        await product.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/seller/orders/all', VerifyTokenSeller, async (req, res) => {
    try {
        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let ordersIds = seller.products.map((product) => product._id)

        let orders = await Order.find({ product_id: { $in: ordersIds }, status: { $ne: 'Получен' } }).sort({ createdAt: -1 }).populate({
            path: 'product_id',
            populate: 'brand_id'
        }).populate('customer_id')

        res.send(orders)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/discount/set', VerifyTokenSeller, async (req, res) => {
    try {
        let { id, discount } = req.body

        if (!id || !discount) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let product = await Product.findOne({ _id: id })

        product.discount = discount
        product.price = Number(product.price - (product.price / 100 * discount).toFixed(0))

        await product.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/seller/order/change', VerifyTokenSeller, async (req, res) => {
    try {
        let { status, id } = req.body

        if (!id || !status) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let order = await Order.findOne({ _id: id })

        let changedStatus

        if (status === 'Создан') {
            changedStatus = 'Отправлен на сборку'
            seller.activeOrders++
            seller.orders.push(order._id)

            await seller.save()
        } else if (status === 'Отправлен на сборку') {
            changedStatus = 'Собран'
        } else if (status === 'Собран') {
            changedStatus = 'Отсортирован'
        } else if (status === 'Отсортирован') {
            changedStatus = 'Передан в доставку'
        } else if (status === 'Передан в доставку') {
            changedStatus = 'Готов к получению'
        } else {
            return
        }

        order.status = changedStatus

        await order.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/seller/refunds/all', VerifyTokenSeller, async (req, res) => {
    try {
        let seller = await Seller.findOne({ _id: req.sellerId }).populate({
            path: 'refunds',
            populate: [
                {
                    path: 'product_id'
                },
                {
                    path: 'author_id'
                }
            ],
            match: { status: { $not: { $in: ['Завершен', 'Ожидает заполнения'] } } }
        })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let data = seller.refunds.sort((a, b) => b.createdAt - a.createdAt)

        res.send(data)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }

})

app.post('/seller/refund/change', VerifyTokenSeller, async (req, res) => {
    try {
        let { status, id } = req.body

        if (!id || !status) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let refund = await Refund.findOne({ _id: id })

        let changedStatus

        if (status === 'Ожидает подтверждения') {
            changedStatus = 'В рассмотрении'
            seller.activeReturns++

            await seller.save()
        } else if (status === 'Одобрен') {
            changedStatus = 'Одобрен'
        } else if (status === 'Отказан') {
            changedStatus = 'Отказан'
            seller.returns++
            seller.activeReturns--

            await seller.save()
        } else {
            return
        }

        refund.status = changedStatus

        await refund.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/seller/chats/all', VerifyTokenSeller, async (req, res) => {
    try {
        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let chats = await Chat.aggregate([
            {
                $match: { people: seller._id }
            },

            {
                $lookup: {
                    from: 'customers',
                    localField: 'people',
                    foreignField: '_id',
                    as: 'customer'
                }
            },

            {
                $unwind: "$customer"
            },

            {
                $replaceRoot: {
                    newRoot: {
                        _id: "$_id",
                        people: [
                            {
                                _id: "$customer._id",
                                name: "$customer.name"
                            }
                        ],
                        messages: '$messages',
                        uniqueId: '$uniqueId',
                        createdAt: "$createdAt",
                        updatedAt: "$updatedAt"
                    }
                }
            }
        ])

        let chatsAll = chats.sort((a, b) => b.createdAt - a.createdAt)

        res.send(chatsAll)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/seller/chat', VerifyTokenSeller, async (req, res) => {
    try {
        let id = req.query.id

        if (!id) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let messages = await Chat.findOne({ uniqueId: id }).populate('messages')

        let chat = await Chat.aggregate([
            {
                $match: {
                    $and: [
                        { people: seller._id },
                        { uniqueId: Number(id) }
                    ]
                }
            },

            {
                $lookup: {
                    from: 'customers',
                    localField: 'people',
                    foreignField: '_id',
                    as: 'customer'
                }
            },

            {
                $unwind: '$customer'
            },

            {
                $replaceRoot: {
                    newRoot: {
                        _id: '$_id',
                        people: [
                            {
                                _id: '$customer._id',
                                name: '$customer.name'
                            }
                        ],
                        messages: '$messages',
                        uniqueId: '$uniqueId',
                        createdAt: '$createdAt',
                        updatedAt: '$updatedAt'
                    }
                }
            },
        ])

        if (!chat) {
            return res.status(404).send('Чат не найден')
        }

        let check = await Seller.findOne({ _id: seller._id, chats: { $in: messages._id } })

        if (!check) {
            return res.status(409).send('Вы не являетесь участником данного чата')
        }

        res.send({ chat, messages })
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/seller/message/send', VerifyTokenSeller, async (req, res) => {
    try {
        let { text, to, id } = req.body

        if (!id || !to || !text) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let seller = await Seller.findOne({ _id: req.sellerId })

        if (!seller) {
            return res.status(401).send('Вы не авторизованы')
        }

        let message = new Message({
            from: seller._id,
            to: to,
            text: text
        })

        await message.save()

        let chat = await Chat.findOne({ uniqueId: id })

        chat.messages.push(message._id)

        await chat.save()

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.post('/logout/seller', async (req, res) => {
    try {
        req.session.destroy((err) => console.log(err))

        res.sendStatus(200)
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

const fs = require('fs')
const formidable = require('express-formidable');
app.use(formidable())
app.post('/profile/image/upload', VerifyTokenUser, async (req, res) => {
    try {
        const { file } = req.files

        if (!file) {
            return res.status(400).send('Пропущены требуемые поля запроса')
        }

        let customer = await Customer.findOne({ _id: req.userId })

        if (!customer) {
            return res.status(401).send('Вы не авторизованы')
        }

        let filePath = file.path

        let avatarData = fs.readFileSync(filePath)

        let mb = avatarData.length / 1024 / 1024;
        if (mb > 4) {
            return res.send('много памяти занимает')
        }
        if (mb > 15) {
            return res.send('максималка')
        }

        customer.profilePicture = avatarData
        await customer.save()

        res.redirect(process.env.FRONTEND_HOST + '/lk/details')
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})

app.get('/image/get', VerifyTokenUser, async (req, res) => {
    try {
        const user = await Customer.findOne({ _id: req.userId }).select('+profilePicture')
        if (!user) {
            return res.status(401).send('Вы не авторизованы')
        }

        res.send(user?.profilePicture.toString('base64'))
    } catch (e) {
        return res.status(400).send(`Ошибка с выполнением запроса, ${e.message}`)
    }
})