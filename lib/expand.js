var async = require("async");
var _ = require("underscore");
var debug = require("debug")("Expand");
var concepts = require("./concepts");
// var levelJson = require('leveldb-json');

// We wrap the DB
module.exports = function(db, level) {

  var createUserDB = function(dbname) {

    // With Hooks
    var sub = require('level-sublevel')(level);
    var graphLevel = sub.sublevel(dbname);
    graphLevel.db = level.db;
    graphLevel.approximateSize = level.db.approximateSize.bind(level.db);

    var graph = require('levelgraph')(graphLevel);

    // return graph;
    return require("./expand")(graph);

  };

  var createUserDBWithData = function(dbname, files, cb) {

    var sub = require('level-sublevel')(level);
    var graphLevel = sub.sublevel(dbname);
    graphLevel.db = level.db;
    graphLevel.approximateSize = level.db.approximateSize.bind(level.db);

    var graph = require('levelgraph')(graphLevel);

    concepts.readFiles(files, graph, function(err, db2){
      cb(err, require("./expand")(graph));
    });
  };

  // This adds a file to an existing DB
  var loadFile = function(files, cb) {
    concepts.readFiles(files, db, cb);
  };

  var conceptToList = function(term, depth, cb) {
    if (_.isFunction(depth)) {
      cb = depth;
      depth = 0;
    }

    if (depth == 10) {
      cb("DEPTH",null);
    }

    db.search([
      {subject: term, predicate: 'example', object: db.v("concepts") }
    ], function(err, results) {

      var itor = function(itemx, next) {
        // db.get({subject: itemx , predicate: 'isa', object: 'concept' },
          db.search([
            {subject: itemx, predicate: 'isa', object: db.v("concepts") },
            {subject: db.v("concepts"), predicate: "isa", object: "concept"},
            {subject: itemx, predicate: "example", object: db.v("term")},
          ],
          function(err, res2) {

            if (_.isEmpty(res2)) {
              next(null, itemx);
            } else {
              if (itemx !== term) {
                conceptToList(itemx, depth+1, next);
              } else {
                next(null, itemx);
              }
            }
          }
        );
      };

      var list = results.map(function(item){ return item.concepts; });

      async.map(list, itor, function(err, res) {
        var resultSet = _.unique(_.flatten(res));
        cb(null, resultSet);
      });
    });
  };

  var findParentConcepts = function(term, cb) {
    db.search([
      {subject: term, predicate: 'isa', object: db.v("concepts") }
    ], function(err, results) {
      if (results.length !== 0) {
        var cl = results.map(function(item){return item.concepts; });
        cb(null, cl);
      } else {
        cb(null, []);
      }
    });
  };

  return {
    conceptToList: conceptToList,
    findParentConcepts: findParentConcepts,
    db: db,
    level: level,
    createUserDB: createUserDB,
    createUserDBWithData: createUserDBWithData,
    loadFile: loadFile
  };
};
