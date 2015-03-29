var express = require('express');
var router = express.Router();

//ToDo: May just reference one schema
var models = require('../models');
var Bottle = models.Bottle;
var Note = models.Note;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});
var sessions = [];
var bottles = [];

// sets all currently active clients to available
var setAvailability = function(socket_id, available){
	sessions.forEach(function(user){
		if(user.id == socket_id) {
			user.available = available;
		}
	});
};



var userRandomizer = function(){
	//get all available users
	var filteredResults = sessions.filter(function(el){
		return el.available === true;
	});
	//if no available users return
	if (filteredResults.length === 0) return false;

	//get random user and  set their availability to false
	var random = Math.floor(Math.random() * filteredResults.length);
	sessions[sessions.indexOf(filteredResults[random])].available = false;
	//return their user ID
	return filteredResults[random].id;
};

var bottleRandomizer = function(bottles){
	//randomly select a number that will represent the bottle
	var random = Math.floor(Math.random() * bottles.length);
	return random;
};

module.exports = function(io) {
	var interval;
	io.on('connection', function(socket) {
		//on connection add user to sessions array
		sessions.push({
			id: socket.id,
			available: false
		});
		if (!interval) {
			interval = setInterval(function() {
				// bottle randomizer
				// modified : {$ne : socket.id}
				//find an available bottle

				Bottle.find({available : true}, function(err, bottles) {
					if (bottles.length > 0) {
						//get random user ID
						var nextId = userRandomizer();
						// get random bottle index
						var randomBottleIndex = bottleRandomizer(bottles);
						if (nextId) {
							//if there is an available user ID set  broadcast bottle via socket
							// and make it unavailable
							bottles[randomBottleIndex].available = false;
							bottles[randomBottleIndex].save(function(err, bottle) {
								socket.broadcast.to(nextId).emit('receive', bottle);
							});
						}
					}
				});
			}, 1000);
		}



		socket.on('disconnect', function(){
			console.log("before " + sessions);
			sessions.splice(sessions.indexOf(
				sessions.filter(function(el){
					return el.id == socket.id;
				})
			));


		});

		//create bottle
		socket.on('create',function(){
			// console.log(data); // TODO FORMAT OF DATA
			//set the session to unavailable for receiving music
			setAvailability(socket.id,false);

			//response
			console.log(socket.id + 'unavailble to receive');

			//show data
			console.log(sessions.filter(function(session){
				return socket.id == session.id;
			}));
		});

		socket.on('avail', function() {
			setAvailability(socket.id,true);
			console.log(sessions);
		});

		socket.on('notavail', function() {
			setAvailability(socket.id,false);
			console.log(sessions);
		});

		//save bottle
		socket.on('save', function(request) {
			// setAvailability(socket.id,true);
			console.log(socket.id + 'available to receive bottle');

			if (request.updateId) { // if update
				Bottle.findByIdAndUpdate(request.updateId, {bottle : request.type, modified : socket.id, available: true} ,function(err, updated) {
					if (err) return console.log(err);

					setAvailability(socket.id,false);
				});
			} else { // if save
				var newBottle = new Bottle({
					bottle : request.type,
					available : true,
					modified : socket.id
				});

				newBottle.save(function(err, bottle) {
					if (err) return console.log(err);
					setAvailability(socket.id,false);
				});
			}

			// Bottle.find({available: true}, function(err, bottles) {
			// 	if (err) throw new Error("bottle query error");
			// 	// console.log(nextId, sessions);
			// 	socket.broadcast.to(nextId).emit('received', bottleRandomizer(bottles));
			// });
		});


	});

	return router;
};

// <!-- var noteSchema = new Schema({
//   note : {type : String}, // string set ex) C4-time
//   time : {type : Number}
// });

// var bottleSchema = new Schema({
//   // setup schema here
//   bottle : {type : [noteSchema]} // added noteSchema to possibly add more features
// }); -->
