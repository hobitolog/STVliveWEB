# STVliveWEB
Important SpacjaTV stuff.  
Generalny zamysł:  
![alt text](../master/schemat.png "Schemat")
**//TUDUDU: Trzeba będzie to zmienić, nodeJS powinien być hostowany przez samego nginxa, a nie osobno. Potem się tym zajmiemy** 

## Maszyna Wirtualna
Jakiś linux.
Ja używałem VirtualBox z Ubuntu 16.04
### Potrzebne rzeczy:
- nginx z modułem RTMP  
[poradnik do instalacji od pana Jaśkiewicza](https://obsproject.com/forum/resources/how-to-set-up-your-own-private-rtmp-server-using-nginx.50/)  
tl;dr:  
```
sudo apt-get install build-essential libpcre3 libpcre3-dev libssl-dev
wget http://nginx.org/download/nginx-1.13.1.tar.gz
wget https://github.com/arut/nginx-rtmp-module/archive/master.zip
tar -zxvf nginx-1.13.1.tar.gz
unzip master.zip
cd nginx-1.13.1
./configure --with-http_ssl_module --add-module=../nginx-rtmp-module-master
make
sudo make install
```
- nodejs i npm  
```
sudo apt-get install nodejs  
sudo apt-get install npm
```
- moduł express do node'a
```
sudo npm install express
```
- ffmpeg **//NA 90% TE KOMENDY DZIAŁAJĄ TYLKO NA UBUNTU**
```
sudo add-apt-repository ppa:jonathonf/ffmpeg-3
sudo apt-get install ffmpeg=7:3.3.2-1~16.04.york1 
```

### Konfiguracja nginx
Plik konfiguracyjny `nginx.conf` znajduje się w folderze `/usr/local/nginx/conf`.  
#### Wyjaśnienia poszczególnych linijek
Szczegółowy opis był zbyt długi i przeniosłem go do osobnego pliku.
Można go znaleźć [tutaj](../master/nginxCONF.md)


### Konfiguracja nodeJS

W pliku `public/index.html` trzeba w linijce:  
`hls.loadSource('http://192.168.56.101:8081/hls/test.m3u8');`  
zmienić adres IP na adres naszej maszyny wirtualnej i port jeżeli w `nginx.conf` daliśmy inny.

 
## OBS
W ustawieniach OBS'a, w zakładce stream trzeba wybrać 'Własny serwer strumieniowania' i podać:  
URL: rtmp://*IP*:*PORT*/live/ gdzie *IP* to adres maszyny wirtualnej (u mnie 192.168.56.101), a *PORT* uzupełniamy jeżeli ustawiliśmy inny niż domyślny (1935).  
Klucz: test

## Odpalenie wszystkiego
1. Na linuxie odpalamy nginx:  
`/usr/local/nginx/sbin/nginx` (jeżeli chcemy zatrzymać `/usr/local/nginx/sbin/nginx -s stop`)  
2. Dalej na linuxie nasz serwer w nodejs(będąc w folderze z `index.js`):  
`nodejs index.js`
PAMIĘTAJCIE O SUDO, BO WAM LINUX NOGI UJEBIE XD  
3. Teraz wracamy na ten lepszy system i w OBSie odpalamy streamka.  
4. Wchodzimy na strone pod adres naszej maszynny wirtualnej (u mnie to było http://192.168.56.101/).  
Jeżeli ustawiliśmy w node port 80, to nie musimy podawać portu w adresie.

## Odpalanie skryptów/aplikacji przy starcie systemu
[Link do stacka z rozwiązaniem](https://stackoverflow.com/questions/12973777/how-to-run-a-shell-script-at-startup)

Jeśli chcemy aby skrypt/aplikacja uruchamiała się przy starcie systemu(linuxowego) należy edytować plik rc.local
(`/etc/rc.local`) z prawami roota.

Aby to zrobić należy wpisać: `sudo nano /etc/rc.local` a następnie podać hasło.

Chcąć uruchomić skrypt znajdujący się w scieżce `/path/to/my/app.sc`(gdzie `app.sc` to nazwa skryptu) należy dopisać linię:
`/path/to/my/app.sc &` przed linią `exit 0`. Znak ampersanda pozwoli, aby zadanie odpaliło się w tle, a skrypt wywoływał dalsze polecenia. 

Należy przyjąć, że `/etc/rc.local` jest skryptem wywoływanym przy każdym uruchomieniu systemu. Oczywiści może on wywoływać inne skrypty oraz uruchamiać aplikacje.

## Attributions
- [nginx](https://nginx.org/en/)
- [nginx RTMP module](https://github.com/arut/nginx-rtmp-module)
- [node.js](https://nodejs.org/en/)
- [Express.js](https://expressjs.com/)
- [NPM](https://www.npmjs.com/)
- [hls.js](https://github.com/video-dev/hls.js/)
- [jQuery](https://jquery.com/)

## Credits
- [Robert Kosakowski](https://github.com/Kosert)
- [Krystian Minta](https://github.com/Yuunai)
