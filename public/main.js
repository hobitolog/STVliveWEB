var liveSource = 'http://192.168.56.101:8081/hlsOnline/live.m3u8'
var offlineSource = 'http://192.168.56.101:8081/hlsOffline/live.m3u8'

if(Hls.isSupported())
{
  console.log("HLS supported");
  var player = document.getElementById('player')
  var hlsOnline = new Hls()
  hlsOnline.attachMedia(player)
  hlsOnline.loadSource(liveSource)

  hlsOnline.on(Hls.Events.ERROR, function (event, data) {
    console.log(data);
    if (data.fatal) {
      switch(data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        // try to recover network error
        console.log("liveStream: fatal network error encountered");//, trying to recover...");
        hlsOnline.loadSource(liveSource)
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.log("liveStream: fatal media error encountered, trying to recover...");
        hlsOnline.recoverMediaError();
        break;
      default:
        // cannot recover
        hlsOnline.destroy();
        break;
      }
    }
  });

  hlsOnline.on(Hls.Events.MANIFEST_PARSED,function(event, data) {
    player.play();
    for (var i = 0; i < data.levels.length; i++) {
      q = data.levels[i]
      $("#qualitySelect").append('<option value="' + i + '">' + parseInt(q.height) + 'p')
      //q.attrs.RESOLUTION = "1280x720"
    }
});
}

function selectQuality()
{
  var selected = $("#qualitySelect")[0].value
  if( selected === "auto") hlsOnline.currentLevel = -1;
  else {
    hlsOnline.currentLevel = selected;
  }
  console.log(hlsOnline.currentLevel);
}
