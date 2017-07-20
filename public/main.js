var liveSource = 'http://192.168.56.101:8081/hlsOnline/live.m3u8'
var offlineSource = 'http://192.168.56.101:8081/hlsOffline/live.m3u8'
var sources = {
  OFFLINE: 0,
  ONLINE: 1,
};
var player = document.getElementById('player')

function checkOnline() {
  if( nowPlaying === sources.OFFLINE )
  {
    hlsOnline.loadSource(liveSource)
  }
}


if(Hls.isSupported())
{
  console.log("HLS supported");
  var hlsOnline = new Hls()
  var hlsOffline = new Hls()
  var nowPlaying = sources.ONLINE
  hlsOnline.loadSource(liveSource)
  var onlineChecker = setInterval( function(){ checkOnline() }, 10000)
}

function switchToOffline() {
  if (nowPlaying === sources.ONLINE) {
    hlsOnline.detachMedia();
    hlsOffline = new Hls()
    hlsOffline.loadSource(offlineSource);
    hlsOffline.attachMedia(player)
    nowPlaying = sources.OFFLINE

    hlsOffline.on(Hls.Events.MANIFEST_PARSED,function(event, data) {
      player.play();
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
  player.play();
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
