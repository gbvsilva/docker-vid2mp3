'use strict';

// Modules
const express = require('express');
const puppeteer = require('puppeteer-core');
const bodyParser = require('body-parser');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const logPath = '/var/log/vid2mp3/';
let logText;
// Constants
const PORT = 8000;

// App
const app = express();
app.use(express.static(path.join(__dirname + '/public')));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (req, res) => {
	logText = 'Request from ' + req.connection.remoteAddress+'\n';
	console.log('Request from ' + req.connection.remoteAddress);
	res.sendFile(path.join(__dirname, 'index.html'));
});

function diffS(s, sig) {
	var i = s.indexOf('wwR')-6;
	var changes = {};
	changes.left = i;
    changes.indexes = [];
	s = s.split('');
	var j = i;
	for(; j < sig.length/2; ++j) {
		if(s[j] != sig[j-i]) {
			changes.indexes.push([j, s.indexOf(sig[j-i])]);
		}
	}
	var count_to_delete = 0;
	for(; j<sig.length; ++j) {
		if(s[j] != sig[j-i]) {
			changes.indexes.push([j, s.lastIndexOf(sig[j-i])]);
			count_to_delete++;
		}
	}
	changes.right = count_to_delete;
	return changes;
}

function sWellFormed(s) {
	if(s.includes('=') && s.indexOf('=') >= 100 || !s.includes('='))
		return true;
	return false;

}

