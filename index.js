/**
 * Created by Kosert on 2017-07-04.
 */

var express = require('express')
var auth = require('basic-auth')
var path = require('path')
var fs = require('fs')
var cheerio = require('cheerio')
var crypto = require('crypto')
var qs = require('querystring')
var exec = require('child_process').exec
var execSync = require('child_process').execSync
var request = require('request');
var app = express()
var http = require('http').Server(app);

//******Just chat things**********
var io = require('socket.io')(http);

var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');
var emoji = require('emoji-parser');
emoji.init(__dirname + "/emoji").update();
var User = require('./app/models/user');

//Variables
var streamNumber = Number(fs.readFileSync('stream_number'));
usersMap = new Map();
var delay = 0; //Default value of chat message delay = 0
var dailyMessageCounter = 0;
countMessages();
var actualDate = getLogFileName();

var configDB = require('./config/database.js');
mongoose.connect(configDB.url);
require('./config/passport')(passport);

function getLogFileName() {
  var date = new Date();
  var fileDate = date.getFullYear() + (date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1) + (date.getDate() < 10 ? "0" : "") + date.getDate();
  return fileDate + "_" + streamNumber;
}

function countMessages() {
  var logFileName = './logs/' + getLogFileName();
  fs.readFile(logFileName, 'utf8', function(err, msg) {
    if(err) {
      if(err.code === "ENOENT") {
        dailyMessageCounter = 0;
        return;
      } else {
        throw err;
      }
      }	else {
        var logs = msg.split("\n");
        dailyMessageCounter=logs.length;
          }
    });
  }

function delMessage(msgId) {
  var logFileName = './logs/' + getLogFileName();
  fs.readFile(logFileName, 'utf8', function(err, msg) {
    if(err) {
      if(err.code === "ENOENT") {
        //File does not exist, so you don`t have to do anything
        return;
      } else {
        throw err;
      }
      }	else {
        var logs = msg.split("\n");
        for(i=0; i<logs.length; i++) {
          if(logs[i] == null || logs[i] == "")
          break;
          msg = logs[i].split(' ~||~ ');//userId/pic/name/time/messageId/message
          if(msg[4]==msgId) {
            msg[4]='deleted'
            logs[i]=msg.join(' ~||~ ');
            break;
          }

          }
          fs.writeFile(logFileName, logs.join('\n'), function(err) {
            if(err) {
              throw err;
            }
          })
        }
          });
}


function setUserRole(id, role, socket) {
  var reg = /^[amub]$/;
  if(!reg.test(role)) {
    socket.emit('log message', 'Uncorrect role! Tell admin about it!');
  }

  User.findOne({'facebook.id' : id }, function(err, user) {
    if(err) {
      socket.emit('log message', "User not found! It is possible that userId was't correct");
    }
    if(user) {
      user.facebook.role = role;
      user.save(function(err) {
        if(err) {
          socket.emit('log message', "Saving error! Contact administrator!");
        }
        socket.emit('log message', '[' + role + ']' + ' was given to: ' + id);
        io.emit('statusChange', id);
      });
      }
    });
}

