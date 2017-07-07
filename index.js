/**
 * Created by Kosert on 2017-07-04.
 */

var express = require('express');
var app = express();

app.use(express.static('public'));

app.get('/', function (req, res) {
   res.send('Hello World');
})

var server = app.listen(80, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("No dziala, adres: http://%s:%s", host, port)

})