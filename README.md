# STVliveWEB
Important SpacjaTV stuff.  
Generalny zamysł:  
![alt text](https://github.com/hobitolog/STVliveWEB/blob/master/schemat.png "Schemat")

## Maszyna Wirtualna
Jakiś linux.
Ja używałem VirtualBox z Ubuntu 16.04
### Potrzebne rzeczy:
- nginx z modułem RTMP  
[poradnik do instalacji od pana Jaśkiewicza](https://obsproject.com/forum/resources/how-to-set-up-your-own-private-rtmp-server-using-nginx.50/)
- nodejs i npm  
```
sudo apt-get install nodejs  
sudo apt-get install npm
```
- moduł express do node'a
```
sudo npm install express
```

### Konfiguracja nginx
Plik konfiguracyjny `nginx.conf` znajduje się w folderze `/usr/local/nginx/conf`.  
#### Wyjaśnienia poszczególnych linijek
```
rtmp {
server {
    listen 1935;
```

   Port do RTMP, domyślny to 1935. Można sobie ustawić inny ale trzeba go potem dopisać do IP w OBSie.

```
   application hls {
        live on;
        hls on;
        hls_path /tmp/hls;
   }
```

   Przerabiamy strumień RTMP na HLS.
   
```
http {
server {
    listen      8081;
```

Port do przekazywania HLS. Trzeba go potem dopisać do adresu strumienia w pliku html.  
Jest wykorzystywany tylko lokalnie (chyba xD), więc w sumie jeden chuj jaki się wybierze byle nie był już używany gdzieś indziej. 

```
    location /hls {
        # Serve HLS fragments
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
        root /tmp;
        add_header Cache-Control no-cache;
	add_header Access-Control-Allow-Origin *;
    }
``` 
Ustawienia kodowania i headerów HTTP.  

### Konfiguracja nodeJS

W pliku `public/index.html` trzeba w linijce:  
`hls.loadSource('http://192.168.56.101:8081/hls/test.m3u8');`  
zmienić adres IP na adres naszej maszyny wirtualnej i port jeżeli w `nginx.conf` daliśmy inny.

 
## OBS
W ustawieniach OBS'a, w zakładce stream trzeba wybrać 'Własny serwer strumieniowania' i podać:  
URL: rtmp://IP:PORT/hls/ gdzie IP to adres maszyny wirtualnej (u mnie 192.168.56.101), a PORT uzupełniamy jeżeli ustawiliśmy inny niż domyślny (1935).  
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
`/path/to/my/app.sc &` przed linią `exit 0`. Znak ampersanda pozwoli, aby zadanie odpaliło się w tle, a skrypt wywoływał dalsze polecenia. Należy przyjąć, że `/etc/rc.local` jest skryptem wywoływanym przy każdym uruchomieniu systemu. Oczywiści może on wywoływać inne skrypty oraz uruchamiać aplikacje.
