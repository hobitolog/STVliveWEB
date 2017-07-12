[Powrót do pliku README](../master/README.md)
## Opis szczegółowy pliku nginx.conf

`user www-data;`  
Proces jest uruchamiany z konta `www-data`.

```
events {
worker_connections  1024;
}
```
Maksymalna liczba połączonych klientów. Domyślnie 1024.

```
rtmp {
server {

    listen 1935;	
    chunk_size 4096;
```
Nasłuchiwanie na stream od OBS na porcie 1935 (domyślny port RTMP).  
Maksymalna wartość fragmentu, domyślnie 4096. 
>The bigger this value the lower CPU overhead. This value cannot be less than 128.

```
    application live {
	live on;
	exec_options on;
 ```
 Aplikacja `live` zbierający sygnał z OBS.  
 Włączamy opcje odbierania transmisji na żywo i odbierania streamu tylko z określonego klucza.
 ```
 #FFMPEG_BEGIN
	exec ffmpeg -i rtmp://localhost:1935/live/test -async 1 -vsync -1
	            	        -c:v libx264 -c:a aac -b:v 256k -b:a 32k -vf "scale=480:trunc(ow/a/2)*2" -tune zerolatency -preset veryfast -crf 23 -f flv rtmp://localhost:1935/hls/test_low
                        -c:v libx264 -c:a aac -b:v 768k -b:a 96k -vf "scale=720:trunc(ow/a/2)*2" -tune zerolatency -preset veryfast -crf 23 -f flv rtmp://localhost:1935/hls/test_mid
                        -c:v libx264 -c:a aac -b:v 1920k -b:a 128k -vf "scale=1280:trunc(ow/a/2)*2" -tune zerolatency -preset veryfast -crf 23 -f flv rtmp://localhost:1935/hls/test_hd720
                        -c copy -f flv rtmp://localhost:1935/hls/test_src; # 2>>/tmp/log;
#FFMPEG_END
    }
```
Sekcja oznaczona przez `#FFMPEG_BEGIN` i `#FFMPEG_END` jest automatycznie generowana przez nodejs.  
**NIE ZMIENIAĆ JEJ RĘCZNIE!!!**  
W załączonym przykładzie:
>Komenda ffmpeg konwertuje przychodzący sygnał na 4 różne:
>1. *_low* - Video: H.264, 240p, bitrate 256 kbps, Audio: AAC, bitrate 32 kbps
>2. *_mid* - Video: H.264, 480p, bitrate 768 kbps, Audio: AAC, bitrate 96 kbps
>3. *_hd720* - Video: H.264, 720p, bitrate 1920 kbps, Audio: AAC, bitrate 128 kbps
>4. *_src* - Oryginalne parametry
>Powstałe 4 strumienie są kierowane do aplikacji `hls`.

```
    application hls {
        live on;

        hls on;
        hls_path /tmp/hls/;
	hls_nested on;
#HLS_VARIANT_BEGIN
	hls_variant _low BANDWIDTH=288000;
	hls_variant _mid BANDWIDTH=448000;
	hls_variant _hi BANDWIDTH=2048000;
	hls_variant _src BANDWIDTH=4096000;
#HLS_VARIANT_END
    }
```
Aplikacja `hls` przyjmuje strumienie z aplikacji `live`. Konwertowane fragmenty do przesłania umieszcza w folderze `/tmp/hls/`.
Opcja zagnieżdżania umieszcza różne jakości w osobnych folderach.
Sekcja oznaczona przez `#HLS_VARIANT_BEGIN` i `#HLS_VARIANT_END` jest automatycznie generowana przez nodejs.  
**NIE ZMIENIAĆ JEJ RĘCZNIE!!!**  
Oznacza każdy ze strumieni łącznym bitrate'm dla odtwarzacza-klienta.

```
http {
	sendfile off;
	tcp_nopush on;
	directio 512;
```
Nie mam pojęcia co robią te opcje, ale podobno polepszają optymalizacje wysyłania xD

```
server {
    listen      8081;
```
Serwer HTTP ze streamem HLS na porcie 8081. Trzeba go potem dopisać do adresu strumienia w pliku html.  

```
# rtmp stat
	location /stat {
	rtmp_stat all;
	rtmp_stat_stylesheet stat.xsl;
}
```
Pod adresem `http://<IP>:8081/stat` jest dostępny xml z parametrami aplikacji, jakie strumienie są aktualnie transmitowane, liczbę klientów itp.

```
    location /hls {
        # Serve HLS fragments
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
        root /tmp/;
        add_header Cache-Control no-cache;
	add_header Access-Control-Allow-Origin *;
    }
```
Ustawienia kodowania i nagłówków HTTP.
Pod adresem `http://<IP>:8081/hls/<klucz>` jest właściwy strumień HLS osadzany na stronce.

## Credits
- [Robert Kosakowski](https://github.com/Kosert)
