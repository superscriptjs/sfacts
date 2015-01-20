var facts = require("../");
var sfacts = facts.create("systemDB");
var userA = sfacts.createUserDB("userA").db;
var userB = sfacts.createUserDB("userB").db;

// sfacts.db.put({subject:"global", predicate:"name", object : "user" })

// var triple1 = {subject:"my", predicate:"name", object : "Rob" };
// var triple2 = {subject:"my", predicate:"name", object : "Jane" };

// userA.put(triple1, function(){
// 	userB.put(triple2, function(){
// 		console.log("Done");
// 		process.exit();
// 	});
// });


var gtriple = {subject:"my", predicate:"name"};

// SOme time later
userA.get(gtriple, function(e,r){
	console.log(e,r);
	userB.get(gtriple, function(e,r){
		console.log(e,r);
		console.log("Done");

		sfacts.db.get({}, function(e,r){
			console.log(r);
			process.exit();
		})
		
	});
});



