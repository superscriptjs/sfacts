
var levelgraph  = require('levelgraph');

exports.explore = function(dbname) {
	var level = require('level')(dbname);
	var db = require('levelgraph-recursive')(levelgraph(level));

	return require("./lib/expand")(db, level);
}

exports.load = require("./lib/system").load; 
exports.create = require("./lib/system").create; 
exports.db = require("./lib/system").db;