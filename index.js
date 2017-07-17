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
var app = express()

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
              nginxConf.write(' -vf scale=')
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
              nginxConf.write(' -vf scale=')
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
  var checked = quality.selected ? '" checked>' : '">'

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
  if(fileList.length > 0 && settings.qualities.filter(x => x.selectedOffline).length > 0)
  {
    var f = fileList.shift()
    fileList.push(f)
    var fpath = path.join(__dirname, '/videos', f)
    console.log('Now playing: ' + f);
    var cmd = 'ffmpeg -re -i ' + fpath + ' -c copy -f flv rtmp://localhost:1935/offline/' + offlineStreamKey
    exec(cmd, function(e, stdout, stderr){
      if (e instanceof Error) {
          console.error(e);
        }
        playOfflineFile()
    })
  }
  else {
    console.log(fileList);
    console.log(settings.qualities.filter(x => x.selectedOffline));
    console.log('[WARN] No offline files to play or no qualities specified.');
  }
}

// serve index.html
app.get('/', function (req, res) {
  //TODO: chat
  res.sendFile(path.join(__dirname, '/html', '/index.html'))
})

// serve admin panel
app.get('/admin', function (req, res){
  if (topSecretAuth(req))
  {
    fs.readFile(path.join(__dirname, '/html', '/admin.html'),'utf8', function (err, html) {
        var $ = cheerio.load(html)

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
      playOfflineFile()
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
    playOfflineFile()
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

// load settings
loadSettings()
//generate new random streamKey for offline files
var offlineStreamKey = crypto.randomBytes(20).toString('hex')
//load list of offline files
loadOfflineFiles()
//start server
var server = app.listen(80, function () {
  var host = server.address().address
  var port = server.address().port

  console.log("Serwer OK, adres: http://%s:%s", host, port)

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
