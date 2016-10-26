import _ from 'lodash';
import async from 'async';
import levelGraph from 'levelgraph';
import levelSublevel from 'level-sublevel';
import concepts from './concepts';

// We wrap the DB with extra functions.
const expand = function expand(db, level) {
  const createUserDB = function createUserDB(dbname) {
    // With Hooks
    const sub = levelSublevel(level);
    const graphLevel = sub.sublevel(dbname);
    graphLevel.db = level.db;
    graphLevel.approximateSize = level.db.approximateSize.bind(level.db);

    const graph = levelGraph(graphLevel);

    // return graph;
    return expand(graph);
  };

  const createUserDBWithData = function createUserDBWithData(dbname, files, cb) {
    const sub = levelSublevel(level);
    const graphLevel = sub.sublevel(dbname);
    graphLevel.db = level.db;
    graphLevel.approximateSize = level.db.approximateSize.bind(level.db);

    const graph = levelGraph(graphLevel);

    concepts.readFiles(files, graph, (err, db2) => {
      cb(err, expand(graph));
    });
  };

  // This adds a file to an existing DB
  const loadFile = function loadFile(files, cb) {
    concepts.readFiles(files, db, cb);
  };

  const conceptToList = function conceptToList(term, depth, cb) {
    if (_.isFunction(depth)) {
      cb = depth;
      depth = 0;
    }

    if (depth === 10) {
      cb('DEPTH', null);
    }

    db.search([
      { subject: term, predicate: 'example', object: db.v('concepts') },
    ], (err, results) => {
      const itor = (itemx, next) => {
        // db.get({subject: itemx , predicate: 'isa', object: 'concept' },
        db.search([
            { subject: itemx, predicate: 'isa', object: db.v('concepts') },
            { subject: db.v('concepts'), predicate: 'isa', object: 'concept' },
            { subject: itemx, predicate: 'example', object: db.v('term') },
        ],
          (err, res2) => {
            if (_.isEmpty(res2)) {
              next(null, itemx);
            } else if (itemx !== term) {
              conceptToList(itemx, depth + 1, next);
            } else {
              next(null, itemx);
            }
          }
        );
      };

      const list = results.map(item => item.concepts);

      async.map(list, itor, (err, res) => {
        const resultSet = _.uniq(_.flatten(res));
        cb(null, resultSet);
      });
    });
  };

  const findParentConcepts = function findParentConcepts(term, cb) {
    db.search([
      { subject: term, predicate: 'isa', object: db.v('concepts') },
    ], (err, results) => {
      if (results.length !== 0) {
        const cl = results.map(item => item.concepts);
        cb(null, cl);
      } else {
        cb(null, []);
      }
    });
  };

  return {
    conceptToList,
    findParentConcepts,
    db,
    level,
    createUserDB,
    createUserDBWithData,
    loadFile,
  };
};

export default expand;
