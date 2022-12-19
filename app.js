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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})