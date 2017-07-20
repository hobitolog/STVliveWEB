## Czat
Aby wysłać wiadomość należy zalogować się przyciskiem "Log in with facebook". Jeśli ktoś tego wcześniej nie robił zostanie poproszony o nadanie uprawnień aplikacji do pobrania podstawowych danych, emaila oraz zdjęcia profilowego. Po zalogowaniu piszemy jako osoba([Imię Nazwisko]), która się zalogowała. Wpisaną wiadomość należy zatwierdzić enterem, lub przyciskiem "send".
Czat obsługuje emoji wymienione w [tej bazie](https://www.webpagefx.com/tools/emoji-cheat-sheet/) + kappa + spacjaTV + lenny.

# Wymagania
- nodejs i npm
```
sudo apt-get install nodejs
sudo apt-get install npm
```

- moduły express oraz socket.io oraz kilka innych. Będąc w folderze zawierającym package.json wystarczy wpisać:
```
sudo npm install
```
Komenda ta zainstaluje wszystkie moduły zawarte w pliku package.json. Zawiera on moduły potrzebne do działania całości projektu.

- Mongodb do przechowywania danych użytkowników.
Aby zainstalować mongodb wpisujemy kolejno:
```
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
```
Jeśli komenda została wpisane poprawnie powinniśmy zobaczyć:
```
			Output
gpg: Total number processed: 1
gpg:		   imported: 1 (RSA: 1)
```
Kolejny krok:
```
echo "deb http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list

sudo apt-get update

sudo apt-get install -y mongodb-org
```
Następnie edytujemy/tworzymy plik mongodb.service w katalogu `/etc/systemd/system`:
```
sudo nano /etc/systemd/system/mongodb.service
```
I wypełniamy go tak, aby wyglądał w ten sposób:
```
[Unit]
Description=High-performance, schema-free document-oriented database
After=network.target

[Service]
User=mongodb
ExecStart=/usr/bin/mongod --quiet --config /etc/mongod.conf

[Install]
WantedBy=multi-user.target
```
Następnie startujemy nowo utworzoną usługę:
```
sudo systemctl start mongodb
```
Jeśli chcemy sprawdzić czy została uruchomiona można zrobić to komendą:
```
sudo systemctl status mongodb
```
Aby ustawić autostart usługi wpisujemy:
```
sudo systemctl enable mongodb
```
Jeśli usługa nie może zlaleźć katalogu `/data/db` to należy go utworzyć, a następnie zmienić jego właściciela na mongodb:
```
sudo mkdir /data/db
sudo chown mongodb /data/db
sudo chgrp mongodb /data/db
```
Z bazą danych z konsoli możemy połączyć się przy użyciu komendy
```
mongo
```
Aby przełączyć się na bazę o nazwie [nazwa] należy wpisać komendę:
```
use [nazwa]
```

# Emoji!
- Emoji obsługiwane są przez [emoji-parser](https://github.com/frissdiegurke/emoji-parser)
- Moduł obsługuje emoji zawarte w [tej bazie](https://www.webpagefx.com/tools/emoji-cheat-sheet/) + kappa + spacjaTV + lenny.
- Dodawanie własnych emotikon:
Aby dodać emotikonę należy dopisać linię(przed `return str`!!!):
```
str = str.replace(/[regex]/g, '<img class="emoji" src="emoji/[nazwa pliku]">');
```
Gdzie jako [regex] możemy podać wyraz/wyrażenie, np. ':)' lub 'kurczak'. Możemy podać również wyrażenie regularne akceptujące wszystkie wyrazy spełniające określony warunek, np. '\:[\)\]\>]'. Podając przykładowy regex zastąpimy ':)' ':]' ':>' podanym przez nas wyrażeniem/obrazkiem. Jeśli chcemy aby był to obrazek to należy dodać go do folderu '/emoji' oraz wpisać jego nazwę w miejsce [nazwa pliku]. Jeśli zaś chcemy coś zastąpić tekstem wystarczy dopisać:
```
str = str.replace(/[regex]/g, '[nowy tekst]');
```

# Plik auth.js
- W katalogu config znajduje się plik auth.js. Poprawne skonfigurowanie jego zawartości wymagadne jest do przeprowadzenia autoryzacji przez facebooka. Jako `clientID` wpisujemy `'app ID'`, jako `clientSecret` `'app Secret'` pobrane ze strony facebook for developers dla aplikacji 'SpacjaTV'. Jako `callbackURL` wpisujemy `'http://[adres strony]/auth/facebook/callback'`


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
