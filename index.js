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
var app = express()

// saves settings to settings.json
// if  reloadNginx=true => applies settings to nginx.conf
function saveConfig( reloadNginx )
{
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
      if(line === "#FFMPEG_END" || line === "#HLS_VARIANT_END")
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
              nginxConf.write('rtmp://localhost:1935/hls/live_')
              nginxConf.write(q.name)
          }
        }
        nginxConf.write(' name=')
        nginxConf.write(settings.streamKey)
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
            nginxConf.write(';\n')
          }
        }
        copy = false
      }

    });

    exec(path.join(settings.nginxPath, '/sbin/nginx -s reload'), function(e, stdout, stderr) {
      if (e instanceof Error) {
          console.error(e);
          //throw e;
      }
      console.log("Nginx.conf reloaded")
     })
  }
}


// loads settings from settings.json file
function loadSettings()
{
  var contents = fs.readFileSync('settings.json', 'utf8')
  settings = JSON.parse(contents)
}

function topSecretAuth(req) {
  var login = auth(req)
  if (!login || login.name !== settings.login.name || login.pass !== settings.login.pass)
  {
     return false
  }
  else return true
}

function getCheckBoxCode(quality) {
  var part1 = '<input type="checkbox" name="quality" value="'
  var checked = quality.selected ? '" checked>' : '">'

  var xd = '<input type="text" name="bitrate_video_' + quality.name + '" value="'

  return part1.concat(quality.name, checked, quality.name, ' - video: ', quality.video.resolution, ', ', quality.video.codec,
  ', bitrate: ', '<input type="text" name="bitrate_video_', quality.name, '" value="', quality.video.bitrate, '">',
  ' audio: ', quality.audio.codec, ', bitrate: ', '<input type="text" name="bitrate_audio_', quality.name, '" value="', quality.audio.bitrate, '">','<br>')
}

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/public', '/index.html'))
})

app.get('/admin', function (req, res)
{
  if (topSecretAuth(req))
  {
    fs.readFile(path.join(__dirname, '/public', '/admin.html'),'utf8', function (err, html) {
        var $ = cheerio.load(html)

        for (var i = 0; i < settings.qualities.length; i++) {
          $('div[id=checkboxes]').append(getCheckBoxCode(settings.qualities[i]))
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

app.post('/saveQualitySettings', function (req, res) {
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
      q = settings.qualities.find(x => x.name === params.quality[i])
      q.selected = true
      var vid = 'bitrate_video_' + q.name
      var aud = 'bitrate_audio_' + q.name
      q.video.bitrate = params[vid]
      q.audio.bitrate = params[aud]
    }
    saveConfig(true)
  });
  res.redirect('/admin')
})

app.post('/resetStreamKey', function (req, res) {

  var newKey = crypto.randomBytes(20).toString('hex')
  settings.streamKey = newKey;
  saveConfig(true)
  res.redirect('/admin')
})

app.post('/changePassword', function (req, res) {
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
})

// load settings and start server
loadSettings()
var server = app.listen(80, function () {
var host = server.address().address
var port = server.address().port

console.log("Serwer OK, adres: http://%s:%s", host, port)

// stop nginx (if it's running)
exec(path.join(settings.nginxPath, '/sbin/nginx -s stop'), function(e, stdout, stderr){})

// start nginx
exec(path.join(settings.nginxPath, '/sbin/nginx'), function(e, stdout, stderr) {
  if (e instanceof Error) {
      console.error(e);
      throw e;
  }
  console.log("Nginx OK")
})
})
