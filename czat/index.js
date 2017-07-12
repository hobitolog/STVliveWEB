var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var streamNumber = Number(fs.readFileSync('stream_number'));

function getLogFileName() {
var date = new Date();
var fileDate = date.getFullYear() + (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1) + (date.getDate() < 10 ? "0" : "") + date.getDate();
return fileDate + "_" + streamNumber;
}

app.get('/', function(req, res){
res.sendFile(__dirname + '/public/index.html');
io.on('connection', function(socket){
	fs.readFile('./logs/' + getLogFileName(), 'utf8', function(err, msg){
	if(err) {
		if(err.code === "ENOENT") {
		//File does not exist, so you don`t have to do anything
		return;
		}
		else
		throw err;
		}
		else {
		var logs = msg.split("\n");
		for(i=0; i<msg.length; i++) {
		if(logs[i] == null || logs[i] == "")
			break;
		socket.emit('log message', logs[i]);
		}}

		});
	});
});

io.on('connection', function(socket){
socket.on('chat message', function(message, nick){
	var reg = /^[\s\t]*$/;
	if(reg.test(message))
		socket.emit('log message', 'Your message was empty!');
	else
	{
		var date = new Date();
		var hour = date.getHours();
		hour = (hour < 10 ? "0" : "") + hour;
	
		var min = date.getMinutes();
		min = (min < 10 ? "0" : "") + min;
	
		var sec = date. getSeconds();
		sec = (sec <10 ? "0" : "") + sec;
		
		var chatDate = hour + ":" + min + ":" + sec;
		var nickTime = chatDate + "\t[" + nick + "]";
	 
		io.emit('chat message', message, nickTime);
		fs.appendFile('./logs/' + getLogFileName(), nickTime + ":\t" + message + "\n", function(err) {
			if(err) throw err;
			});
	}
	});
});


http.listen(3000, function(){
console.log('listening on *:3000');
});

