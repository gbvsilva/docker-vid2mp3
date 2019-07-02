'use strict';

const express = require('express');

// Constants
const PORT = 7831;
const HOST = '0.0.0.0';

// App
const app = express();
app.get('/', (req, res) => {
  console.log('Request accepted');
  res.sendfile('index.html');
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);