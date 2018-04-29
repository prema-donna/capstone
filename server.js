var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io', { rememberTransport: false, transports: ['WebSocket', 'Flash Socket', 'AJAX long-polling'] })(http);
const spawn = require('child_process').spawn;


app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/session.html');
});

defaultNames = ['USER10', 'USER9', 'USER8', 'USER7', 'USER6', 'USER5', 'USER4', 'USER3', 'USER2', 'USER1'];
availableNames = ['USER10', 'USER9', 'USER8', 'USER7', 'USER6', 'USER5', 'USER4', 'USER3', 'USER2', 'USER1'];
clients = [];
administrator = '';
availableModes = ["adminMode", "voteForUser", "voteForMovement", "volunteerForUser"];

//VOTES! each array element in votes has form [User, User's Vote, User's Points]. Code does not care what votes come in, it must handle anything gracefully (for now, "anything" means any string)
// Points is only used for the 'volunteer' mode. I still dont feel great about this, but it might be best-LH
//example votes for voteForMovement
//let votes = [ ["bob","Down", 0], ["joe", "Up", 0], ["steve", "Up", 0] ];
//example votes for voteForUser
//let votes = [ ["bob","steve", 0], ["joe", "steve", 0], ["steve", "bob", 0] ];
//example votes for volunteerForUser
// let votes = [ ["bob","RequestForControl", 5], ["joe", "RequestForControl", 6], ["steve", "RequestForControl", 3], ["mike", "no", 50] ];
let votes = [];
let userInControl = '';
let currentMode = "adminMode";
	//we need to decide how to get this functions output!!!
let nextMicroscopeDirection = "None"; //should this be declared elsewhere?
let cmd = "None";

