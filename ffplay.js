//client.js
const spawn = require('child_process').spawn;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:9000/', {reconnect: true});

// Add a connect listener
socket.on('connect', function (socket) {
    console.log('Connected!');
});
socket.emit('CH01', 'me', 'test msg');

ffplay();

function ffplay(){
		const q = new Promise((resolve, reject) => {
		
		const ffplay = spawn('ffplay', ['-probesize', '35000', '-sync', 'ext', 'rtmp://10.13.148.35/live/stream']);
		
		ffplay.stderr.on('data', (data) => {
			console.log(`${data}`);
		});
		
		ffplay.on('close', (code) => {
			resolve();
		});
	});
		return q;
}