const fs = require('fs');
const express = require('express');
const path = require('path');
const app = express();
const http = require('http');
const https = require('https');

const privateKey = fs.readFileSync(path.join(__dirname, 'private/privkey.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'private/cert.pem'), 'utf8');
const ca = fs.readFileSync(path.join(__dirname, 'private/chain.pem'), 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.static(path.join(__dirname, 'public/model')))
app.use(express.static(path.join(__dirname, 'public/images')))
app.use(express.static(path.join(__dirname, 'public/style')))
app.use(express.static(path.join(__dirname, 'public/javascript')))

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/index.html'));
})

app.get('/render', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/render.html'));
})

httpServer.listen(3000, () => {
	console.log('HTTP Server running on port 3000');
});

httpsServer.listen(443, () => {
	console.log('HTTPS Server running on port 443');
});