let controllerFunction = function() {
	console.log("controllerFunction started! Mode is: " + currentMode);
	let POINTS_WANT_CONTROL = 3;
	let POINTS_DONT_WANT_CONTROL = 1;

	if (currentMode === "adminMode") {
		//get the user name the admin want to be in controllerFunction
		//userInControl = CHOOSENUSER
    index = findIndex(votes, userInControl);
    if (index != -1){
      if (votes[index][1] != ""){
        io.emit('chat message', "NEXT MOVEMENT: " + votes[index][1] + "...");
        sendCommandToMicroscope(votes[index][1]);
      }
    }
  }

	else if (currentMode === "voteForMovement") {
	    let voteTally = [["None", 0], ["Up", 0], ["Down", 0], ["Left", 0], ["Right", 0], ["ZoomIn", 0], ["ZoomOut", 0]]; //the tallies of the five vote types we will accept
		for (let i = 0; i < votes.length; i++) { //check each user and add their vote (if valid) to the tally
		    //these ifs could be replaced by a nested loop (outer of user loop) iterating through valid vote options
		    if (votes[i][1] === "None") { //if user i voted for "None"
		        voteTally[0][1]++; //increment voteTally "None"
		    }
		    else if (votes[i][1] === "Up") { //if user i voted for "Up"
		        voteTally[1][1]++; //increment voteTally "Up"
		    }
		    else if (votes[i][1] === "Down") {
		        voteTally[2][1]++;
		    }
		    else if (votes[i][1] === "Left") {
		        voteTally[3][1]++;
		    }
		    else if (votes[i][1] === "Right") {
		        voteTally[4][1]++;
		    }
		    else if (votes[i][1] === "ZoomIn") {
		        voteTally[5][1]++;
		    }
		    else if (votes[i][1] === "ZoomOut") {
		        voteTally[6][1]++;
		    }
		    else { //user vote is invalid
		        console.log("User: " + votes[i][0] + " submitted unknown vote! Vote was: " + votes[i][1]);
		        //do nothing about the bad vote?
		    }
		}

		nextMicroscopeDirection = "None";
		let temp = 0; //number of votes for some direction
		for (let i = 0; i <= 6; i++) { //check what direction has the most votes //MAGIC NUMBER 6 === # of valid vote options
			if (voteTally[i][1] > temp) {
				//this direction is currently winning the vote
				temp = voteTally[i][1];
				nextMicroscopeDirection = voteTally[i][0];
			}
		}
		console.log("controllerFunction() decided nextMicroscopeDirection: " + nextMicroscopeDirection);

    recordedVotes = '';
    for (i=0; i<voteTally.length; i++){
      if(voteTally[i][1] != 0){
        recordedVotes += voteTally[i][0] + ": " + voteTally[i][1] + ", ";
      }
    }
    recordedVotes = recordedVotes.substring(0, recordedVotes.length - 2);

    io.emit('chat message', recordedVotes);
    io.emit('chat message', "NEXT MOVEMENT: " + nextMicroscopeDirection);
    sendCommandToMicroscope(nextMicroscopeDirection);
	}

	else if (currentMode === "voteForUser") {
		voteTally = [];
		for (let i = 0; i < votes.length; i++) { //create an array of arrays (just like the voteForMovement voteTally). each element has user name and will track the number of votes for that user
			voteTally.push(new Array( votes[i][0], 0 ));
		}
		for (let h = 0; h < voteTally.length; h++) { //for each possible vote (each user name)
			for (let i = 0; i < votes.length; i++) { //check each users vote, and add to tally if it matches the one were counting
				if (voteTally[h][0] === votes[i][1]) { //if user i voted for user h
					if (voteTally[h][0] === votes[i][0]) { //if the user i voted for themself
						console.log("User " + votes[i][0] + " voted for themself! Discarded!");
					}
					else {
						voteTally[h][1] ++; //increment voteTally for user h
					}
				}
				//else //user i vote wasnt for h, nothing we can say about it. the vote is still probably valid
			}
		}
		//console.log("voteTally: " + voteTally);

		let nextUserInControl = administrator; //its probably not safe to have no one win. someone needs control
		let temp = 0; //number of votes for some user
		for (let i = 0; i < voteTally.length; i++) {
			if (voteTally[i][1] > temp) {
				//this user is currently winning the vote
				temp = voteTally[i][1];
				nextUserInControl = voteTally[i][0];
			}
		}
		console.log("controllerFunction() decided nextUserInControl: " + nextUserInControl);
    io.emit('chat message', nextUserInControl + " is now in control. Vote for the next user.");
    userInControl = nextUserInControl;
    io.emit('userInControl update', userInControl);
	}

	else if (currentMode === "volunteerForUser") {
		for (let i = 0; i < votes.length; i++) {//add points to users according to their preference
			if (votes[i][1] === "Yes") {
				votes[i][2] += POINTS_WANT_CONTROL;
			}
			else {
				votes[i][2] += POINTS_DONT_WANT_CONTROL;
			}
		}

		let temp = 0;
		let winnerIndex = -1;
		for (let i = 0; i < votes.length; i++) {
			if ( (votes[i][1] === "Yes") && (votes[i][2] > temp) ) { //use i wanted control, and is now winning
				temp = votes[i][2];
				winnerIndex = i;
				nextUserInControl = votes[i][0];
			}
		}

		if (winnerIndex === -1) { //nobody wanted control, just find the user with the most points
			temp = 0;
			//nextUserInControl = votes[0][0]; //I dont think this is needed as a tie breaker. Someone must always have at least one point, because we added points above, so the next loop will find someone
			for (let i = 0; i < votes.length; i++) {
				if (votes[i][2] > temp) {
					temp = votes[i][2];
					winnerIndex = i;
					nextUserInControl = votes[i][0];
				}
			}
		}
		else {
			votes[winnerIndex][2] = 0; //reset a willing winners points
		}

		console.log("controllerFunction() decided nextUserInControl: " + nextUserInControl);
    userInControl = nextUserInControl;
    io.emit('chat message', "The next user in control is: " + userInControl);
    io.emit('userInControl update', userInControl);

    recordedPoints = '';
    for (i=0; i<votes.length; i++){
      recordedPoints += votes[i][0] + ": " + votes[i][2] + ", ";
    }
    recordedPoints = recordedPoints.substring(0, recordedPoints.length - 2);
    io.emit('chat message', "The points are now: " + recordedPoints);
	}

	else {
		//no mode set!
		console.log("No valid currentMode set! controllerFunction() fails!");
	}

  for (let i=0; i<votes.length; i++){
    votes[i][1] = ""
  }

  console.log("userInControl: " + userInControl);

}

