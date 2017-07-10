## Czat
W pierwszym wydaniu czatu mamy 2 okienka do wprowadzania danych. Pierwsze to pole na nick, drugie na wiadomość. Wiadomości wysyłamy zatwierdzająć wiadomość enterem lub klikając przycisko "send".

# Wymagania
-nodejs i npm
```
sudo apt-get install nodejs
sudo apt-get install npm
```

- moduły express oraz socket.io do node'a
```
sudo npm install --save express
sudo npm install --save socket.io
```

# Wyjaśnienie kodu
- Sekcja odpowiedzialna za import modułów oraz powiązania między ich instancjami.
```
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
```

- Na zapytanie get bez zdefiniowanego kontentu zwracamy stronę opisaną w pliku index.html
```
app.get('/', function(req, res){
res.sendFile(__dirname + '/public/index.html');
});
```
Gdzie `__dirname` zawiera ścieżkę do folderu z plikiem index.js.

- Sekcja odpowiedzialna za połączenie z czatem
```
io.on('connection', function(socket){
socket.on('chat message', function(message, nick){
	io.emit('chat message', message, nick);
	});
});
```
Po połączeniu się klienta z serwerem gdy serwer otrzyma wiadomość od klienta(zakodowaną jako event 'chat message' z argumentami message(wiadomość pobrana z pola wiadomości) i nick rozsyła event do wszystkich połączonych klientów, a Ci ją wyświetlają wraz z podanym autorem.


- Sekcja `<script>` w pliku index html zawiera obsługę wydarzeń emitowanych przez serwer oraz emituje wydarzenia przekazywane później na serwer.

```
$('form').submit(function(){
socket.emit('chat message', $('#m').val(), $('nick').val());
$('#m').val('');
return false;
```
Po zatwierdzeniu wiadomości generowane jest wydarzenie `'chat message'` z argumentami pobranymi z pól wiadomości oraz nicku opisanymi wcześniej. Po wysłaniu wiadomości zawartość pola wiadomości jest usuwana.

Dalsza część reaguje na wydarzenie wygenerowane przez serwer i wyświetla przekazane w nim argumenty.
