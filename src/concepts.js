import fs from 'fs';
import _ from 'lodash';
import async from 'async';
import debuglog from 'debug';

const debug = debuglog('Concept');

class ConceptObj {
  constructor(db, name = 'no-name') {
    this.name = name;
    this.highLevelConcepts = [];
    this.referencedConcepts = [];
    this.tables = [];
    this.db = db;
  }

  createFact(subject, verb, object, callback) {
    debug('Creating new fact', subject, verb, object);
    this.db.put({ subject, predicate: verb, object }, (err) => {
      callback(err);
    });
  }
}

const isConcept = test => test.startsWith('~');
const prepConcept = concept => concept.substring(concept.indexOf('~') + 1);

const removeComments = function removeComments(contents) {
  return contents.split('\n')
    .map(line => (line.indexOf('#') !== -1 ? line.substring(0, line.indexOf('#')) : line))
    .join('\n');
};

const readConceptFile = function readConceptFile(file, db, callback) {
  const regex = /concept:\s*~([a-z_]*).*\(([\s\S]*?)\)/gi;
  let concept = regex.exec(file);
  const concepts = [];

  while (concept) {
    concepts.push(concept);
    concept = regex.exec(file);
  }

  const c = new ConceptObj(db);

  async.map(concepts, (concept, next) => {
    const conceptName = concept[1].toLowerCase();

    const conceptTerms = concept[2].trim()
      .match(/"[\s\S]+?"|[^\s]+/ig)
      .map((part) => {
        if (part.startsWith('"') && part.endsWith('"')) {
          return part.substring(part.indexOf('"') + 1, part.lastIndexOf('"'));
        }
        return part;
      })
      .filter(term => term)
      .map(term => term.toLowerCase())
      .map(term => prepConcept(term));

    c.highLevelConcepts.push(conceptName);
    c.referencedConcepts.push(conceptName);

    async.map(conceptTerms, (term, nextTerm) => {
      async.series([
        cb => c.createFact(conceptName, 'example', term, cb),
        cb => c.createFact(term, 'isa', conceptName, cb),
      ], nextTerm);
    }, (err) => {
      next(err);
    });
  }, () => {
    c.highLevelConcepts = _.uniq(c.highLevelConcepts);
    c.referencedConcepts = _.uniq(c.highLevelConcepts);
    callback(c);
  });
};

const addFact = function addFact(c, fact, callback) {
  const p0 = fact[0];
  const p1 = fact[1];
  const p2 = fact[2];

  if (_.isArray(p0) || _.isArray(p2)) {
    if (_.isArray(p0)) {
      async.times(p0.length, (n, next) => {
        if (isConcept(p0[n])) c.referencedConcepts.push(prepConcept(p0[n]));
        if (isConcept(p1)) c.referencedConcepts.push(prepConcept(p1));
        if (isConcept(p2)) c.referencedConcepts.push(prepConcept(p2));
        c.createFact(p0[n], p1, prepConcept(p2), next);
      }, callback);
    }
    if (_.isArray(p2)) {
      async.times(p2.length, (n, next) => {
        if (isConcept(p0)) c.referencedConcepts.push(prepConcept(p0));
        if (isConcept(p1)) c.referencedConcepts.push(prepConcept(p1));
        if (isConcept(p2[n])) c.referencedConcepts.push(prepConcept(p2[n]));
        c.createFact(p0, p1, prepConcept(p2[n]), next);
      }, callback);
    }
  } else {
    if (isConcept(p0)) c.referencedConcepts.push(prepConcept(p0));
    if (isConcept(p1)) c.referencedConcepts.push(prepConcept(p1));
    if (isConcept(p2)) c.referencedConcepts.push(prepConcept(p2));

    c.createFact(p0, p1, prepConcept(p2), callback);
  }
};

const readTableFile = function readTableFile(file, db, callback) {
  const regex = /table:\s*~([a-z_]*)\s*\((.*)\)([\s\S]*?)DATA:((?:(?!table|#)[\s\S])*)/gi;
  let table = regex.exec(file);
  const tables = [];

  while (table) {
    tables.push(table);
    table = regex.exec(file);
  }

  const c = new ConceptObj(db);

  async.map(tables, (table, next) => {
    const tableName = table[1];
    const tableArgs = table[2].split(' ').filter(x => x);
    const tableDefs = table[3].split('\n')
      .map(def => def.trim())
      .filter(def => def.startsWith('^createfact'))
      .map(def => def.substring(def.indexOf('(') + 1, def.lastIndexOf(')')))
      .map(def => def.split(' '))
      .map(def => def.map((part) => {
        const index = tableArgs.indexOf(part);
        return (index >= 0 ? index : part);
      }));
    const tableData = table[4].split('\n')
      .map(line => line.trim())
      .filter(x => x)
      .map(line => line.match(/\[[\s\S]+?\]|[^\s]+/ig).map((part) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          return part.substring(part.indexOf('[') + 1, part.lastIndexOf(']')).split(' ');
        }
        return part;
      }));

    c.tables.push(tableName);
    async.map(tableDefs, (def, nextDef) => {
      // tableArgs: ['^thing1', '^thing2']
      // tableDefs: [[0, 'isa', 1], [1, 'isa', 0]]
      // tableData: [[['potential', 'thing'], 'another thing'], ...]

      const organisedData = tableData.map(data => def.map(
        defPart => (Number.isInteger(defPart) ? data[defPart] : defPart),
      ));

      async.map(organisedData, (data, nextData) => {
        addFact(c, data, nextData);
      }, nextDef);
    }, next);
  }, () => {
    c.tables = _.uniq(c.tables);
    c.referencedConcepts = _.uniq(c.referencedConcepts);
    callback(c);
  });
};

const readFile = function readFile(filename, db, callback) {
  if (filename.slice(-4) === '.top') {
    debug(`Processing concept file: ${filename}`);
    fs.readFile(filename, 'utf8', (err, contents) => {
      if (err) {
        return callback(err);
      }
      return readConceptFile(removeComments(contents), db, callback);
    });
  } else if (filename.slice(-4) === '.tbl') {
    debug(`Processing table file: ${filename}`);
    fs.readFile(filename, 'utf8', (err, contents) => {
      if (err) {
        return callback(err);
      }
      return readTableFile(removeComments(contents), db, callback);
    });
  } else {
    callback(`Error: Fact file has an invalid file extension: it should be either .tbl or .top: ${filename}`);
  }
};

// This is the same as read file, but it reads an array of files
const readFiles = function readFiles(files, db, callback) {
  const itor = (file, next) => {
    readFile(file, db, (conceptObj) => {
      // Add the reference concepts
      async.times(conceptObj.referencedConcepts.length, (n, next2) => {
        conceptObj.createFact(conceptObj.referencedConcepts[n], 'isa', 'concept', (err) => {
          next2(err);
        });
      }, (err) => {
        if (err) {
          console.error(err);
        }
        next(null, conceptObj);
      });
    });
  };

  async.map(files, itor, (err, conceptMap) => {
    callback(err, conceptMap);
  });
};

export default {
  readFile,
  readFiles,
};