function emotRepl(str)
{
  str = str.replace(/\:[\)\]]/g, ':smile:');
  str = str.replace(/\:[\(\[]/g, ':worried');
  str = str.replace(/\:[Dd]/g, ':smiley:');
  str = str.replace(/\:3/g, ':kissing:');
  str = str.replace(/\:\*/g, ":kissing_heart:");
  str = str.replace(/kappa/g, '<img class="emoji" src="/emoji/kappa.png">');
  str = str.replace(/spacjaTV/g, '<img class="logo" src="/emoji/logo.png">');
  str = str.replace(/lenny/g, '( ͡° ͜ʖ ͡°)')
  return str;
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
//********************************************

// make all files in /public/ available globally
app.use('/', express.static(path.join(__dirname, 'public')))

// saves settings to settings.json
// if reloadNginx=true => applies settings to nginx.conf
// if onStart=true => starts playing offline file, default=false
function saveConfig( reloadNginx, onStart) {
  onStart = onStart || false
  var json = JSON.stringify(settings)
  fs.writeFile('settings.json', json, 'utf8', function(err) {
    if(err) console.log(err)
  })

  if( reloadNginx )
  {
    var nginxConf = fs.createWriteStream(path.join(settings.nginxPath, '/conf/nginx.conf'), {'flags': 'w'});
    var lineReader = require('readline').createInterface({
      input: require('fs').createReadStream('nginx.conf')
    });

    var copy = true
    lineReader.on('line', function (line)
    {
      if(line === "#FFMPEG_END" || line === "#FFMPEG_OFFLINE_END" || line === "#HLS_VARIANT_END" || line === "#HLS_OFFLINE_VARIANT_END")
        copy = true

      if(copy) {
        nginxConf.write(line)
        nginxConf.write('\n')
      }

      if(line === "#FFMPEG_BEGIN")
      {
        nginxConf.write('exec ffmpeg -i rtmp://localhost:1935/live/')
        nginxConf.write(settings.streamKey)
        nginxConf.write(' -async 1 -vsync -1 ')

        for (var i = 0; i < settings.qualities.length; i++) {
          var q = settings.qualities[i]
          if(q.selected) {
              nginxConf.write('\n-c:v ')
              nginxConf.write(q.video.codec)
              nginxConf.write(' -aspect 16:9 -vf scale=')
              nginxConf.write(q.video.resolution.replace('x', ':'))
              nginxConf.write(' -b:v ')
              nginxConf.write(q.video.bitrate)
              nginxConf.write(' -c:a ')
              nginxConf.write(q.audio.codec)
              nginxConf.write(' -b:a ')
              nginxConf.write(q.audio.bitrate)
              nginxConf.write(' -tune zerolatency -preset veryfast -f flv ')
              nginxConf.write('rtmp://localhost:1935/hlsOnline/live_')
              nginxConf.write(q.name)
          }
        }
        nginxConf.write(' name=')
        nginxConf.write(settings.streamKey)
        nginxConf.write(';\n')
        copy = false
      }

      if(line === "#FFMPEG_OFFLINE_BEGIN")
      {
        nginxConf.write('exec ffmpeg -i rtmp://localhost:1935/offline/')
        nginxConf.write(offlineStreamKey)
        nginxConf.write(' -async 1 -vsync -1 ')

        for (var i = 0; i < settings.qualities.length; i++) {
          var q = settings.qualities[i]
          if(q.selectedOffline) {
              nginxConf.write('\n-c:v ')
              nginxConf.write(q.video.codec)
              nginxConf.write(' -aspect 16:9 -vf scale=')
              nginxConf.write(q.video.resolution.replace('x', ':'))
              nginxConf.write(' -b:v ')
              nginxConf.write(q.video.bitrate)
              nginxConf.write(' -c:a ')
              nginxConf.write(q.audio.codec)
              nginxConf.write(' -b:a ')
              nginxConf.write(q.audio.bitrate)
              nginxConf.write(' -tune zerolatency -preset veryfast -f flv ')
              nginxConf.write('rtmp://localhost:1935/hlsOffline/live_')
              nginxConf.write(q.name)
          }
        }
        nginxConf.write(' name=')
        nginxConf.write(offlineStreamKey)
        nginxConf.write(';\n')
        copy = false
      }

      if(line === "#HLS_VARIANT_BEGIN")
      {
        for (var i = 0; i < settings.qualities.length; i++) {
          var q = settings.qualities[i]
          if(q.selected) {
            nginxConf.write('hls_variant _')
            nginxConf.write(q.name)
            nginxConf.write(' BANDWIDTH=')
            var totalBitrate = parseInt(q.video.bitrate)*1000 + parseInt(q.audio.bitrate)*1000
            nginxConf.write(totalBitrate.toString())
            nginxConf.write(',RESOLUTION=')
            nginxConf.write(q.video.resolution)
            nginxConf.write(';\n')
          }
        }
        copy = false
      }

      if(line === "#HLS_OFFLINE_VARIANT_BEGIN")
      {
        for (var i = 0; i < settings.qualities.length; i++) {
          var q = settings.qualities[i]
          if(q.selectedOffline) {
            nginxConf.write('hls_variant _')
            nginxConf.write(q.name)
            nginxConf.write(' BANDWIDTH=')
            var totalBitrate = parseInt(q.video.bitrate)*1000 + parseInt(q.audio.bitrate)*1000
            nginxConf.write(totalBitrate.toString())
            nginxConf.write(',RESOLUTION=')
            nginxConf.write(q.video.resolution)
            nginxConf.write(';\n')
          }
        }
        copy = false
      }
    });

    lineReader.on('close', function () {
      try {
            var output = execSync(path.join(settings.nginxPath, '/sbin/nginx -s reload'))
      } catch (e) {
        //console.log(e);
      }
      console.log("Nginx reloaded");
      if (onStart) {
        playOfflineFile()
      }
    })

  }
}

// loads settings from settings.json file
function loadSettings(){
  var contents = fs.readFileSync('settings.json', 'utf8')
  settings = JSON.parse(contents)
}

function loadOfflineFiles() {
  fileList = fs.readdirSync(path.join(__dirname, '/videos'))
}

function topSecretAuth(req) {
  var login = auth(req)
  if (!login || login.name !== settings.login.name || login.pass !== settings.login.pass)
  {
     return false
  }
  else return true
}

// get input checkbox html code for specified quality
function getCheckBoxCode(quality, advanced) {
  var part1 = '<input type="checkbox" name="quality" value="'
  if(advanced)
    var checked = quality.selected ? '" checked>' : '">'
  else
    var checked = quality.selectedOffline ? '" checked>' : '">'

  if(advanced) {
    return part1.concat(quality.name, checked, quality.name, ' - video: ', quality.video.resolution, ', ', quality.video.codec,
    ', bitrate: ', '<input type="text" name="bitrate_video_', quality.name, '" value="', quality.video.bitrate, '">',
    ' audio: ', quality.audio.codec, ', bitrate: ', '<input type="text" name="bitrate_audio_', quality.name, '" value="', quality.audio.bitrate, '">','<br>')
  }
  else {
    return part1.concat(quality.name, checked, quality.name, ' |')
  }
}

function playOfflineFile() {
  if(playOffline)
  {
    if(fileList.length > 0 && settings.qualities.filter(x => x.selectedOffline).length > 0)
    {
      var f = fileList.shift()
      fileList.push(f)
      var fpath = path.join(__dirname, '/videos', f)
      if( fs.existsSync(fpath) )
      {
        console.log('Now playing: ' + f);
        var cmd = 'ffmpeg -re -i ' + fpath + ' -c copy -f flv rtmp://localhost:1935/offline/' + offlineStreamKey
        ffmpegProcess = exec(cmd, function(e, stdout, stderr){
          if (e instanceof Error) {
              console.error(e);
            }
            playOfflineFile()
        })
      }
      else {
        console.log('[WARN] File ' + fpath + ' not found. Offline transmission aborted.');
      }
    }
    else {
      console.log('[WARN] No offline files to play or no qualities specified.');
      console.log('files: ' + fileList);
      console.log('qualities: ' + settings.qualities.filter(x => x.selectedOffline));
    }
  }
  else {
      console.log('[INFO] Playing Offline disabled');
  }
}

function updateLiveStatus() {

  request("http://localhost:8081/stat", function (err, res, body) {
    if(!err)
    {
      var $ = cheerio.load(body,
      {
        xmlMode: true
      })

      if($("application:contains('hlsOnline')").find('stream').length > 0)
      {
          liveStatus = '<p style="color:red;">LIVE - ' + $("application:contains('hlsOnline')").find('nclients').last().text() + ' oglądających</p>'
      }
      else {
        liveStatus = '<p>OFFLINE</p>'
      }
    }
    else {
      console.log(err);
    }
  })
}
// serve index.html
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/html', '/index.html'))
  if(req.isAuthenticated()){
  	// Sprawdzanie czy użytkownik jest zalogowany i dopisywanie go do aktywnych socketów
  	usersMap.set(req.cookies.io, req.session.passport.user);
  	} else {
  		//Jeśli nie jest zalogowany to wpisz, że się jest nieautoryzowany
  		usersMap.set(req.cookies.io, 'unauthorized');
  		}
})

