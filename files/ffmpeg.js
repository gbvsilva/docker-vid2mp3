const fs = require('fs');
const spawn = require('child_process').spawn;

//console.log('ARGS2 -> ', process.argv[2], process.argv[3], process.argv[4]);
var videoSrc = process.argv[2];
var audioSrc = process.argv[3];
var videoTitle = process.argv[4];

var args = ['-y', '-i', videoSrc, '-i', audioSrc,
			'-c:v', 'libx264', '-c:a', 'libmp3lame', 'public/videos/'+videoTitle+'.mp4'];

var ffmpeg = spawn('ffmpeg', args);

ffmpeg.stdout.on('data', (data) => {
	console.log(`stdout: ${data}`);
});

ffmpeg.stderr.on('data', (data) => {
	console.log(`stderr: ${data}`);
});

ffmpeg.on('close', (code) => {
	console.log(`child process exited with code ${code}`);
	process.send({custom: 'message'});
});