var liveSource = 'http://192.168.56.101:8081/hls/live.m3u8'

if(Hls.isSupported())
{
  console.log("HLS supported");
  var player = document.getElementById('player')
  var hls = new Hls()
  hls.attachMedia(player)
  hls.loadSource(liveSource)

  hls.on(Hls.Events.ERROR, function (event, data) {
    console.log(data);
    if (data.fatal) {
      switch(data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        // try to recover network error
        console.log("liveStream: fatal network error encountered");//, trying to recover...");
        hls.loadSource(liveSource)
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.log("fatal media error encountered, trying to recover...");
        hls.recoverMediaError();
        break;
      default:
        // cannot recover
        hls.destroy();
        break;
      }
    }
  });

  hls.on(Hls.Events.MANIFEST_PARSED,function(event, data) {
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
  if( selected === "auto") hls.currentLevel = -1;
  else {
    hls.currentLevel = selected;
  }
  console.log(hls.currentLevel);
}