// serve admin panel
app.get('/admin', function (req, res){
  if (topSecretAuth(req))
  {
    fs.readFile(path.join(__dirname, '/html', '/admin.html'),'utf8', function (err, html) {
        var $ = cheerio.load(html)

            var buttonText = playOffline ? "Zatrzymaj transmisję zastępczą" : "Wznów transmisję zastępczą"
            $('button[id=switchPlayingButton]').append(buttonText)

            if (fileList.length == 0) {
               $('ul[id=offlineFiles]').append('Folder /videos jest pusty.')
            } else {
              for (var i = 0; i < fileList.length; i++) {
                $('ul[id=offlineFiles]').append('<li>'.concat(fileList[i], '</li>'))
              }
            }
            for (var i = 0; i < settings.qualities.length; i++) {
              $('div[id=checkboxes]').append(getCheckBoxCode(settings.qualities[i], true))
              $('div[id=offlineCheckboxes]').append(getCheckBoxCode(settings.qualities[i], false))
            }
            $('input[id=sk]').val(settings.streamKey)
            res.send($.html())
        })
  }
  else
  {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
    res.end('Access denied')
  }
})

app.get('/getLiveStatus', function (req, res) {
  res.send(liveStatus)
})

app.post('/saveOfflineSettings', function (req, res) {
  if (topSecretAuth(req))
  {
    var body = '';
    req.on('data', function (data)
    {
       body += data;
    });
    req.on('end', function ()
    {
      var params = qs.parse(body)

      for (var i = 0; i < settings.qualities.length; i++) {
        settings.qualities[i].selectedOffline = false
      }

      for (var i = 0; i < params.quality.length; i++) {
        if(Array.isArray(params.quality))
          var q = settings.qualities.find(x => x.name === params.quality[i])
        else
          var q = settings.qualities.find(x => x.name === params.quality)
        q.selectedOffline = true
      }

      saveConfig(true)
    })
    res.redirect('/admin')
  }
  else
  {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
    res.end('Access denied')
  }
})

