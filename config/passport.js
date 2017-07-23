var FacebookStrategy = require('passport-facebook').Strategy;

//User model
var User = require('../app/models/user');

//Auth variables
var configAuth = require('./auth');

module.exports = function(passport) {
//used to serialize the user for the session
	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

//used to deserializa the user
	passport.deserializeUser(function(id, done) {
		User.findById(id, function(err, user) {
			done(err, user);
		});
	});

//
//FACEBOOK
//

passport.use(new FacebookStrategy({
	//pull in app id and secret from auth.js file
	clientID	: configAuth.facebookAuth.clientID,
	clientSecret	: configAuth.facebookAuth.clientSecret,
	callbackURL	: configAuth.facebookAuth.callbackURL,
	profileFields	: configAuth.facebookAuth.profileFields
	},

//ogar tego co przyjdzie z FB
function(token, refreshToken, profile, done) {
	//asynchronous
	process.nextTick(function() {
		//szukaj uzytkownika na podstawie jego id
		User.findOne({'facebook.id' : profile.id }, function(err, user) {
		if(err)
			return done(err);
		//jesli uzytkownik się znalazł
		if(user) {
			return done(null, user); //zwróć użytkownika
		} else {
			//jeśli nie ==> stwórz nowego
			var newUser = new User();
			//uzupełnij model
			newUser.facebook.id 		= profile.id;
			newUser.facebook.token	= token;
			newUser.facebook.name 	= profile.displayName;
			newUser.facebook.email	= profile.emails[0].value;
			newUser.facebook.photo	= profile.photos[0].value;
			newUser.facebook.role		= 'u'; //After first login set role: user
			//zapisz
			newUser.save(function(err) {
				if(err)
					throw err;

				//jeśli się udało to zwróć użytkownika
				return done(null, newUser);
			});
			}
		});
	});
	}));
};
