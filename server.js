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

app.listen(backPort, () => {
    console.log('http://' + backHost + ':' + backPort)
})

let cors = require('cors')
app.use(cors({
    credentials: true,
    origin: frontHost
}))

app.use((req,res,next) => {
    if(req.get('User-Agent').toLowerCase().includes('postman')) {
        return res.status(403).send('Запрещено')
    }

    next()
})

app.use(express.json())
app.use(cookieParser())

let mongoose = require('mongoose')
let uri = process.env.MONGODB_HOST
mongoose.connect(uri)

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

let orderSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.ObjectId,
        ref: 'product'
    },
    status: String,
    money: Number,
    customer_id: {
        type: mongoose.ObjectId,
        ref: 'customer'
    }
}, {
    timestamps: true
})

let Order = mongoose.model('order', orderSchema)

let operationSchema = new mongoose.Schema({
    name: String,
    money: Number
}, {
    timestamps: true
})

let customerSchema = new mongoose.Schema({
    name: String,
    password: String,
    mail: String,
    profilePicture: String,
    cart_id: {
        type: mongoose.ObjectId,
        ref: 'cart'
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
    balance: Number,
    amountRedemption: Number,
    boughtProducts: Number
}, {
    timestamps: true
})

let Customer = mongoose.model('customer', customerSchema)

let sellerSchema = new mongoose.Schema({
    brandName: String,
    brandCategory: String,
    name: String,
    mail: String,
    tel: String,
    description: String,
    password: String,
    products: [{
        type: mongoose.ObjectId,
        ref: 'product'
    }],
    orders: [{
        type: mongoose.ObjectId,
        ref: 'order'
    }],
    balance: Number,
    sold: Number,
    activeOrders: Number,
    returns: Number,
    activeReturns: Number,
    chats: [{
        type: mongoose.ObjectId,
        ref: 'chat'
    }],
    refunds: [{
        type: mongoose.ObjectId,
        ref: 'refund'
    }],
}, {
    timestamps: true
})

let Seller = mongoose.model('seller', sellerSchema)

let reviewSchema = new mongoose.Schema({
    text: String,
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    author_id: {
        type: mongoose.ObjectId,
        ref: 'customer'
    },
    product_id: {
        type: mongoose.ObjectId,
        ref: 'product'
    }
}, {
    timestamps: true
})

let Review = mongoose.model('review', reviewSchema)

let refundSchema = new mongoose.Schema({
    status: String,
    uniqueNumber: Number,
    product_id: {
        type: mongoose.ObjectId,
        ref: 'product'
    },
    albumLink: String,
    text: String,
    returnMoney: Boolean,
    order_id: {
        type: mongoose.ObjectId,
        ref: 'order'
    },
    author_id: {
        type: mongoose.ObjectId,
        ref: 'customer'
    }
}, {
    timestamps: true
})

let Refund = mongoose.model('refund', refundSchema)

let productSchema = new mongoose.Schema({
    title: String,
    description: String,
    category: String,
    price: Number,
    averageRating: Number,
    amountReviews: Number,
    article: Number,
    amountSold: Number,
    discount: Number,
    picture: String,
    runOut: Boolean,
    brand_id: {
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

let chatSchema = new mongoose.Schema ({
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
    uniqueId: Number
}, {
    timestamps: true
})

let Chat = mongoose.model('chat', chatSchema)

let messageSchema = new mongoose.Schema ({
    from: mongoose.ObjectId,
    to: mongoose.ObjectId,
    text: String
}, {
    timestamps: true
})

let Message = mongoose.model('message', messageSchema)

let VerifyTokenUser = (req, res, next) => {
    const token = req.headers.authorization
    // const token = req.headers.cookie

    if (!token) {
        return res.status(401).send('Вы не авторизованы')
    }

    // jwt.verify(token.replace(`${COOKIE_USER}=`, ''), process.env.TOKEN_USER, (error, decoded) => {
    jwt.verify(token.replace('Bearer ', ''), process.env.TOKEN_USER, (error, decoded) => {
        if (error) {
            return res.status(401).send('Вы не авторизованы')
        }

        req.userId = decoded._id
        next()
    })
}

let VerifyTokenSeller = (req, res, next) => {
    const token = req.headers.authorization
    // const token = req.headers.cookie

    if(!token) {
        return res.status(401).send('Вы не авторизованы')
    }

    // jwt.verify(token.replace(`${COOKIE_SELLER}=`, ''), process.env.TOKEN_SELLER, (error, decoded) => {
    jwt.verify(token.replace('Bearer ', ''), process.env.TOKEN_SELLER, (error, decoded) => {
        if(error) {
            return res.status(401).send('Вы не авторизованы')
        }

        req.sellerId = decoded._id
        next()
    })
}

let getRandomArticle = () => {
    let min = 100000
    let max = 999999
    return Math.floor(Math.random() * (max - min) + min)
}

let CreateArticle = async () => {
    while(true) {
        article = getRandomArticle()
        let existArticle = await Product.findOne({article: article})
        if(!existArticle) {
            return article
        }
    }
}

let CreateUniqueChatId = async () => {
    while(true) {
        let chatId = getRandomArticle()
        let existId = await Chat.findOne({uniqueId: chatId})
        if(!existId) {
            return chatId
        }
    }
}

let CreateUniqueRefundId = async () => {
    while(true) {
        let refundId = getRandomArticle()
        let existRefundId = await Refund.findOne({uniqueNumber: refundId})
        if(!existRefundId) {
            return refundId
        }
    }
}

app.post('/registration', async (req, res) => {
    let { name, password, mail } = req.body

    let checkMail = await Customer.findOne({mail: mail})

    if(checkMail) {
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
})

app.post('/login', async (req,res) => {
    let { mail, password } = req.body

    let customer = await Customer.findOne({mail: mail})

    if(!customer) {
        return res.status(404).send('Аккаунт пользователя не найден')
    }

    let passwordCheck = await bcrypt.compare(password, customer.password)

    if(!passwordCheck) {
        return res.status(400).send('Неверные данные') 
    }

    let token = jwt.sign({_id: customer._id}, process.env.TOKEN_USER)

    res.cookie(process.env.COOKIE_USER, token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: 'none'
    })

    res.send(token)
})

app.get('/main', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }
    
    res.send(customer)
})

app.post('/mail/change', VerifyTokenUser, async (req, res) => {
    let mail = req.body.mail
    let check = await Customer.findOne({ mail: mail })

    if(check) {
        return res.status(409).send('Аккаунт с введенной почтой уже существует')
    }

    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    customer.mail = mail

    await customer.save()

    res.status(200).send('Почта успешно изменена')
})

app.post('/name/change', VerifyTokenUser, async (req, res) => {
    let name = req.body.name

    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    customer.name = name

    await customer.save()

    res.sendStatus(200)
})

app.get('/products/all', async (req, res) => {
    let products = await Product.find().populate('brand_id')

    res.send(products)
})

app.get('/product', async (req, res) => {
    let article = req.query.article

    let product = await Product.findOne({article: article}).populate({
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

    if(!product) {
        return res.status(404).send('Такого товара не найдено')
    }

    res.send(product)
})

app.post('/balance/topup', VerifyTokenUser, async (req, res) => {
    let money = req.body.money

    let customer = await Customer.findOne({_id: req.userId})

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    customer.balance += money

    customer.operations.push({
        name: 'replenishment',
        money: money
    })

    await customer.save()

    res.sendStatus(200)
})

app.get('/balance/operations', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({_id: req.userId}).populate('operations')

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let data = customer.operations.sort((a, b) => b.createdAt - a.createdAt)

    res.send(data)
})

app.get('/reviews/all', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({_id: req.userId}).populate({
        path: 'reviews',
        populate: [
            {path: 'author_id'},
            {
                path: 'product_id',
                populate: 'brand_id'
            }
        ]
    })

    customer.reviews.sort((a, b) => b.createdAt - a.createdAt)

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    res.send(customer)
})

app.post('/review/remove', VerifyTokenUser, async (req, res) => {
    let { article, id } = req.body

    let customer = await Customer.findOne({_id: req.userId}).populate('reviews')

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    await Review.deleteOne({_id: id})

    customer.reviews.pull(id)

    await customer.save()   

    let product = await Product.findOne({article: article}).populate('reviews')

    let averageCount = 0
    for(let i = 0; i < product.reviews.length; i++) {
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
})

app.post('/review/create', VerifyTokenUser, async (req, res) => {
    let { article, text, rating } = req.body

    let customer = await Customer.findOne({_id: req.userId}).populate({
        path: 'reviews',
        populate: {
            path: 'product_id'
        }
    }).populate({
        path: 'orders',
        populate: 'product_id'
    })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let product = await Product.findOne({article: article}).populate('reviews')

    let check = customer.reviews.some(review => {
        return review.product_id.article == article
    })

    if(check) {
        return res.status(409).send('Отзыв на данный товар уже оставлен вами')
    }

    let orders = await Order.findOne({product_id: product._id, customer_id: customer._id, status: 'Получен'})

    if(!orders) {
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
    for(let i = 0; i < product.reviews.length; i++) {
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
})

app.post('/cart/add', VerifyTokenUser, async (req, res) => {
    let article = req.body.article

    let customer = await Customer.findOne({ _id: req.userId }).populate('cart_id')

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }
        
    let product = await Product.findOne({article: article})

    let cart = await Cart.findOne({_id: customer.cart_id})

    if(cart.products.includes(product._id)) {
        return res.status(409).send('Данный товар уже находится в корзине')
    }

    cart.products.push(product._id)
    cart.totalCost += product.price

    await cart.save()

    res.sendStatus(200)
})

app.post('/cart/remove', VerifyTokenUser, async (req, res) => {
    let article = req.body.article

    let customer = await Customer.findOne({_id: req.userId}).populate('cart_id')

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let product = await Product.findOne({article: article})

    let cart = await Cart.findOne({_id: customer.cart_id})

    cart.products.pull(product._id)
    cart.totalCost -= product.price

    await cart.save()

    res.sendStatus(200)
})

app.get('/product/check', VerifyTokenUser, async (req, res) => {
    let article = req.query.article

    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }
        
    let product = await Product.findOne({article: article})

    if(!product) {
        return res.status(404).send('Товар не найден')
    }

    let cart = await Cart.findOne({_id: customer.cart_id})
    
    let check = cart.products.includes(product._id)

    if(check) {
        return res.status(409).send('Товар уже в вашей корзине')
    }
    
    res.sendStatus(200)
})

app.get('/cart', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let cart = await Cart.findOne({_id: customer.cart_id}).populate({
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

    res.send({customer, cart})
})

app.post('/order/create', VerifyTokenUser, async (req, res) => {
    let products = req.body.products

    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let cart = await Cart.findOne({_id: customer.cart_id}).populate('products')

    let check = cart.products.some(product => {
        return product.runOut == true
    })

    if(check) {
        let runOutProducts = cart.products.filter(product => product.runOut == true)
        return res.status(400).send({
            message: 'Товар в корзине закончился',
            data: runOutProducts
        })
    }

    customer.balance = customer.balance - cart.totalCost

    if(customer.balance < 0) {
        return res.status(409).send('Недостаточно средств')
    }

    let orders = products.map((product) => ({
        product_id: product._id,
        status: 'Создан',
        money: product.price,
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
})

app.get('/orders/all', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({ _id: req.userId }).populate({
        path: 'orders',
        populate: 'product_id',
        match: {status: {$ne: 'Получен'}}
    })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    customer.orders.sort((a, b) => b.createdAt - a.createdAt)

    res.send(customer)
})

app.post('/order/recieved', VerifyTokenUser, async(req, res) => {
    let id = req.body.id

    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let order = await Order.findOne({_id: id}).populate({
        path: 'product_id',
        populate: 'brand_id'
    })

    let changedStatus

    if(order.status === 'Готов к получению') {
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

    let product = await Product.findOne({_id: order.product_id})

    product.amountSold++

    await product.save()

    customer.boughtProducts++
    
    await customer.save()

    res.sendStatus(200)
})

app.get('/purchases', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({ _id: req.userId }).populate({
        path: 'orders',
        match: {status: 'Получен'},
        populate: {
            path: 'product_id',
            populate: 'brand_id'
        }
    })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    customer.orders.sort((a, b) => b.createdAt - a.createdAt)

    res.send(customer)
})

app.post('/chat/create', VerifyTokenUser, async (req, res) => {
    let id = req.body.id

    let customer = await Customer.findOne({_id: req.userId})

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let check = await Chat.findOne({people: {$all: [id, customer._id]}})

    if(check) {
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

    let seller = await Seller.findOne({_id: id})

    seller.chats.push(chat._id)

    await seller.save()

    res.sendStatus(200)
})

app.get('/chats/all', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({_id: req.userId})

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let chats = await Chat.aggregate([
        {
            $match: {people: customer._id}
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

    let chatsAll = chats.sort((a,b) => b.createdAt - a.createdAt)

    res.send(chatsAll)
})

app.get('/user/chat', VerifyTokenUser, async (req, res) => {
    let id = req.query.id

    let customer = await Customer.findOne({_id: req.userId})

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let messages = await Chat.findOne({uniqueId: id}).populate('messages')

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

    if(chat.length == 0) {
        return res.status(404).send('Чат не найден')
    }

    let check = await Customer.findOne({_id: customer._id, chats: {$in: messages._id}})

    if(!check) {
        return res.status(409).send('Вы не являетесь участником данного чата')
    }

    res.send({chat, messages})
})

app.post('/user/message/send', VerifyTokenUser, async (req, res) => {
    let { text, to, id } = req.body

    let customer = await Customer.findOne({ _id: req.userId })

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let message = new Message({
        from: customer._id,
        to: to,
        text: text
    })

    await message.save()

    let chat = await Chat.findOne({uniqueId: id})

    chat.messages.push(message._id)

    await chat.save()

    res.sendStatus(200)
})

app.post('/refund/create', VerifyTokenUser, async (req, res) => {
    let productId = req.body.productId
    let sellerId = req.body.sellerId
    let orderId = req.body.orderId

    let customer = await Customer.findOne({_id: req.userId})

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let check = await Refund.findOne({order_id: orderId})

    if(check) {
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

    let seller = await Seller.findOne({_id: sellerId})

    seller.refunds.push(refund._id)

    await seller.save()

    res.sendStatus(200)
})

app.get('/refund/all', VerifyTokenUser, async (req, res) => {
    let customer = await Customer.findOne({_id: req.userId}).populate({
        path: 'refunds',
        match: {status: {$ne: 'Завершен'}}
    })

    if(!customer) {
        res.status(401).send('Вы не авторизованы')
    }

    let data = customer.refunds.sort((a, b) => b.createdAt - a.createdAt)

    res.send(data)
})

app.get('/refund', VerifyTokenUser, async (req, res) => {
    let id = req.query.id

    let customer = await Customer.findOne({_id: req.userId}).populate('refunds')

    if(!customer) {
        res.status(401).send('Вы не авторизованы')
    }

    let refund = await Refund.findOne({_id: id}).populate({
        path: 'product_id',
        populate: 'brand_id'
    })

    res.send(refund)
})

app.post('/refund/fill', VerifyTokenUser, async (req, res) => {
    let { id, albumLink, text } = req.body

    let customer = await Customer.findOne({_id: req.userId}).populate('refunds')

    if(!customer) {
        res.status(401).send('Вы не авторизованы')
    }

    let refund = await Refund.findOne({_id: id})

    refund.albumLink = albumLink
    refund.text = text
    refund.status = 'Ожидает подтверждения'

    await refund.save()

    res.sendStatus(200)
})

app.post('/refund/return/money', VerifyTokenUser, async (req, res) => {
    let id = req.body.id

    let customer = await Customer.findOne({_id: req.userId})

    if(!customer) {
        return res.status(401).send('Вы не авторизованы')
    }

    let refund = await Refund.findOne({_id: id}).populate({
        path: 'product_id',
        populate: 'brand_id'
    })

    if(refund.returnMoney) {
        return res.status(409).send('Средства уже возвращены')
    }

    refund.returnMoney = true

    await refund.save()

    let seller = await Seller.findOne({_id: refund.product_id.brand_id._id})

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
})

app.post('/logout', async (req, res) => {
    res.clearCookie(process.env.COOKIE_USER)

    res.sendStatus(200)
})

app.post('/registration/seller', async (req, res) => {
    let { brandName, brandCategory, name, mail, tel, description, password } = req.body
    
    let check = await Seller.findOne({mail: mail})

    if(check) {
        return res.status(409).send('Аккаунт с введенной почтой уже существует')
    }

    let salt = await bcrypt.genSalt(10)
    let hashedPassword = await bcrypt.hash(password, salt)

    let seller = new Seller({
        brandName: brandName,
        brandCategory: brandCategory,
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
        refunds: []
    })

    await seller.save()

    res.sendStatus(200)
})

app.post('/login/seller', async (req, res) => {
    let { mail, password } = req.body

    let seller = await Seller.findOne({mail: mail})

    if(!seller) {
        return res.status(404).send('Аккаунт продавца не найден')
    }

    let passwordCheck = await bcrypt.compare(password, seller.password)

    if(!passwordCheck) {
        return res.status(400).send('Неверные данные') 
    }

    let token = jwt.sign({_id: seller._id}, process.env.TOKEN_SELLER)

    res.cookie(process.env.COOKIE_SELLER, token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    })

    res.send(token)
})

app.get('/seller/main', VerifyTokenSeller, async (req, res) => {
    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    res.send(seller)
})

app.post('/product/create', VerifyTokenSeller, async (req, res) => {
    let { title, description, price, category, picture } = req.body
    
    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let check = await Product.findOne({$or: [{description: description}, {picture: picture}]})

    if(check) {
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
        reviews: []
    })

    await product.save()

    seller.products.push(product._id)

    await seller.save()

    res.sendStatus(200)
})

app.get('/seller/products/all', VerifyTokenSeller, async (req, res) => {
    let seller = await Seller.findOne({_id: req.sellerId}).populate('products')

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    res.send(seller)
})

app.post('/product/remove', VerifyTokenSeller, async (req, res) => {
    let id = req.body.id

    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let product = await Product.findOne({_id: id})
    product.runOut = true

    await product.save()

    res.sendStatus(200)
})

app.post('/product/return/sell', VerifyTokenSeller, async (req, res) => {
    let id = req.body.id

    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let product = await Product.findOne({_id: id})
    product.runOut = false

    await product.save()

    res.sendStatus(200)
})

app.get('/seller/orders/all', VerifyTokenSeller, async (req, res) => {
    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let ordersIds = seller.products.map((product) => product._id)

    let orders = await Order.find({product_id: {$in: ordersIds}, status: {$ne: 'Получен'}}).sort({createdAt: -1}).populate({
        path: 'product_id',
        populate: 'brand_id'
    }).populate('customer_id')

    res.send(orders)    
})

app.post('/discount/set', VerifyTokenSeller, async (req, res) => {
    let { id, discount } = req.body

    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let product = await Product.findOne({_id: id})
    
    product.discount = discount
    product.price = Number(product.price - (product.price / 100 * discount).toFixed(0))

    await product.save()

    res.sendStatus(200)
})

app.post('/seller/order/change', VerifyTokenSeller, async (req, res) => {
    let { status, id } = req.body

    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let order = await Order.findOne({_id: id})

    let changedStatus

    if(status === 'Создан') {
        changedStatus = 'Отправлен на сборку'
        seller.activeOrders++
        seller.orders.push(order._id)

        await seller.save()
    } else if(status === 'Отправлен на сборку') {
        changedStatus = 'Собран'
    } else if(status === 'Собран') {
        changedStatus = 'Отсортирован'
    } else if(status === 'Отсортирован') {
        changedStatus = 'Передан в доставку'
    } else if(status === 'Передан в доставку') {
        changedStatus = 'Готов к получению'
    } else {
        return
    }

    order.status = changedStatus

    await order.save()

    res.sendStatus(200)
})

app.get('/seller/refunds/all', VerifyTokenSeller, async (req, res) => {
    let seller = await Seller.findOne({_id: req.sellerId}).populate({
        path: 'refunds',
        populate: [
            {
                path: 'product_id'
            },
            {
                path: 'author_id'
            }
        ],
        match: {status: {$not: {$in: ['Завершен', 'Ожидает заполнения']}}}
    })

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let data = seller.refunds.sort((a, b) => b.createdAt - a.createdAt)

    res.send(data)    
})

app.post('/seller/refund/change', VerifyTokenSeller, async (req, res) => {
    let { status, id } = req.body

    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let refund = await Refund.findOne({_id: id})

    let changedStatus

    if(status === 'Ожидает подтверждения') {
        changedStatus = 'В рассмотрении'
        seller.activeReturns++

        await seller.save()
    } else if(status === 'Одобрен') {
        changedStatus = 'Одобрен'
    } else if(status === 'Отказан') {
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
})

app.get('/seller/chats/all', VerifyTokenSeller, async (req, res) => {
    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let chats = await Chat.aggregate([
        {
            $match: {people: seller._id}
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

    let chatsAll = chats.sort((a,b) => b.createdAt - a.createdAt)

    res.send(chatsAll)
})

app.get('/seller/chat', VerifyTokenSeller, async (req, res) => {
    let id = req.query.id

    let seller = await Seller.findOne({_id: req.sellerId})

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let messages = await Chat.findOne({uniqueId: id}).populate('messages')

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

    if(!chat) {
        return res.status(404).send('Чат не найден')
    }

    let check = await Seller.findOne({_id: seller._id, chats: {$in: messages._id}})

    if(!check) {
        return res.status(409).send('Вы не являетесь участником данного чата')
    }

    res.send({chat, messages})
})

app.post('/seller/message/send', VerifyTokenSeller, async (req, res) => {
    let { text, to, id } = req.body

    let seller = await Seller.findOne({ _id: req.sellerId })

    if(!seller) {
        return res.status(401).send('Вы не авторизованы')
    }

    let message = new Message({
        from: seller._id,
        to: to,
        text: text
    })

    await message.save()

    let chat = await Chat.findOne({uniqueId: id})

    chat.messages.push(message._id)

    await chat.save()

    res.sendStatus(200)
})

app.post('/logout/seller', async (req, res) => {
    res.clearCookie(process.env.COOKIE_SELLER)

    res.sendStatus(200)
})