// TODO - clean up this file, we only use one function.
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

  createFact(subject, verb, object) {
    debug('Creating new fact', subject, verb, object);
    this.db.put({ subject, predicate: verb, object });
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

  const addFact = function addFact(def) {
    if (factDef) {
      for (let i = 0; i < factDef.length; i++) {
        if (factDef[i].length === 3) {
          const p0 = (def[factDef[i][0]]) ? def[factDef[i][0]] : factDef[i][0];
          const p1 = (def[factDef[i][1]]) ? def[factDef[i][1]] : factDef[i][1];
          const p2 = (def[factDef[i][2]]) ? def[factDef[i][2]] : factDef[i][2];

          if (_.isArray(p0) || _.isArray(p2)) {
            if (_.isArray(p0)) {
              for (i = 0; i < p0.length; i++) {
                if (isConcept(p0[i])) c.referencedConcepts.pushUnique(prepConcept(p0[i]));
                if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
                if (isConcept(p2)) c.referencedConcepts.pushUnique(prepConcept(p2));
                c.createFact(p0[i], p1, prepConcept(p2));
                factCount += 1;
              }
            }
            if (_.isArray(p2)) {
              for (i = 0; i < p2.length; i++) {
                if (isConcept(p0)) c.referencedConcepts.pushUnique(prepConcept(p0));
                if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
                if (isConcept(p2[i])) c.referencedConcepts.pushUnique(prepConcept(p2[i]));
                c.createFact(p0, p1, prepConcept(p2[i]));
                factCount += 1;
              }
            }
          } else {
            if (isConcept(p0)) c.referencedConcepts.pushUnique(prepConcept(p0));
            if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
            if (isConcept(p2)) c.referencedConcepts.pushUnique(prepConcept(p2));

            c.createFact(p0, p1, prepConcept(p2));
            factCount += 1;
          }
        }
      }
    }
  };

  const addTableData = function addTableData(line) {
    let buff = [];
    let conceptsInBraces = false;
    let inQuotes = false;
    let inBraces = false;
    let i = 0;
    const data = {};
    let nconcept;
    if (line !== '') {
      for (let n = 0; n < line.length; n++) {
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
              addFact(data);
            }
          }
        }
      }

      if (buff.length !== 0) {
        nconcept = buff.join('');
        if (conceptsInBraces) {
          data[tableArgs[i]] = parseArray(nconcept);
        } else {
          data[tableArgs[i]] = nconcept;
        }
        i += 1;

        if (i === tableArgs.length) {
          addFact(data);
        }
      }
    }
  };

  // Adds the Concept line, minus the main concept
  const addConcepts = function addConcepts(conceptName, line) {
    let buff = [];
    let inQuotes = false;
    const l2 = str(line).between('(');
    const comment = str(l2.s).indexOf('#');

    let eol = l2.length;
    if (comment !== -1) {
      eol = comment - 1;
    }

    for (let n = 0; n < eol; n++) {
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
        if (nconcept !== '' && conceptName) {
          const cleanConcept = prepConcept(conceptName);
          const cleanRel = prepConcept(nconcept);
          c.createFact(cleanConcept, 'example', cleanRel);
          c.createFact(cleanRel, 'isa', cleanConcept);
        }
        buff = [];
      }
    }
  };

  const input = fs.createReadStream(file);
  let remaining = '';
  let currentConcept;

  input.on('data', (data) => {
    remaining += data;
    let index = remaining.indexOf('\n');

    while (index > -1) {
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
        addConcepts(currentConcept, nline);
      } else if (currentConcept) {
        // Otherwise continue with the currently importing concept (more to import)
        addConcepts(currentConcept, nline);
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
      } else {
          // Deliberatly skip the check (missing the DATA line)
        if (inTableData) {
            // Skip comments
          if (nline.indexOf('#') === -1) {
            addTableData(nline.s);
          }
        } else if (nline.indexOf('^createfact') === 0) {
          factDef.push((str(nline).between('(', ')').trim()).split(' '));
          debug('factDef', factDef);
        }

        const tableData = nline.indexOf('DATA:');
        if (tableData === 0) {
          inTableData = true;
        }
      }
      index = remaining.indexOf('\n');
    }
  });

  input.on('end', () => {
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
        addConcepts(currentConcept, nline);
      } else {
        addConcepts(currentConcept, nline);
      }
    }
    debug('Added # Facts', factCount);
    cb(c);
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
    readFile(file, db, (con) => {
      // Add the reference concepts
      for (let i = 0; i < con.referencedConcepts.length; i++) {
        con.createFact(con.referencedConcepts[i], 'isa', 'concept');
      }

      next(null, con);
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
