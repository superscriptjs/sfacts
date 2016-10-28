import levelUp from 'levelup';
import mongoDown from 'mongodown';
import levelGraph from 'levelgraph';
import levelGraphRecursive from 'levelgraph-recursive';

import concepts from './concepts';
import expand from './expand';

const create = function create(dbName, cb) {
  if (cb) {
    levelUp(dbName, { db: mongoDown }, (err, leveldb) => {
      const db = levelGraphRecursive(levelGraph(leveldb));
      if (cb) {
        cb(err, expand(db, leveldb));
      }
    });
  } else {
    const leveldb = levelUp(dbName, { db: mongoDown });
    const db = levelGraphRecursive(levelGraph(leveldb));
    return expand(db, leveldb);
  }
};

// This loads a global DB
const load = function load(files, dbName, cb) {
  levelUp(dbName, { db: mongoDown }, (err, leveldb) => {
    if (err) {
      return cb(err);
    }
    const db = levelGraphRecursive(levelGraph(leveldb));
    concepts.readFiles(files, db, (err2, db2) => {
      cb(err2, expand(db, leveldb));
    });
  });
};

export default {
  create,
  load,
};
