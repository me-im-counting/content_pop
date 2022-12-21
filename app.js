const express = require('express')
const path = require('path')
const app = express()
const port = 3000

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.static(path.join(__dirname, 'public/model')))
app.use(express.static(path.join(__dirname, 'public/images')))
app.use(express.static(path.join(__dirname, 'public/style')))
app.use(express.static(path.join(__dirname, 'public/javascript')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/index.html'));
})

app.get('/.well-known/acme-challenge/xnCO8GhMXtTiOGMovFHl9zF3yB_8Mf13qVxPGjsFC4c', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/a.txt'));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})