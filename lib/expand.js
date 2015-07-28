var async = require("async");
var _ = require("underscore");
var debug = require("debug")("Expand");
var concepts = require("./concepts");
var levelJson = require('leveldb-json');

// We wrap the DB
module.exports = function(db, level) {

  var createUserDB = function(dbname) {

    // With Events
    // var sub = require('sublevel')(level);

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

  var update = function(tuple, cb) {
    db.get(tuple, function(err, results) {
      if (!_.isEmpty(results)) {
        db.del(results[0], function(){
          debug("Updating tuple", tuple);
          db.put(tuple);
          cb();
        });
      } else {
       db.put(tuple);
       cb();
      }
    });
  };

  // Shorthand
  var createFact = function(s, v, o, trans, cb) {

    var sub = s.toLowerCase();
    var verb = v.toLowerCase();
    var obj = o.toLowerCase();

    var put = {subject: sub, predicate: verb, object: obj };
    debug("Create Fact ", put);
    update(put, function(err){
      if (trans) {
        db.get({subject:verb,  predicate: 'opposite'}, function(e,r){
          if (r.length !== 0) {
            debug("Create Fact ", {subject: obj, predicate: r[0].object, object: sub });
            update({subject: obj, predicate: r[0].object, object: sub }, function(err){
              cb(err);
            });
          } else {
            cb(err);
          }
        });
      } else {
        cb(err);
      }
    });
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

  // Expose functions here.

  var dump = function (filePath) {
    return levelJson.dump(filePath, level);
  }

  var restore = function (filePath) {
    return levelJson.load(filePath, level);
  }

  return {
    conceptToList: conceptToList,
    findParentConcepts: findParentConcepts,

    create: createFact,
    db: db,
    dump: dump,
    restore: restore,
    createUserDB: createUserDB,
    createUserDBWithData: createUserDBWithData,
    loadFile: loadFile
  };
};
