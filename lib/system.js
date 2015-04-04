var async = require("async");
var _ = require("underscore");
var concepts = require("./concepts");

var levelup = require('levelup');
var levelgraph  = require('levelgraph');
var fs = require("fs");

// This loads a global DB
module.exports.load = function(files, dbname, cb) {
  fs.exists(dbname, function (exists) {
    var level = require('level')(dbname);
    var db = require('levelgraph-recursive')(levelgraph(level));

    if (exists) {
      cb(null, require("./expand")(db, level));
    } else {
      concepts.readFiles(files, db, function(err, db2){
        cb(err, require("./expand")(db, level));
      });
    }
  });
};

module.exports.create = function(dbname) {
  var level = require('level')(dbname);
  var db = require('levelgraph-recursive')(levelgraph(level));
  return require("./expand")(db, level);
};

module.exports.db = function(dbname) {
  return levelgraph(dbname);
};
