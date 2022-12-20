const {
  phoneNumberFormatter
} = require('./helpers/formatter');
const {
  Client,
  LocalAuth
} = require('whatsapp-web.js');
const basicAuth = require('express-basic-auth')
const express = require('express')
const socket = require('socket.io')
const qrcode = require('qrcode')
const http = require('http')
const axios = require('axios');
const dayjs = require('dayjs');

// port and api url
const port = process.env.PORT || 5000

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  authStrategy: new LocalAuth()
});

const app = express()
const server = http.createServer(app)
const io = socket(server)

app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))

app.get('/', (req, res) => {
  var apikey = req.query.apikey;

  if (apikey === '2117102004') {
    res.sendfile('public/index.html', {
      root: __dirname
    })
  } else {
    res.send('403')
  }
})

client.on('message', msg => {
  if (msg.body.match(/!sholat/) !== null) {
    let country = msg.body.split('sholat')[1]

    axios.get(`https://api.myquran.com/v1/sholat/kota/cari/${country}`)
      .then(function (res) {
        if (res.data.status == false) {
          msg.reply(res.data.message)
          return
        }

        let id = res.data.data[0].id
        axios.get(`https://api.myquran.com/v1/sholat/jadwal/${id}/${dayjs().format('YYYY/MM/DD')}`)
          .then(function (api) {
            api = api.data

            msg.reply(`🕌 Jadwal Sholat 🌎 *${api.data.lokasi}* Tanggal *${api.data.jadwal.tanggal}*\n\n imsak : ${api.data.jadwal.imsak}\n subuh : ${api.data.jadwal.subuh}\n terbit : ${api.data.jadwal.terbit}\n dhuha : ${api.data.jadwal.dhuha}\n dzuhur : ${api.data.jadwal.dzuhur}\n ashar : ${api.data.jadwal.ashar}\n maghrib : ${api.data.jadwal.maghrib}\n isya : ${api.data.jadwal.isya}\n\n jangan tinggalkan sholat ya dunia ini sementara 😊`);
          })
          .catch(function (error) {
            msg.reply(`ada yang error ni ${error}`);
          })

      }).catch(function (error) {
        msg.reply(`ada yang error ni ${error}`);
      })

  } else if(msg.body){
    msg.reply(`Hai ini 🤖 bot KR, bot ini masih dalam pegembangan 🙏\n\n *Menu*\n !sholat (kabupaten/kota)`);
  }
});

client.initialize()

// Socket IO
io.on('connection', function (socket) {
  socket.emit('message', 'Connecting...');

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code received, scan please!');
    });
  });

  client.on('ready', () => {
    socket.emit('ready', 'Whatsapp is ready!');
    socket.emit('message', 'Whatsapp is ready!');
  });

  client.on('authenticated', () => {
    socket.emit('authenticated', 'Whatsapp is authenticated!');
    socket.emit('message', 'Whatsapp is authenticated!');
    console.log('AUTHENTICATED');
  });

  client.on('auth_failure', function (session) {
    socket.emit('message', 'Auth failure, restarting...');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Whatsapp is disconnected!');
    client.destroy();
    client.initialize();
  });
});

app.use(basicAuth({
  users: {
    'apiwaKR': 'Adh1706#'
  }
}))

// Send message api
app.post('/send-message', (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;
  let apikey = req.query.apikey;

  if (apikey === 'rahasia17') {
    client.sendMessage(number, message).then(response => {
      res.status(200).json({
        status: true,
        response: response
      })
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      })
    })
  } else {
    res.send('403')
  }
})

server.listen(port, function () {
  console.log('App running on :' + port)
})