app.post('/reloadOfflineFiles', function (req, res) {
  if (topSecretAuth(req))
  {
    loadOfflineFiles()
    res.redirect('/admin')
  }
  else
  {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
    res.end('Access denied')
  }
})

app.post('/switchPlayingOffline', function (req, res) {
  if (topSecretAuth(req))
  {
    if (playOffline === true) {
      playOffline = false
      ffmpegProcess.kill()
    }
    else {
      playOffline = true
      playOfflineFile()
    }
    res.redirect('/admin')
  }
  else
  {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
    res.end('Access denied')
  }
})

app.post('/saveQualitySettings', function (req, res) {
  if (topSecretAuth(req))
  {
    var body = '';
    req.on('data', function (data)
    {
       body += data;
    });
    req.on('end', function ()
    {
      var params = qs.parse(body)

      for (var i = 0; i < settings.qualities.length; i++) {
        settings.qualities[i].selected = false
      }

      for (var i = 0; i < params.quality.length; i++) {
        if(Array.isArray(params.quality))
          var q = settings.qualities.find(x => x.name === params.quality[i])
        else
          var q = settings.qualities.find(x => x.name === params.quality)
        q.selected = true
        var vid = 'bitrate_video_' + q.name
        var aud = 'bitrate_audio_' + q.name
        q.video.bitrate = params[vid]
        q.audio.bitrate = params[aud]
      }
      saveConfig(true)
    })
    res.redirect('/admin')
  }
  else
  {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
    res.end('Access denied')
  }
})

