'use strict';

// Modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const puppeteer = require('puppeteer');
const fork = require('child_process').fork;
const spawn = require('child_process').spawn;
//const spawnSync = require('child_process').spawnSync;
const fs = require('fs');
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


async function getAudioAndVideo(mainUrl) {
	// Using Puppeteer
	console.log('Puppeteer gonna launch!');
	const browser = await puppeteer.launch({
		executablePath: '/usr/bin/chromium-browser',
		args: ['--no-sandbox', '--disable-dev-shm-usage']
	});

	//const version = await browser.version();
	//console.log('Browser version -> '+version)
	const temp_page = await browser.newPage();
	await temp_page.goto(mainUrl, {waitUntil: 'networkidle0'});
	
	let bodyHTML = await temp_page.content();
	await temp_page.close();

	let audioSrc, videoSrc, videoTitle, result;

	videoTitle = bodyHTML.match(/<h1 class=\"title .*?><.*?>(.*?)</)[1];
	console.log('Video Title -> '+videoTitle);

	if(!fs.existsSync('public/videos/'+videoTitle+'.mp4')) {
		const page = await browser.newPage();
		
		console.log('\nINTERCEPTING RESPONSE');

		const client = await page.target().createCDPSession();
		
		await client.send('Network.enable');
		
		client.on( 'Network.requestWillBeSent', parameters => {
			const request_url = parameters.request.url;
			const initiator_url = parameters.initiator.url;
			//console.log( 'The request', request_url, 'was initiated by', initiator_url, '.' );
	    });

		await client.send('Network.setRequestInterception', {
	    	patterns: [{ urlPattern: '*videoplayback*', resourceType: 'XHR', interceptionStage: 'HeadersReceived'}]
	  	});
		
		
		await client.on('Network.requestIntercepted', async e => {
		    console.log(`Intercepted ${e.request.url} {interception id: ${e.interceptionId}}`);

	    	/*console.log('EVENT INFO: ');
	      	console.log(e.interceptionId);
	      	console.log(e.resourceType);
	      	console.log(e.isNavigationRequest);*/

	    	if(e.request.url.includes('mime=video') && parseInt(e.request.url.match(/dur=(.*?)&/)[1]) > 45.0)
				videoSrc = e.request.url;
			if(e.request.url.includes('mime=audio') && parseInt(e.request.url.match(/dur=(.*?)&/)[1]) > 45.0)
				audioSrc = e.request.url;
			
			await client.send('Network.continueInterceptedRequest', {
	      		interceptionId: e.interceptionId,
	    	});
		});

		
		await page.goto(mainUrl, {waitUntil: 'networkidle0'});
		//await page.waitForRequest(request => request.url().includes('videoplayback'));
		//await page.waitForResponse(response => response.url().includes('mime=audio'));

		if(videoSrc != null) {
			videoSrc = videoSrc.substring(0, videoSrc.indexOf('range=')-1).replace(/%2C/g, ',');
		}
		if(audioSrc != null) {
			audioSrc = audioSrc.substring(0, audioSrc.indexOf('range=')-1).replace(/%2C/g, ',');
		}
		console.log('VideoSrc -> '+videoSrc);
		console.log('AudioSrc -> '+audioSrc);
		result = [videoTitle, videoSrc, audioSrc];
	}else {
		console.log('File already exists!');
		result = [videoTitle];
	}
	
	await browser.close();
	console.log('Puppeteer closed!');
	//console.log('\nRETURN -> '+result+'\n');
	return result;
}

async function saveFiles(videoTitle, videoSrc, audioSrc) {

	/*const args = ['-y', '-i', videoSrc, '-i', audioSrc,
			'-c:v', 'libx264', '-c:a', 'libmp3lame', 'public/videos/'+videoTitle+'.mp4'];
	
	var ffmpeg = spawn('ffmpeg', args);
	
	ffmpeg.stdout.on('data', (data) => {
		console.log(`stdout: ${data}`);
	});

	ffmpeg.stderr.on('data', (data) => {
		console.log(`stderr: ${data}`);
	});

	ffmpeg.on('close', (code) => {
		console.log('Closing FFmpeg with "'+videoTitle+'" (code '+code+').');
		response.send(videoTitle);
	});*/

	
	const proc = await fork('./ffmpeg.js', [videoSrc, audioSrc, videoTitle]);
	return proc;
	/*await proc.on('message', function(msg) {
		console.log('Closing FFmpeg with "'+videoTitle+'"');
		response.send(videoTitle);
	});*/
}

app.post('/', (req, res) => {
	var url = req.body.url;
	console.log('Video link -> ' + url);
	
	getAudioAndVideo(url)
		.then( (videoInfo) => {
			if(videoInfo.length > 1) {
				saveFiles(videoInfo[0], videoInfo[1], videoInfo[2])
				.then( (proc) => {
					proc.on('message', function(msg) {
						console.log('Closing FFmpeg with "'+videoInfo[0]+'"');
						res.status(200);
						res.send(videoInfo[0]);
						//res.end();
					});
				});
			}else {
				res.send(videoInfo[0]);
			}
		});

});

app.listen(PORT, function() {
	console.log('Server running on port ' + PORT);
});