let updateClients = function(){
	io.emit('users update', clients);
  console.log(clients)
}

let findIndex = function(votes, name){
  for(let i=0; i<votes.length; i++) {
      if (votes[i][0] === name){
        return i;
      }
  }
  return -1;
}

let commandSender = function(){
  io.emit('chat message', "NEXT MOVEMENT: " + cmd);
  sendCommandToMicroscope(cmd);
  cmd = "None";
}

let resetCTRLTimer = function(time){
  clearInterval(timer1);
  timer1 = setInterval(function(){controllerFunction()}, time);
}

let resetCMDTimer = function(time){
  clearInterval(timer2);
  timer2 = setInterval(function(){commandSender()}, time);
}

let timer1 = setInterval(function(){controllerFunction()}, 5000);
let timer2 = setInterval(function(){commandSender()}, 5000);
clearInterval(timer2);

io.on('connection', function(socket){
  let tempName = availableNames.pop();
  clients.push(tempName);

  userVote = [tempName, '', 0];
  votes.push(userVote)

  console.log(tempName + ' has connected.');
  updateClients();
  socket.broadcast.emit('chat message', tempName + " has connected.");
  socket.emit('name update', tempName);
  socket.emit('chat message', "You are " + tempName + ".");
  socket.emit('userInControl update', userInControl)
  socket.emit('mode update', currentMode);
  socket.emit('admin update', administrator);

  socket.on('disconnect', function(){
    console.log(tempName + ' has disconnected.');
    clients.splice(clients.indexOf(tempName), 1);
    index = findIndex(votes, tempName);
    if (findIndex != -1){
      votes.splice(index, 1);
    }
    else {
      console.log("FindIndex Error: Disconnect");
    }

    updateClients();
    socket.broadcast.emit('chat message', tempName + " has disconnected.");
    if (defaultNames.includes(tempName)){
      availableNames.push(tempName);
    }

    if (administrator === tempName){
      administrator = '';
      socket.broadcast.emit('chat message', "The admin has disconnected.");
      socket.broadcast.emit('admin update', "");
    }

    if (tempName === userInControl){
      userInControl = '';
      io.emit('userInControl update', userInControl);

      socket.broadcast.emit('chat message', "User in control has disconnected.");
    }

  });

  socket.on('buttonClick', function(msg){
    if (msg != 'sendButton'){
      console.log(tempName + ' has clicked: ' + msg);
      if(availableModes.includes(msg)){
        console.log("Mode change initiated. New Mode: " + msg);
        io.emit('chat message', "MODE CHANGE INITIATED. NEW MODE: " + msg);

        if ((currentMode == "volunteerForUser") && (msg != "volunteerForUser")){
          io.emit('volunteer mode off');
        }

        currentMode = msg;
        io.emit('mode update', currentMode);
        if (currentMode == "adminMode"){
          clearInterval(timer2);
          userInControl = administrator;
          io.emit('userInControl update', userInControl);
          resetCTRLTimer(5000);
          console.log("Reset the timer for adminMode.");
        }

        else if (currentMode == "voteForUser"){
          // userInControl = administrator;
          resetCTRLTimer(36000);
          resetCMDTimer(5000);
          console.log("Reset the timer for voteForUser Mode");
        }

        else if (currentMode == "voteForMovement"){
          io.emit('userInControl update', "");
          clearInterval(timer2);
          resetCTRLTimer(10000);
          console.log("Reset the timer for voteForMovement");
        }

        else if (currentMode == "volunteerForUser"){
          io.emit('volunteer mode');
          clearInterval(timer2);
          resetCTRLTimer(36000);
          resetCMDTimer(5000);
          console.log("Reset the timers for volunteerForUser");
        }
      }
      else {
        index = findIndex(votes, tempName);
        if (findIndex != -1){
          if (currentMode == "voteForUser"){
            if (clients.includes(msg)){
              votes[index][1] = msg;
            }
            else {
              if (tempName === userInControl){
                cmd = msg;
              }
              else {
                socket.emit('chat message', "You're not in control. Vote for someone.");
              }
            }
          }

          else if (currentMode == "volunteerForUser"){
            if (msg == "Yes" || msg == "No"){
              votes[index][1] = msg;
            }
            else if (clients.includes(msg)) {
              socket.emit('chat message', "You cannot vote for users in this mode.");
            }
            else {
              if (tempName === userInControl){
                cmd = msg;
              }
              else {
                socket.emit('chat message', "You're not in control. Click the checkbox if you want control.");
              }
            }
          }

          else if (currentMode == "voteForMovement"){
            if (clients.includes(msg)){
              socket.emit('chat message', "You cannot vote for users in voteForMovement mode.");
            }
            else {
              votes[index][1] = msg;
            }

          }

          else {
            if (clients.includes(msg)){
              socket.emit('chat message', "You cannot vote for users in adminMode.");
            }
            else {
              votes[index][1] = msg;
            }
          }

        }
      }
    }

  });

  socket.on('testMovement', function(){
    console.log("Sending test movement: ZoomIn");
    io.emit('chat message', "ZoomIn in progress.");
    sendCommandToMicroscope("ZoomIn");
  });

  socket.on('latencyTestResult', function(msg){
    console.log("Results from the latency test: " + msg);
    msg = msg/1000;
    io.emit('chat message', "Result from the latency test: " + msg + " seconds. Allow for a reasonable amount of time to pass before sending commands to the microscope.");
  });

  socket.on('Dummy', function(){
    socket.emit('DummyACK');
    // console.log('Dummy');
  });

  socket.on('chat message', function(msg){

    if(msg.split(' ')[0].toLowerCase() === '/nick'){
      desiredName = msg.split(' ')[1];

      if(!(clients.includes(desiredName))){
        console.log("Name is available.");
        if (defaultNames.includes(tempName)){
          if(!(availableNames.includes(tempName))){
            availableNames.push(tempName);
          }
        }
        console.log("Changing Nickname.");
        clients.splice(clients.indexOf(tempName), 1);
        clients.push(desiredName);
        index = findIndex(votes, tempName);
        if (findIndex != -1){
          votes[index][0] = desiredName;
        }
        else {
          console.log("FindIndex Error: nickname");
        }
        socket.broadcast.emit('chat message', tempName + " has changed their username to " + desiredName);
        socket.emit('name update', desiredName);
        if (administrator == tempName){
          administrator = desiredName;
          io.emit('admin update', administrator);
        }
        if (tempName == userInControl){
          userInControl = desiredName;
          io.emit('userInControl update', userInControl);
        }
        tempName = desiredName;
        socket.emit('chat message', "Your name has been changed to " + tempName);
        updateClients();
      }
      // the nickname is already in use
      else {
        socket.emit('chat message', "The name that you have requested is unavailable.");
      }
    }

    else if (msg.split(' ')[0].toLowerCase() === '/admin') {
      if (administrator === ''){
        console.log(tempName + " has become the admin.");
        socket.emit('chat message', "You are now the administrator.")
        io.emit('admin update', tempName);
        socket.emit('admin enable');
        socket.broadcast.emit('chat message', tempName + " has become the administrator.");
        administrator = tempName;
        userInControl = administrator;
        io.emit('userInControl update', userInControl);
        currentMode = "adminMode";
        io.emit('mode update', currentMode);
      }
      else {
        console.log(tempName + " has attempted to become the admin.");
        socket.emit('chat message', administrator + " is already the administrator.");
      }
    }

    else if (msg.split(' ')[0].toLowerCase() === '/grantcontrol'){
      if (tempName == administrator){
        if (clients.includes(msg.split(' ')[1])){
          userInControl = msg.split(' ')[1];
          io.emit('userInControl update', userInControl);
          socket.broadcast.emit('chat message', userInControl + " was granted control.");
          console.log(userInControl + " is now in control.");
        }
      }
      else {
        socket.emit('chat message', "You are not the administrator.");
      }
    }

    else {
      console.log(tempName + ' has sent: ' + msg);
      socket.broadcast.emit('chat message', '[' + tempName + ']: ' + msg);
    }

  });

});

 const comPort = 'COM4'; // Replace with the COM port the microscope is connected to on your PC
 const SerialPort = require('serialport');
 //const app = require('express')();
 var bodyParser = require('body-parser');
 let microscopeInitialized = 0;
 let microscopeSteps = 1000;
 let microscopeDelay = 1000;
 var motorStatus = { X: 0, Y: 0, Z: 0 };
 var motorPosition = { X: 0, Y: 0, Z: 0 };
 app.use(bodyParser.json()); // for parsing application/json
 app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

 SerialPort.list((ports) => {
     console.log(ports);
 })

 const mySerialPort = new SerialPort(comPort, {
     baudRate: 57600
 });

 mySerialPort.on('error', function (err) {
     console.log("Serial port error!")
     console.error(err.message);
     // port.close();
 })

 // The open event is always emitted
 mySerialPort.on('open', function () {
     console.log('Port Opened, ready to send commands to microscope');
     microscopeInitialized = 1;
 });

 const Delimiter = SerialPort.parsers.Delimiter;
 const parser = mySerialPort.pipe(new Delimiter({ delimiter: '#' }));

 // Read data that is available but keep the stream from entering "flowing mode"

 parser.on('data', function (data) {
     const obj = JSON.parse(data.toString());
     if (Object.prototype.hasOwnProperty.call(obj, 'status')) {
         motorStatus = obj.status;
     }
     if (Object.prototype.hasOwnProperty.call(obj, 'position')) {
         motorPosition = obj.position;
     }
     return 1;
 });


 let sendCommandToMicroscope = function (command) {
     if (!microscopeInitialized) {
         console.log("Tried to send command to microscope, but not initialized!")
         return;
     }
     if (command == "ZoomIn") { //use neg microscopeSteps
         mySerialPort.write("  Z," + microscopeSteps + "," + microscopeDelay + "#");
     }
     else if (command == "ZoomOut") {
         mySerialPort.write("  Z,-" + microscopeSteps + "," + microscopeDelay + "#");
     }
     else {
         return; //command was for direction, we cant do that on our scope
     }
 }

 const NodeMediaServer = require('node-media-server');
 
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 60,
    ping_timeout: 30
  },
  http: {
    //port: 3000,
    allow_origin: '*'
  }
};

var nms = new NodeMediaServer(config)
nms.run();

function streaming() {
		
		const p = new Promise((resolve, reject) => {

        const ffmpeg = spawn('ffmpeg', ['-f', 'dshow', '-re', '-i', 'video=SCMOS01300KPA:audio=Microphone (High Definition Audio Device)', '-c:v', 'libx264', '-vf', 'fps=15', '-vsync', '0', '-b:v', '5000k', '-qmin', '10', '-qmax', '42', '-maxrate', '10000k', '-bufsize', '1000k', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-tune', 'zerolatency', '-threads', '8', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-af', 'highpass=f=125, lowpass=f=500', '-f', 'flv', 'rtmp://10.13.148.35/live/stream']);
		
        ffmpeg.stderr.on('data', (data) => {
            console.log(`${data}`);
        });
		
        ffmpeg.on('close', (code) => {
            resolve();
        });
    });
		return p;
}

streaming();

http.listen(3000, function(){
  console.log('listening on *:3000');
});

// integration of the smartstage
  // zoom bar
  // x-y minimap
  // z position