app.post('/resetStreamKey', function (req, res) {
    if (topSecretAuth(req))
    {
      var newKey = crypto.randomBytes(20).toString('hex')
      settings.streamKey = newKey;
      saveConfig(true)
      res.redirect('/admin')
    }
    else {
      res.statusCode = 401
      res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
      res.end('Access denied')
    }
})

app.post('/changePassword', function (req, res) {
  if (topSecretAuth(req))
  {
    var body = '';
    req.on('data', function (data)
    {
       body += data;
    });
    req.on('end', function ()
    {
      var params = qs.parse(body)
      settings.login.pass = params.pass
      saveConfig(false)
    });
    res.redirect('/admin')
  }
  else {
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="admin"')
    res.end('Access denied')
  }
})
//*************************************************************
app.get('/auth/facebook', passport.authenticate('facebook', {'scope': ['email', 'user_photos']}));

app.get('/auth/facebook/callback',
	passport.authenticate('facebook',
		{ successRedirect: '/',
		  failitureRedirect: '/'}));

app.get('/emoji/:name', function (req, res) {
  res.sendFile(path.join(__dirname, '/emoji', req.params.name))
})

io.on('connection', function(socket) {
  var start = socket.handshake.headers.cookie.indexOf('io=');
  var socketIo = socket.handshake.headers.cookie.substring(start + 3, start + 23);

  var name = "";
  var pic = "";
  var userId = "";
  var role = "";
  //wypisanie historii czatu
	fs.readFile('./logs/' + getLogFileName(), 'utf8', function(err, msg) {
    if(err) {
      if(err.code === "ENOENT") {
        //File does not exist, so you don`t have to do anything
        return;
      } else {
        throw err;
      }
      }	else {
        var logs = msg.split("\n");
        msg="";
        for(i=0; i<logs.length; i++) {
          if(logs[i] == null || logs[i] == "")
          break;
          msg = logs[i].split(' ~||~ ');//userId/pic/name/time/messageId/message
          if(msg[4]=='deleted') {
            continue;
          }
          socket.emit('chat message', msg[5], msg[2], msg[1], msg[0], msg[3], msg[4]); //message, nick, pic, usrId, time
          logs[i]="";
          }}
          });
  if(usersMap.get(socketIo)=='unauthorized') {
    name='unauthorized';
  } else {
    User.findOne({'_id' : usersMap.get(socketIo) }, function(err, user) {
      if(err) {
        //Jesli coś pójdzie nie tak, to użytkownik nie przejdzie autoryzacji
        name = "unauthorized";
        return done(err);
        }
        //Jeśli się znalazł to będzie ok
      if(user) {
        name = user.facebook.name;
        pic = user.facebook.photo;
        userId = user.facebook.id;
        role = user.facebook.role;
        socket.emit('setUser', userId, role);
        }
      });
      }

      socket.on('chat message', function(message){
        var reg = /^[\s\t]*$/;
        var commandRegex = /^(\#[a-zA-Z]+)\ ([0-9]+)$/; //Regex for #command [number]
        if(name=="unauthorized" || name=="") {
          socket.emit('log message', 'Log in with facebook to send a message!');
        } else if(role=='b') {
          socket.emit('log message', 'You are banned! If you want to change it, contact administator.');
        } else if(reg.test(message)) {
          socket.emit('log message', 'Your message was empty!');
        }	else if (/^\#chatReset$/.test(message)) {
          if(role!='a') {
              socket.emit('log message', 'U have no right to do this! Only admin can reset chat!');
          } else {
            io.emit('chatReset');
            if(streamNumber<999) {
              streamNumber++;
            } else {
              streamNumber=0;
            }
            fs.writeFile('stream_number', streamNumber, function(err) {
              if(err) {
                throw err;
              }
            })
          }
        } else if(commandRegex.test(message)) {
          regexParts = commandRegex.exec(message); //[0] = whole match, [1] = command, [2] = userId/time/messageId
          switch (regexParts[1]) {
            case '#ban':
              if(role!='a' && role!='m') {
                socket.emit('log message', 'U have not right to do this!');
              } else {
                setUserRole(regexParts[2], 'b')
              }
              break;
            case '#unban':
            if(role!='a' && role!='m') {
              socket.emit('log message', 'U have not right to do this!');
            } else {
              setUserRole(regexParts[2], 'u');
            }
              break;
            case '#setDelay':
              if(role!='a' && role!='m') {
                socket.emit('log message', 'U have not right to do this!');
              } else if(regexParts[2] > 5 || regexParts[2] < 0) {
                socket.emit('log message', "Delay value isn't correct! Choose number 0-5!");
              } else {
                delay = regexParts[2];
                socket.emit('log message', 'Delay value set to: ' + regexParts[2]);
              }
              break;
            case '#makeMod':
            if(role!='a') {
              socket.emit('log message', 'U have no right to do this! Only admin can give mod role!');
            } else {
              setUserRole(regexParts[2], 'm', socket);
            }
              break;
            case '#takeMod':
            if(role!='a') {
                socket.emit('log message', 'U have no right to do this! Only admin can take mod role!');
            } else {
              setUserRole(regexParts[2], 'u');
            }
              break;
            default:
            if(role=='u' || role =='b') {
              socket.emit('log message', "You can't use server commands!");
            } else {
              var help = 'Uncorrect command! Choose between:\n';
              if(role=='a') {
                help += '#makeMod/#takeMod [userId] '
                + '#ban/#unban [userId] '
                + '#chatReset [randomNumbers]';
              } else {
                help += 'ban/unban [userId]';
              }
              socket.emit('log message', help);
            }

          }
        } else {
          var date = new Date();
          if(actualDate!=getLogFileName()){
            actualDate=getLogFileName();
            dailyMessageCounter=0;
          }
          var messageId = 'm' + dailyMessageCounter;
          dailyMessageCounter++;

          message = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          message = emotRepl(message);
          message = emoji.parse(message, "/emoji");
          setTimeout(function() {
            io.emit('chat message', message, name, pic, userId, date.toLocaleTimeString(), messageId);
          }, delay*1000);
          fs.appendFile('./logs/' + getLogFileName(), userId + ' ~||~ ' + pic + ' ~||~ '+ name + " ~||~ " + date.toLocaleTimeString() + " ~||~ " + messageId + " ~||~ " + message + "\n", function(err) {
          if(err)
            throw err;
          });
          }
          });

      socket.on('statusChange', function(id) {
        if(id==userId) {
          User.findOne({'facebook.id' : id }, function(err, user) {
            if(err) {
              return done(err);
              }
            if(user) {
              role = user.facebook.role;
              socket.emit('setUser', userId, role);
              }
            });
        }
      });

      socket.on('delMessage', function(delMessageId) {
        delMessage(delMessageId);
        io.emit('delMessage', delMessageId);
      })


		  socket.on('disconnect', function(socket) {
        usersMap.delete(socketIo);
        });
        });
//*************************************************************

// load settings
loadSettings()
//generate new random streamKey for offline files
var offlineStreamKey = crypto.randomBytes(20).toString('hex')
//load list of offline files
loadOfflineFiles()
var playOffline = true
//start server
http.listen(80, function () {
  console.log("Serwer OK")

  liveStatus = ""
  setInterval( updateLiveStatus , 5000)

  // if nginx is running
  if(fs.existsSync(path.join(settings.nginxPath, '/logs/nginx.pid')))
  {
    console.log("Nginx already running");
    //save settings from JSON to nginx.conf
    saveConfig(true, true)
  }
  else
  {
    // start nginx
    exec(path.join(settings.nginxPath, '/sbin/nginx'), function(e, stdout, stderr) {
      if (e instanceof Error) {
          console.error(e);
      }
      console.log("Nginx OK")
      //save settings from JSON to nginx.conf
      saveConfig(true, true)
    })
  }
})
