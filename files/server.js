'use strict';

// Modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const puppeteer = require('puppeteer');
const { spawn, spawnSync } = require('child_process');
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

	let audioSrc, videoSrc, videoTitle, videoDuration, result;

	videoTitle = bodyHTML.match(/<h1 class=\"title .*?><.*?>(.*?)</)[1];
	console.log('Video Title -> '+videoTitle);

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

    	if(e.request.url.includes('mime=video') && parseInt(e.request.url.match(/dur=(.*?)&/)[1]) > 59.0) {
			videoSrc = e.request.url;
			videoDuration = parseInt(e.request.url.match(/dur=(.*?)&/)[1]);
    	}
		if(e.request.url.includes('mime=audio') && parseInt(e.request.url.match(/dur=(.*?)&/)[1]) > 59.0)
			audioSrc = e.request.url;
		
		await client.send('Network.continueInterceptedRequest', {
      		interceptionId: e.interceptionId,
    	});
	});

	
	await page.goto(mainUrl, {waitUntil: 'networkidle0'});

	if(videoSrc != null) {
		videoSrc = videoSrc.substring(0, videoSrc.indexOf('range=')-1).replace(/%2C/g, ',');
	}
	if(audioSrc != null) {
		audioSrc = audioSrc.substring(0, audioSrc.indexOf('range=')-1).replace(/%2C/g, ',');
	}
	console.log('VideoSrc -> '+videoSrc);
	console.log('AudioSrc -> '+audioSrc);
	result = [videoTitle, videoDuration, videoSrc, audioSrc];
	
	await browser.close();
	console.log('Puppeteer closed!');
	return result;
}

function spawnWgets(videoTitle, videoSrc, audioSrc, stderr1, stderr2, response) {
	var result = [];
	return new Promise((resolve, reject) => {
		const wget1_args = ['-O', videoTitle+'.mp4', videoSrc];
		const wget1 = spawn('wget', wget1_args);
		const wget2_args = ['-O', videoTitle+'.webm', audioSrc];
		const wget2 = spawn('wget', wget2_args);

		wget1.stderr.on('data', (data) => {
			console.log(`wget1 stderr: ${data}`);
			response.write('"wget1_closed": false, ');
			stderr1.push(data);
		});

	
		wget2.stderr.on('data', (data) => {
			console.log(`wget2 stderr: ${data}`);
			response.write('"wget2_closed": false, ');
			stderr2.push(data);
		});

		wget1.on('close', (code) => {
			console.log(`wget1 closed with code ${code}`);
			result.push(code);
			response.write('"wget1_closed": true, ');
			if(result.length == 2)
				resolve(result);
		});

		wget2.on('close', (code) => {
			console.log(`wget2 closed with code ${code}`);
			result.push(code);
			response.write('"wget2_closed": true, ');
			if(result.length == 2)
				resolve(result);
		});
	});
}

async function saveFiles(videoTitle, videoDuration, videoSrc, audioSrc, res) {
	res.write('{');
	videoTitle = videoTitle.replace(/\//g, '-');
	videoTitle = videoTitle.replace(/\"/g, '');

	var wget1_stderr = [];
	var wget2_stderr = [];
	const wget_codes = await spawnWgets(videoTitle, videoSrc, audioSrc, wget1_stderr, wget2_stderr, res);
	

	if(wget_codes[0] === 0 && wget_codes[1] === 0) {
		res.write('"wget1_code": '+wget_codes[0]+', "wget1": [');
		wget1_stderr.forEach(function(elem, index) {
			elem = elem.toString()
			elem = elem.replace(/\n/g, '');
			elem = elem.replace(/\t/g, '');
			elem = elem.replace(/\r/g, '');
			res.write('"'+elem+'", ');
		});
		res.write('"end"], "wget2_code": '+wget_codes[1]+', "wget2": [');
		wget2_stderr.forEach(function(elem, index) {
			elem = elem.toString();
			elem = elem.replace(/\n/g, '');
			elem = elem.replace(/\t/g, '');
			elem = elem.replace(/\r/g, '');
			res.write('"'+elem+'", ');
		});
		res.write('"end"], ');

		const ffmpeg_args = ['-y', '-i', videoTitle+'.mp4', '-i', videoTitle+'.webm',
		'-c:v', 'libx264', '-c:a', 'libmp3lame', '-ar', '48000', 'public/videos/'+videoTitle+'.mp4'];

		const ffmpeg = spawn('ffmpeg', ffmpeg_args);
		
		ffmpeg.stdout.on('data', (data) => {
			console.log(`ffmpeg stdout: ${data}`);
		});

		var ffmpeg_stderr = [];
		ffmpeg.stderr.on('data', (data) => {
			console.log(`ffmpeg stderr: ${data}`);
			ffmpeg_stderr.push(data);
			res.write('"ffmpeg_closed": false, ');
		});

		ffmpeg.on('close', (code) => {
			console.log('Closing FFmpeg with "'+videoTitle+'" (code '+code+').');
			res.write('"ffmpeg_closed": true, ');
			if(code === 0) {
				
				const rm = spawn('rm', [videoTitle+'.mp4', videoTitle+'.webm']);
				rm.on('close', (code) => {
					if(code === 0)
						console.log('Temporary files deleted!');
					else
						console.log('Temporary files not deleted!');
				});

				res.write('"ffmpeg_code": '+code+', ');
				res.write('"ffmpeg": [');
				ffmpeg_stderr.forEach(function(elem, index) {
					elem = elem.toString();
					elem = elem.replace(/\n/g, '');
					elem = elem.replace(/\t/g, '');
					elem = elem.replace(/\r/g, '');
					res.write('"'+elem+'", ');
				});
				res.write('"end"], "videoTitle": "'+videoTitle+'" }');
				res.end();
			}else {
				res.write('"videoTitle": "This video is not supported!" }');
				res.end();
			}
			//res.send();
		});
	}else {
		console.log('wgets failed!');
		res.write('}');
		res.end();
	}
}

app.post('/', (req, res) => {
	const url = req.body.url;
	console.log('Video link -> ' + url);

	res.setHeader("Content-Type", "application/json");

	getAudioAndVideo(url).then((videoInfo) => {
		if(videoInfo[2] != null && videoInfo[3] != null)
			saveFiles(videoInfo[0], videoInfo[1], videoInfo[2], videoInfo[3], res);
		else {
			res.write(JSON.stringify({"videoTitle": "This video is not supported!"}));
			res.end();
		}
	});
});

app.listen(PORT, function() {
	console.log('Server running on port ' + PORT);
});
