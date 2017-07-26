var liveSource = 'http://192.168.56.101:8081/hlsOnline/live.m3u8'
var offlineSource = 'http://192.168.56.101:8081/hlsOffline/live.m3u8'
var sources = {
  OFFLINE: 0,
  ONLINE: 1,
};
var player = document.getElementById('player')

if(Hls.isSupported())
{
  console.log("HLS supported");
  var hlsOnline = new Hls()
  var hlsOffline = new Hls()
  var nowPlaying = sources.ONLINE
  hlsOnline.loadSource(liveSource)
  $.get("/getLiveStatus", function(data, status) {
    $('#liveStatus').empty()
    if (status === 'success') {
      $('#liveStatus').append(data)
    }
  })
}

function switchToOffline() {
  if (nowPlaying === sources.ONLINE) {
    hlsOnline.detachMedia();
    hlsOffline = new Hls()
    hlsOffline.loadSource(offlineSource);
    hlsOffline.attachMedia(player)
    nowPlaying = sources.OFFLINE

    hlsOffline.on(Hls.Events.MANIFEST_PARSED,function(event, data) {
      $("#qualitySelect").empty()
      $("#qualitySelect").append('<option value="auto">Auto</option>')
      for (var i = 0; i < data.levels.length; i++) {
        q = data.levels[i]
        $("#qualitySelect").append('<option value="' + i + '">' + parseInt(q.height) + 'p')
        //q.attrs.RESOLUTION = "1280x720"
      }
    });

    hlsOffline.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        switch(data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.log("offStream: fatal network error encountered, trying to recover...");
          hlsOffline.loadSource(offlineSource)
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.log("offStream: fatal media error encountered, trying to recover...");
          hlsOffline.recoverMediaError();
          break;
        default:
          hlsOffline.destroy();
          break;
        }
      }
    });
  }
}

function switchToOnline() {
  hlsOffline.detachMedia();
  hlsOffline.destroy();
  hlsOnline.attachMedia(player)
  nowPlaying = sources.ONLINE
}

hlsOnline.on(Hls.Events.MANIFEST_PARSED,function(event, data) {
  switchToOnline();
  $("#qualitySelect").empty()
  $("#qualitySelect").append('<option value="auto">Auto</option>')
  for (var i = 0; i < data.levels.length; i++) {
    q = data.levels[i]
    $("#qualitySelect").append('<option value="' + i + '">' + parseInt(q.height) + 'p')
    //q.attrs.RESOLUTION = "1280x720"
  }
});

hlsOnline.on(Hls.Events.ERROR, function (event, data) {
  console.log(data);
  if (data.fatal) {
    switch(data.type) {
    case Hls.ErrorTypes.NETWORK_ERROR:
      console.log("liveStream: fatal network error encountered, switching to offline");
      switchToOffline();
      break;
    case Hls.ErrorTypes.MEDIA_ERROR:
      console.log("liveStream: fatal media error encountered, trying to recover...");
      hlsOnline.recoverMediaError();
      break;
    default:
      hlsOnline.destroy();
      break;
    }
  }
  else {
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      console.log("liveStream: network error encountered, switching to offline");
      switchToOffline();
    }
  }
});

function selectQuality()
{
  var selected = $("#qualitySelect")[0].value
  if( selected === "auto")
  {
    if(nowPlaying === sources.ONLINE)
    {
      hlsOnline.currentLevel = -1;
    }
    else {
      hlsOffline.currentLevel = -1;
    }
  }
  else {
    if(nowPlaying === sources.ONLINE)
    {
      hlsOnline.currentLevel = selected;
    }
    else {
      hlsOffline.currentLevel = selected;
    }
  }
}

function getLiveStatus() {
  $.get("/getLiveStatus", function(data, status) {
    $('#liveStatus').empty()
    if (status === 'success') {
      $('#liveStatus').append(data)
    }
  })
  if( nowPlaying === sources.OFFLINE )
  {
    hlsOnline.loadSource(liveSource)
  }
}
setInterval( getLiveStatus, 10000)

//********** PLAYER

player.onplay = function() {
    $('#playPause')[0].src = 'player/pause.png'
    $('#playerControls')[0].style.visibility = 'visible'
};

player.onpause = function() {
    $('#playPause')[0].src = 'player/play.png'
};

function togglePlay() {
  if (player.paused) {
    player.play()
  }
  else {
    player.pause()
  }
}

function toggleMute() {
  player.muted = !player.muted
  if(player.muted)
  {
    $('#sound')[0].src = 'player/muted.png'
  }
  else {
    $('#sound')[0].src = 'player/sound.png'
  }
}

function volumeChange() {
  player.volume = $('#volume')[0].value/100
}


function toggleFullScreen() {
  console.log('toggle');
  if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)
  {
    if (document.exitFullscreen) {
    	document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
    	document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
    	document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
    	document.msExitFullscreen();
    }
  }
  else {
    var video = $('#videoContainer')[0]
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.mozRequestFullScreen) {
      video.mozRequestFullScreen(); // Firefox
    } else if (video.webkitRequestFullscreen) {
      video.webkitRequestFullscreen(); // Chrome and Safari
    }
  }



}
//TODO: cursor: none
// działa na IE
// nie działa na Chrome
// nie testowane na Firefoxie
$(function () {
    var timer;
    var fadeInBuffer = false;
    $(document).mousemove(function () {
      if ($('#videoContainer').is(':hover')) {
        if (!fadeInBuffer) {
            if (timer) {
                clearTimeout(timer);
                timer = 0;
            }

            $('html').css({ cursor: ''  });
        } else {
            $('#videoContainer').css("cursor", 'default');
            $('#playerControls').css("opacity",".9")
            fadeInBuffer = false;
        }

        timer = setTimeout(function () {
            $('#videoContainer').css("cursor", 'none');
            $('#playerControls').css("opacity","0")

            fadeInBuffer = true;
        }, 1000)
      }
    });
    $('#videoContainer').css("cursor", 'default');
});
