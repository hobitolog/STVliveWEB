var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');

var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');

var User = require('./app/models/user');

//Zmienne
var streamNumber = Number(fs.readFileSync('stream_number'));
usersMap = new Map();

var configDB = require('./config/database.js');
mongoose.connect(configDB.url);
require('./config/passport')(passport);


function getLogFileName() {
var date = new Date();
var fileDate = date.getFullYear() + (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1) + (date.getDate() < 10 ? "0" : "") + date.getDate();
return fileDate + "_" + streamNumber;
}


//Podgląd i sesja
app.use(morgan('dev'));
app.use(cookieParser());
app.use(session({secret: 'sesjowy sekrecik :3',
		  saveUninitialized: true,
		  resave: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


app.get('/', function(req, res){
res.sendFile(__dirname + '/public/index.html');

if(req.isAuthenticated()){
// Sprawdzanie czy użytkownik jest zalogowany i dopisywanie go do aktywnych socketów
usersMap.set(req.cookies.io, req.session.passport.user);
} else {
//Jeśli nie jest zalogowany to wpisz, że się jest nieautoryzowany
usersMap.set(req.cookies.io, 'unauthorized');
}
});


io.on('connection', function(socket){
var start = socket.handshake.headers.cookie.indexOf('io=');
var socketIo = socket.handshake.headers.cookie.substring(start + 3, start + 23);

var name ="";
//wypisanie historii czatu
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
		msg="";
		for(i=0; i<logs.length; i++) {
		if(logs[i] == null || logs[i] == "")
			break;
		socket.emit('log message', logs[i]);
		logs[i]="";
		}}
		});

if(usersMap.get(socketIo)=='unauthorized')
	name='unauthorized';
else{
User.findOne({'_id' : usersMap.get(socketIo) }, function(err, user) {
if(err) {
//Jesli coś pójdzie nie tak, to użytkownik nie przejdzie autoryzacji
	name = "unauthorized";
	return done(err);
}
	//Jeśli się znalazł to będzie ok
if(user) {
	//user.facebook.photo	= profile.photos[0].value; //Na razie bez zdjęcia
	name = user.facebook.name;
	}});
}

socket.on('chat message', function(message){

	var reg = /^[\s\t]*$/;
	if(reg.test(message))
		socket.emit('log message', 'Your message was empty!');
	else if(name=="unauthorized" || name=="") {
		socket.emit('log message', 'Log in with facebook to send a message!');
	}
	else
	{
		var date = new Date();
		var nickTime = date.toLocaleTimeString() + "\t[" + name + "]";
	 
		io.emit('chat message', message, nickTime);
		fs.appendFile('./logs/' + getLogFileName(), nickTime + ":\t" + message + "\n", function(err) {
			if(err) throw err;
			});
	}
	});
		socket.on('disconnect', function(socket) {
	usersMap.delete(socketIo);
		}); //Sprzątanie
	});


app.get('/auth/facebook', passport.authenticate('facebook', {'scope': ['email', 'user_photos']}));

app.get('/auth/facebook/callback', 
	passport.authenticate('facebook', 
		{ successRedirect: '/',
		  failitureRedirect: '/'}));

http.listen(3000, function(){
console.log('listening on *:3000');
});

