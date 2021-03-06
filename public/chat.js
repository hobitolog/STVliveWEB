var socket = io();
$(function () {
var user = "";
var role = "";
$('form').submit(function(){
socket.emit('chat message', $('#m').val());
$('#m').val('');
return false;
});
socket.on('chat message', function(message, nick, pic, usrId, time, msgId){
$('#messages').append('<li id="' + msgId + '">'
+'<div class="msg-bg">'
  +'<div class="picSeg">'
  +'<img class="profilePic" src="' + pic + '"> '
  +'</div>'
    +'<div class="msg-txt"'
    +'<p class="nickDate">' + '[' + nick + ']\t' + (role=='a' || role=='m' ? usrId + '\t' : "")+ time + (role=='a' || role=='m' ? '<button type="button" id="delButton" value="' + msgId + '" onclick="delMessage(this.value)" />' : "") +'</p>'
    + "<p>" + message + '</p>'
    +'</div>'
+ '</div>'
+ '</li>');
$('#messages').animate({scrollTop: $('#messages').prop("scrollHeight")}, 500);
});
socket.on('log message', function(message){
$('#messages').append('<li>'
+'<div class="msg-bg">'
    +'<div class="log-txt"'
    + "<p>" + message + '</p>'
    +'</div>'
+'</div>'
+'</li>');
$('#messages').animate({scrollTop: $('#messages').prop("scrollHeight")}, 500);
});
socket.on('statusChange', function(id) {
  socket.emit('statusChange', id);
});

socket.on('setUser', function(userId, r) {
  user = userId;
  role = r;
});

socket.on('delMessage', function(msgId) {
  var elem = document.getElementById(msgId);
  elem.parentNode.removeChild(elem);
})

socket.on('chatReset', function() {
  $('#messages').empty();
})

socket.on('setLogOut', function() {
  document.getElementById('fbLog').href = "/logout";
  document.getElementById('fbButton').value = "Log out!";
})

});

function delMessage(arg) {
  socket.emit('delMessage', arg)
}

function reset() {
  socket.emit('chatReset');
}
function hideChat() {
  var chat = document.getElementById('czat');
  var videoSite = document.getElementById('videoSite');
  var showChat = document.getElementById('showChat');
  chat.style.display = 'none';
  videoSite.style.width = 'calc(100% - 30px)';
  showChat.style.display = 'block';
}

function showChat() {
  var chat = document.getElementById('czat');
  var videoSite = document.getElementById('videoSite');
  var showChat = document.getElementById('showChat');
  chat.style.display = 'block';
  videoSite.style.width = 'calc(100% - 300px)';
  showChat.style.display = 'none';
}
