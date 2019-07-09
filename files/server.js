'use strict';

// Modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
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


const getMethods = (obj) => {
  let properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)))
  return [...properties.keys()].filter(item => typeof obj[item] === 'function')
}

async function getAudioAndVideo(url) {
	// Using Puppeteer
	console.log('Puppeteer gonna launch!');
	const browser = await puppeteer.launch({
		executablePath: '/usr/bin/chromium-browser',
		args: ['--no-sandbox', '--disable-dev-shm-usage']
	});

	const temp_page = await browser.newPage();
	await temp_page.goto(url);

	let bodyHTML = await temp_page.evaluate(() => document.body.innerHTML);
	await temp_page.close();

	var start = bodyHTML.indexOf('url_encoded_fmt_stream_map');
	start += bodyHTML.substring(start).indexOf('http');
	var end = bodyHTML.substring(start).indexOf('\"');
	end += start;
	
	var srcUrl = bodyHTML.substring(start, end);
	srcUrl = decodeURIComponent(srcUrl);
	srcUrl = srcUrl.replace(/\\u0026/g, '&');

	const page = await browser.newPage();
	
	let resUrl, headers, contentType;
	let audioSrc, videoSrc;
	console.log('\nINTERCEPTING RESPONSE');
	await page.on('response', async response => {
		resUrl = response.url();
		headers = response.headers();
		//console.log('URL -> '+resUrl);
		for(var key in headers) {
		    if(headers.hasOwnProperty(key)) {
		    	if(key === 'content-type')
		    		contentType = headers[key];
		    }
		}
		if(resUrl.includes('videoplayback') && (contentType.includes('video') || contentType.includes('audio')))
			console.log('URL -> '+resUrl);
		if(contentType === 'video/webm' && parseInt(resUrl.match(/dur=(.*?)&/)[1]) > 30.0) {
			videoSrc = resUrl;
		}else if(contentType === 'audio/webm' && parseInt(resUrl.match(/dur=(.*?)&/)[1]) > 30.0) {
			audioSrc = resUrl;
		}
		
    	//console.log(await response.status());
	});
	//const client = await page.target().createCDPSession();
	
	/*await client.send('Network.enable');
	await client.send('Network.setRequestInterception', {
    	patterns: [{ urlPattern: '*videoplayback*', resourceType: 'XHR', interceptionStage: 'HeadersReceived'}]
  	});
	*/
	
	
	/*await client.on('Network.requestIntercepted', async e => {
	    //console.log(`Intercepted ${e.request.url} {interception id: ${e.interceptionId}}`);

    	
		const response = await client.send('Network.getResponseBodyForInterception',{ interceptionId: e.interceptionId });
    	const contentTypeHeader = Object.keys(e.responseHeaders).find(k => k.toLowerCase() === 'content-type');
    	let newBody, contentType = e.responseHeaders[contentTypeHeader];
    	console.log('Intercepted Content-Type: '+contentType);

    	if(contentType === 'video/webm' && parseInt(e.request.url.match(/dur=(.*?)&/)[1]) > 30.0)
			videoSrc = e.request.url;
		if(contentType === 'audio/webm' && parseInt(e.request.url.match(/dur=(.*?)&/)[1]) > 30.0)
			audioSrc = e.request.url;
		
		await client.send('Network.continueInterceptedRequest', {
      		interceptionId: e.interceptionId,
    	});
	});*/

	
	
	//const src = await getVideoSrc(bodyHTML);
	
	await page.goto(url, {waitUntil: 'networkidle0'});
	//await page.waitForSelector('ytd-video-renderer,ytd-grid-video-renderer', { timeout: 10000 });
	/*await client.send('Network.continueInterceptedRequest', {
      interceptionId,
    });*/

	if(videoSrc != null) {
		videoSrc = videoSrc.substring(0, videoSrc.indexOf('range=')-1).replace(/%2C/g, ',');
	}
	if(audioSrc != null) {
		audioSrc = audioSrc.substring(0, audioSrc.indexOf('range=')-1).replace(/%2C/g, ',');
	}
	await browser.close();
	console.log('Puppeteer closed!');
	const videoTitle = bodyHTML.match(/document.title = \"(.*?) - YouTube\"/)[1];
	console.log('VideoSrc -> '+videoSrc);
	console.log('AudioSrc -> '+audioSrc);
	
	
	return [videoTitle, videoSrc, audioSrc];
}

async function saveFiles(videoTitle, videoSrc, audioSrc) {
	
	var cmd = 'ffmpeg -i "'+videoSrc+'" -i "'+audioSrc+'" -pix_fmt yuv420p -c:v libx264 public/videos/"'+videoTitle+'".mp4';
	//var cmd2 = 'ffmpeg "'+audioSrc+'" -O audio.webm';
	await exec(cmd, (error, stdout, stderr) => {
		if (error) {
	    	console.error(`exec error: ${error}`);
	    	return;
	  	}
		console.log(`stdout: ${stdout}`);
		console.log(`stderr: ${stderr}`);
	});
	

	/*await exec(cmd2, (error, stdout, stderr) => {
		if (error) {
	    	console.error(`exec error: ${error}`);
	    	return;
	  	}
		console.log(`stdout: ${stdout}`);
		console.log(`stderr: ${stderr}`);
	});*/
}

app.post('/', (req, res) => {
	var url = req.body.url;
	console.log('Video link -> ' + url);
	
	getAudioAndVideo(url)
		.then((videoInfo) => {
			saveFiles(videoInfo[0], videoInfo[1], videoInfo[2]).then( () => {
				console.log('End of server side.\n');
				res.send(videoInfo[0]);	
			});
		})
		/*.catch((err) => {
			console.log('Error calling audioVideoFunction!');
		})*/;

});

app.listen(PORT, function() {
	console.log('Server running on port ' + PORT);
});