async function runPuppeteer(mainUrl) {
	/* Using Puppeteer */
	console.log('Puppeteer gonna launch!');
	const browser = await puppeteer.launch({
		executablePath: '/usr/bin/chromium-browser',
		args: ['--no-sandbox', '--disable-dev-shm-usage']
	});

	//const version = await browser.version();
	//console.log('Browser version -> '+version)
	const page = await browser.newPage();
	
  	// INTERCEPTING

  	await page.goto(mainUrl, {waitUntil: 'domcontentloaded'});
  	var pageContent = await page.content();
  	//await page.close();

	var videoTitle = await pageContent.match(/\"title\":\"(.+?)\"/)[1];
  	
  	var webContents = {};
  	webContents.browser = browser;
  	var i = pageContent.indexOf('{\\\"itag\\\":18');
	var	j = pageContent.substring(i).indexOf('}')+1;
	webContents.media = JSON.parse(pageContent.substring(i, i+j).replace(/\\/g, '')
							.replace(/; codecs.*\".*\",/, '\",'));
  	webContents.media.title = videoTitle;
  	webContents.page = page;
  	return webContents;
}

async function runInterception(webContents) {
	const client = await webContents.page.target().createCDPSession();
	await client.send('Network.enable');

	await client.on('Network.requestWillBeSent', parameters => {
		const request_url = parameters.request.url;
		const initiator_url = parameters.initiator.url;
		//console.log( 'The request', request_url, 'was initiated by', initiator_url, '.' );
    });

    await client.send('Network.setRequestInterception', {
    	patterns: [{ urlPattern: '*videoplayback*', resourceType: 'XHR', interceptionStage: 'HeadersReceived'}]
  	});

  	console.log('\nINTERCEPTING RESPONSE');
	await client.on('Network.requestIntercepted', async e => {
	    console.log(`Intercepted ${e.request.url} {interception id: ${e.interceptionId}}`);
	    if(e.request.url.includes('mime=video')) {
	    	webContents.videoSource = e.request.url.split('&');
	    	return;
	    }
	});

	await webContents.page.reload({waitUntil: 'domcontentloaded'})
	const pageContent = await webContents.page.content();
	var i = pageContent.indexOf('{\\\"itag\\\":18');
	var	j = pageContent.substring(i).indexOf('}')+1;
	webContents.media = JSON.parse(pageContent.substring(i, i+j).replace(/\\/g, '')
							.replace(/; codecs.*\".*\",/, '\",'));
}

async function genSig(webContents) {
	var pageContent = await webContents.page.content();
	var i = pageContent.indexOf('{\\\"itag\\\":'+webContents.videoSource.join('')
									.match(/itag=(.+?)aitags/)[1]);
	var j = pageContent.substring(i).indexOf('},{')+1;
	var cipher = pageContent.substring(i, i+j).replace(/\\/g, '');
	cipher = cipher.match(/cipher\":\"(.+?)\"/)[1].replace(/u0026/g, '&');
	cipher = cipher.split('&');
	//console.log('cipher -> '+cipher);

	/* Starting Crypto Analysis */
	i = cipher.findIndex(elem => elem.startsWith('s='));
	var s = decodeURIComponent(cipher[i].match(/s=(.+)/)[1]);
	console.log('VideoSource -> ' +webContents.videoSource);
	i = webContents.videoSource.findIndex(elem => elem.startsWith('sig='))
	var sig = decodeURIComponent(webContents.videoSource[i].match(/sig=(.+)/)[1]);
	if(s.includes('Rww')) {
		s = s.split('').reverse().join('');				
	}
	console.log('\ns -> '+s);
	console.log('sig -> '+sig+'\n');
	var changes = diffS(s, sig);

	var url = webContents.media.cipher.replace(/u0026/g, '&').split('&');
	i  = url.findIndex(elem => elem.startsWith('s='));
	var sFinal = decodeURIComponent(url[i].match(/s=(.+)/)[1]);

	if(sFinal.includes('Rww')) {
		sFinal = sFinal.split('').reverse();
	}else {
		sFinal = sFinal.split('');
	}
	
	if(sFinal.length >= s.length) {
		console.log('sFinal0 -> '+sFinal.join(''));
		var c = [0, sFinal[0]];
		changes.indexes.forEach(elem => {
			console.log('IdxElem -> '+elem.toString());
			var temp = sFinal[elem[0]];
			if(c[0] == elem[1]) {
				sFinal[elem[0]] = c[1];
			}else {
				sFinal[elem[0]] = sFinal[elem[1]];
			}
			c[0] = elem[0];
			c[1] = temp;
		});
		console.log('sFinal1 -> '+sFinal.join(''));
		sFinal.splice(0, changes.left, '');

		for(var j=0; j < sFinal.length-sig.length+1; ++j)
			sFinal.pop();
		if(sFinal[0] != 'A') {
			sFinal.splice(0, 2, 'A');
		}
		console.log('sFinal2 -> '+sFinal.join(''));
		sFinal = sFinal.join('');
		if(sWellFormed(sFinal)) {
			var url = webContents.media.cipher.replace(/u0026/g, '&').split('&');
			i  = url.findIndex(elem => elem.startsWith('url='));
			url = decodeURIComponent(url[i].match(/url=(.+)/)[1]);
			url += '&sig='+sFinal;
			console.log('FINAL URL -> '+url);
			webContents.media.url = url;
			return true;
		}
	}
	return false;
}

async function getMedia(mainUrl) {

	var webContents = await runPuppeteer(mainUrl);
	var videoTitle = webContents.media.title;
	console.log('Video Title -> '+videoTitle);
	
	if(typeof webContents.media.url !== 'undefined') {
		webContents.media.url = decodeURIComponent(webContents.media.url.replace(/u0026/g, '&'));
		logText += 'Video Title -> '+webContents.media.title+'\n';
		logText += 'FINAL Media URL -> '+webContents.media.url+'\n';
		console.log('FINAL Media URL -> '+webContents.media.url);
		await webContents.browser.close();
		console.log('1. Puppeteer closed!');
		return webContents.media;
	}else {
		let ok;
		do {
			await runInterception(webContents);
			ok = await genSig(webContents)
			if(ok) {
				webContents.media.title = videoTitle;
				logText += 'Video Title -> '+videoTitle+'\n';
				logText += 'FINAL URL -> '+webContents.media.url+'\n';
				await webContents.browser.close();
				console.log('2. Puppeteer closed!');
				return webContents.media;
			}
		}while(true);
	}
}

app.post('/', (req, res) => {
	const url = req.body.url;
	console.log('Video link -> ' + url);
	var dt = new Date();
	
	getMedia(url).then(media => {	
		logText = logText+'Video requested at '+dt.getHours()+':'+dt.getMinutes()+':'+dt.getSeconds()+'\n\n';
		const logFileName = dt.getDate()+'-'+parseInt(dt.getMonth()+1)+'-'+dt.getFullYear()+'.log';
		fs.appendFile(logPath+logFileName, logText, (err) => {
			if(err) {
				throw err;
			}
		});
		res.send(JSON.stringify(media));
	});
	/*res.setHeader("Content-Type", "application/json");

	getAudioAndVideo(url).then((videoInfo) => {
		if(videoInfo[2] != null && videoInfo[3] != null)
			saveFiles(videoInfo[0], videoInfo[1], videoInfo[2], videoInfo[3], res);
		else {
			res.write(JSON.stringify({"videoTitle": "This video is not supported!"}));
			res.end();
		}
	});*/
});

app.listen(PORT, function() {
	console.log('Server running on port ' + PORT);
});
