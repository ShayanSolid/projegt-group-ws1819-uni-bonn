const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const multer = require('multer')
const mime = require('mime')
const cookieParser = require('cookie-parser')

const app = express()
const port = process.env.port || 3000

const server = require('http').createServer(app)
const io = require('socket.io').listen(server)

io.on('connection', socket => {
    console.log('connected')
})

const mongoUrl = 'mongodb://127.0.0.1:27017'
const mongoDbName = 'gallery'

const allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
}

app.use(cookieParser())
app.use(allowCrossDomain)

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/')
    },
    filename: (req, file, cb) => {
        const allowed = /jpeg|jpg|png/
        const valid = allowed.test(file.mimetype)
        if (valid) {
            cb(null, Date.now() + '.' + mime.getExtension(file.mimetype))
        } else {
            cb('Error: wrong filetype')
        }
    },
})
const upload = multer({storage})

mongoose.connect(mongoUrl + '/' + mongoDbName, {useNewUrlParser: true})

const Image = require('./models/image')
const Tag = require('./models/tag')

app.use(express.static(__dirname + '/public'))
app.use(bodyParser.json())

const router = express.Router()
router.use(bodyParser.urlencoded({ extended: false }))
router.use(bodyParser.json())
require('./routes/authentication')(router)

app.post('/api/getImageJson', (req, res) => {
    Image.find((err, images) => {
        res.send({images})
    })
})

app.post('/api/getTag', (req, res) => {
    const {name} = req.body
    Tag.find({name}, (err, tags) => {
        res.send(tags)
    })
})

app.post('/api/getTags', (req, res) => {
    Tag.find((err, tags) => {
        res.send(tags)
    })
})

app.post('/api/images/upload', upload.single('image'), (req, res, next) => {
    if (req.file) {
        const tags = JSON.parse(req.body.tags)
        Image.create({
            label: req.body.label,
            author: req.body.author,
            path: req.file.filename,
            tags: tags,
        }, (err, i) => {
            io.emit('newImages')
            res.send({success: true, message: 'image saved', image: i})
        })
        tags.forEach(tag => {
            Tag.find({name: tag}, (err, foundTags) => {
                if (foundTags.length === 0) {
                    Tag.create({name: tag, images: 1})
                } else {
                    Tag.findOneAndUpdate({_id: foundTags[0].id}, {$inc: {'images': 1}}).exec()
                }
            })
        })
    } else {
        res.send('wrong filetype')
    }
})

app.use(router)

server.listen(port, '0.0.0.0')

console.log('server started ' + port)
