'use strict';

// Modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const rp = require('request-promise');
// Constants
const PORT = 8000;

// App
const app = express();
app.use(express.static(path.join(__dirname + '/public')));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (req, res) => {
	console.log('Request from ' + req.connection.remoteAddress);
	res.sendFile(path.join(__dirname, 'index.html'));
});

function repeatRequestPromise(url) {

}

async function getMedia(url) {
	return new Promise((resolve, reject) => {
		var tries = 0;
		//while(tries < 5){
			rp(url)
				.then((html) => {
					// success
					var i = html.indexOf('{\\\"itag\\\":18');
					var j = html.substring(i).indexOf('}')+1;
					var str = html.substring(i, i+j).replace(/\\/g, '');
					console.log(str)
					var mediaInfo = JSON.parse(str.replace(/; codecs=\".+?\"/g, ''));
					mediaInfo.title = html.match(/\\\"title\\\":\\\"(.+?)\\\"/)[1];
					console.log('Title -> '+mediaInfo.title);
					
					if(typeof mediaInfo.url === 'undefined') {
						var cipher = decodeURIComponent(mediaInfo.cipher);
						console.log('CIPHER -> '+cipher);
						let m, url;
						if(cipher.indexOf('s=') < cipher.indexOf('url=')) {
							console.log('OK1');
							m = cipher.match(/s=(.+?)u0026/);
							if(cipher.indexOf('url=') < cipher.indexOf('sp=sig')) {
								console.log('OK1.1');
								url = cipher.match(/url=(.+)u0026/);
							}
							else {
								console.log('OK1.2');
								url = cipher.match(/url=(.+)/);
							}
						}else {
							console.log('OK2');
							url = cipher.match(/url=(.+?)u0026/);
							if(cipher.indexOf('u0026s=') < cipher.indexOf('sp=sig')) {
								console.log('OK2.1');
								m = cipher.match(/u0026s=(.+?)u0026/);
							}
							else {
								console.log('OK2.2');
								m = cipher.match(/u0026s=(.*)/);
							}
						}

						if(m && url) {
							console.log('OK3');
							url = url[1];
							var sig = Array.from(m[1]);
							console.log('sig -> '+sig.join(''));
							m = sig.join('').match('2IxgL');
							if(m) {
								sig.reverse();
								console.log('Reverse -> '+sig.join(''));
							}
							if(sig.join('').indexOf('LgxI2') > -1 && sig.indexOf('=') > -1 && sig.indexOf('=') < 100) {
								console.log('OK4');
								sig[sig.indexOf('=')] = sig[sig.length-1];
								sig[sig.length-1] = '=';
								sig[0] = 'A';
								mediaInfo.url = url+'&sig='+sig.join('');
								console.log('== SUCCESS ==');
								resolve(mediaInfo);
							}
						}
					}else {
						console.log('== SUCCESS ==');
						resolve(mediaInfo);
					}
				})
				.catch((err) => {
					console.log('Error on request-promise: '+err.stack);
				});
			++tries;
		//}
	}); 
	
}

/*function spawnWgets(videoTitle, videoSrc, audioSrc, stderr1, stderr2, response) {
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
*/
app.post('/', (req, res) => {
	const url = req.body.url;
	console.log('Video link -> ' + url);
	
	const media = getMedia(url);

	media.then((info) => {
		console.log('\nVideo URL -> '+info.url);	
	})

	res.setHeader("Content-Type", "application/json");
	/*getAudioAndVideo(url).then((videoInfo) => {
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
