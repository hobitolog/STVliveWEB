var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
	facebook: {
		id: String,
		token: String,
		email: String,
		name: String,
		photo: String,
		role: String		//User role: [a] Admin, [u] User, [m] Moderator, [b] Banned
	}
});

module.exports = mongoose.model('User', userSchema);
