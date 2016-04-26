var async = require("async");
var _ = require("underscore");
var concepts = require("./concepts");
var level = require('level');
var levelGraphRecursive = require('levelgraph-recursive');
var levelGraph  = require('levelgraph');
var expand = require("./expand");
var fs = require("fs");

module.exports.create = function(dbname, cb) {
  if(cb) {
    level(dbname, function(err, leveldb){
      var db = levelGraphRecursive(levelGraph(leveldb));
      if(cb) {
        cb(err, expand(db, leveldb));
      }
    });
  } else {
    var leveldb = level(dbname);
    var db = levelGraphRecursive(levelGraph(leveldb));
    return expand(db, leveldb);
  }
};

// This loads a global DB
module.exports.load = function(files, dbname, cb) {
  fs.exists(dbname, function (exists) {
    level(dbname, function(err, leveldb){
      if (err) {
        return cb(err);
      }
      var db = levelGraphRecursive(levelGraph(leveldb));
      if (exists) {
        cb(null, expand(db, leveldb));
      } else {
        concepts.readFiles(files, db, function(err2, db2){
          cb(err2, expand(db, leveldb));
        });
      }
    });
  });
};

module.exports.db = function(dbname) {
  return levelGraph(dbname);
};
