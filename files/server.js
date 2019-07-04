'use strict';

// Modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
// Constants
const PORT = 80;

// App
const app = express();
app.use(express.static(path.join(__dirname + '/public')));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (req, res) => {
	console.log('Request from ' + req.connection.remoteAddress);
	res.sendFile(path.join(__dirname, 'index.html'));
});

var url = '';
var html = null;

app.post('/send', (req, res) => {
	url = req.body.url;
	console.log('Video link -> ' + url);	
	run();
	res.send(html);
});

const puppeteer = require('puppeteer');


async function run() {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url, { waitUntil: "networkidle2" });
	// hacky defensive move but I don't know a better way:
	// wait a bit so that the browser finishes executing JavaScript
	await page.waitFor(1 * 1000);
	html = await page.content();
	//fs.writeFileSync("index.html", html);
	await browser.close();
}

app.listen(PORT, function() {
	console.log('Server running on port ' + PORT);
});
