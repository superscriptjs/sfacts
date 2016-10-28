import fs from 'fs';
import str from 'string';
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

const readFile = function readFile(file, db, cb) {
  let tableArgs = [];
  let factDef = [];
  let inTableData = false;

  const c = new ConceptObj(db, file);

  const isConcept = function isConcept(term) {
    if (_.isString(term) || _.isString(term.s)) {
      return (term.indexOf('~') !== -1);
    }
    return false;
  };

  const prepConcept = function prepConcept(term) {
    return str(term).chompLeft('~').toLowerCase().trim().s;
  };

  const findOrCreateConcept = function findOrCreateConcept(term) {
    if (isConcept(term)) {
      c.referencedConcepts.pushUnique(prepConcept(term));
    }

    const nc = term.chompLeft('~').toLowerCase().trim();
    return nc.s;
  };

  const parseArray = function parseArray(line) {
    let buff = [];
    let inQuotes = false;
    const ar = [];
    for (let n = 0; n < line.length; n++) {
      if (/[~a-z0-9-_']/i.test(line[n]) || inQuotes) {
        buff.push(line[n]);
        if (line[n] === '"') {
          buff.pop();
          inQuotes = false;
        }
      } else if (line[n] === '"') {
        inQuotes = true;
      } else {
        if (buff.join('') !== '') {
          ar.push(buff.join(''));
        }
        buff = [];
      }
    }
    // Flush the remaining items from the buffer
    if (buff.length !== 0) {
      ar.push(buff.join(''));
    }

    return ar;
  };

  let factCount = 0;

  const addFact = function addFact(def, callback) {
    if (factDef) {
      async.timesSeries(factDef.length, (i, next) => {
        if (factDef[i].length === 3) {
          const p0 = (def[factDef[i][0]]) ? def[factDef[i][0]] : factDef[i][0];
          const p1 = (def[factDef[i][1]]) ? def[factDef[i][1]] : factDef[i][1];
          const p2 = (def[factDef[i][2]]) ? def[factDef[i][2]] : factDef[i][2];

          if (_.isArray(p0) || _.isArray(p2)) {
            if (_.isArray(p0)) {
              async.timesSeries(p0.length, (n, next2) => {
                if (isConcept(p0[n])) c.referencedConcepts.pushUnique(prepConcept(p0[n]));
                if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
                if (isConcept(p2)) c.referencedConcepts.pushUnique(prepConcept(p2));
                c.createFact(p0[n], p1, prepConcept(p2), (err) => {
                  factCount += 1;
                  next2(err);
                });
              }, (err) => {
                next(err);
              });
            }
            if (_.isArray(p2)) {
              async.timesSeries(p2.length, (n, next2) => {
                if (isConcept(p0)) c.referencedConcepts.pushUnique(prepConcept(p0));
                if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
                if (isConcept(p2[n])) c.referencedConcepts.pushUnique(prepConcept(p2[n]));
                c.createFact(p0, p1, prepConcept(p2[n]), (err) => {
                  factCount += 1;
                  next2(err);
                });
              }, (err) => {
                next(err);
              });
            }
          } else {
            if (isConcept(p0)) c.referencedConcepts.pushUnique(prepConcept(p0));
            if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
            if (isConcept(p2)) c.referencedConcepts.pushUnique(prepConcept(p2));

            c.createFact(p0, p1, prepConcept(p2), (err) => {
              factCount += 1;
              next(err);
            });
          }
        }
      }, err => callback(err));
    }
  };

  const addTableData = function addTableData(line, callback) {
    let buff = [];
    let conceptsInBraces = false;
    let inQuotes = false;
    let inBraces = false;
    let i = 0;
    const data = {};
    let nconcept;
    if (line === '') {
      return callback(null);
    }
    async.timesSeries(line.length, (n, next) => {
      if (/[~a-z0-9-._']/i.test(line[n]) || inQuotes || inBraces) {
        buff.push(line[n]);
        if (line[n] === '"') {
          inQuotes = false;
          buff.pop();
        } else if (line[n] === ']') {
          inBraces = false;
          buff.pop();
        }
      } else if (line[n] === '"') {
        inQuotes = true;
      } else if (line[n] === '[') {
        inBraces = true;
        conceptsInBraces = true;
      } else {
        // If there's a space and we're not within quotes or braces
        nconcept = buff.join('');

        if (nconcept !== '') {
          if (conceptsInBraces) {
            data[tableArgs[i]] = parseArray(nconcept);
          } else {
            data[tableArgs[i]] = nconcept;
          }
          conceptsInBraces = false;
          i += 1;
          buff = [];
          if (i === tableArgs.length) {
            return addFact(data, (err) => {
              next(err);
            });
          }
        }
      }
      next(null);
    }, (err) => {
      if (buff.length !== 0) {
        nconcept = buff.join('');
        if (conceptsInBraces) {
          data[tableArgs[i]] = parseArray(nconcept);
        } else {
          data[tableArgs[i]] = nconcept;
        }
        i += 1;

        if (i === tableArgs.length) {
          return addFact(data, (err) => {
            callback(err);
          });
        }
        return callback(err);
      }
      return callback(err);
    });
  };

  // Adds the Concept line, minus the main concept
  const addConcepts = function addConcepts(conceptName, line, callback) {
    let buff = [];
    let inQuotes = false;
    const l2 = str(line).between('(');
    const comment = str(l2.s).indexOf('#');

    let eol = l2.length;
    if (comment !== -1) {
      eol = comment - 1;
    }

    async.timesSeries(eol, (n, next) => {
      if (/[~a-z0-9-_']/i.test(l2.s[n]) || inQuotes) {
        buff.push(l2.s[n]);
        if (l2.s[n] === '"') {
          buff.pop();
          inQuotes = false;
        }
      } else if (l2.s[n] === '"') {
        inQuotes = true;
      } else {
        const nconcept = buff.join('');
        buff = [];
        if (nconcept !== '' && conceptName) {
          const cleanConcept = prepConcept(conceptName);
          const cleanRel = prepConcept(nconcept);
          return c.createFact(cleanConcept, 'example', cleanRel, (err) => {
            c.createFact(cleanRel, 'isa', cleanConcept, (err) => {
              if (err) {
                console.log(err);
              }
              next(err);
            });
          });
        }
      }
      return next(null);
    }, (err) => {
      if (err) {
        console.log(err);
      }
      callback(err);
    });
  };

  const input = fs.createReadStream(file);
  let remaining = '';
  let currentConcept;

  // This exists so that the 'end' handler doesn't fire until all the callbacks
  // from the 'data' handler have finished.
  let callbackComplete = false;

  input.on('data', (data) => {
    remaining += data;

    // This is async since it can potentially call addTableData or addConcepts
    async.whilst(() => (remaining.indexOf('\n') > -1), (callback) => {
      const index = remaining.indexOf('\n');

      const line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);

      const nline = str(line).trimLeft();
      if (nline.indexOf('concept:') === 0) {
        // If the line starts with 'concept:', start off a new concept
        let conceptName = str(nline).between('concept:', '(').trim();
        // Some lines have extra leading descriptors
        conceptName = conceptName.split(' ')[0];

        if (isConcept(conceptName)) {
          c.highLevelConcepts.pushUnique(prepConcept(conceptName));
        }

        currentConcept = findOrCreateConcept(str(conceptName));
        return addConcepts(currentConcept, nline, callback);
      } else if (currentConcept) {
        // Otherwise continue with the currently importing concept (more to import)
        return addConcepts(currentConcept, nline, callback);
      } else if (nline.indexOf('table:') === 0) {
        // Reset the Fact Tables
        factDef = [];
        inTableData = false;
        let conceptName = str(nline).between('table:', '(').trim();
        conceptName = conceptName.split(' ')[0];
        debug('Table', conceptName);
        c.tables.pushUnique(prepConcept(conceptName));
        tableArgs = (str(nline).between('(', ')').trim()).split(' ').filter(e => e);
        debug('TableArgs', tableArgs);
      } else if (inTableData) {
        // Skip comments
        if (nline.indexOf('#') === -1) {
          return addTableData(nline.s, callback);
        }
      } else if (nline.indexOf('^createfact') === 0) {
        factDef.push((str(nline).between('(', ')').trim()).split(' '));
        debug('factDef', factDef);
      } else if (nline.indexOf('DATA:') === 0) {
        inTableData = true;
      }
      return callback(null);
    }, (err) => {
      if (err) {
        console.log(err);
      }
      callbackComplete = true;
    });
  });

  input.on('end', () => {
    // Wait for callbacks in 'data' handler to finish.
    async.whilst(() => (!callbackComplete), (callback) => {
      setTimeout(() => callback(), 100);
    }, () => {
      if (remaining.length > 0) {
        const nline = str(remaining).trimLeft();

        if (nline.indexOf('concept:') === 0) {
          let conceptName = str(nline).between('concept:', '(').trim();
          // Some lines have extra leading descriptors
          conceptName = conceptName.split(' ')[0];

          if (isConcept(conceptName)) {
            c.highLevelConcepts.pushUnique(prepConcept(conceptName));
          }

          currentConcept = findOrCreateConcept(str(conceptName));
          return addConcepts(currentConcept, nline, () => {
            debug('Added # Facts', factCount);
            cb(c);
          });
        }

        return addConcepts(currentConcept, nline, () => {
          debug('Added # Facts', factCount);
          cb(c);
        });
      }
      debug('Added # Facts', factCount);
      return cb(c);
    });
  });
};

Array.prototype.pushUnique = function (item) {
  if (this.indexOf(item) === -1) {
    this.push(item);
    return true;
  }
  return false;
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
          console.log(err);
        }
        next(null, conceptObj);
      });
    });
  };

  async.mapSeries(files, itor, (err, conceptMap) => {
    callback(err, conceptMap);
  });
};

export default {
  readFile,
  readFiles,
};
