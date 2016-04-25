// TODO - clean up this file, we only use one function.

var fs        = require('fs');
var str       = require("string");
var _         = require("underscore");
var async     = require("async");
var debug     = require('debug')("Concept");

var ConceptObj = function(db, name) {
  this.name = (name) ? name : "no-name";
  this.highLevelConcepts = [];
  this.referencedConcepts = [];
  this.tables = [];
  this.db = db;
};

ConceptObj.prototype.createfact = function(subject, verb, object) {
  debug("Creating new fact", subject, verb, object );
  this.db.put({subject:subject,predicate:verb, object:object});
};

exports.readFile = readFile = function(file, db, cb) {

  var cConcept;
  var tableArgs = [];
  var factDef = [];
  var tableProps = [];
  var inTableData = false;
  var tt = [];
  var pos;

  var c = new ConceptObj(db, file);
	var input = fs.createReadStream(file);
  var remaining = '';

  input.on('data', function(data) {
    remaining += data;
    var index = remaining.indexOf('\n');
    var concept = str("");
    var tc, words;

    while (index > -1) {
      var line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);

      var nline = str(line).trimLeft();
      var pos = nline.indexOf('concept:');
      if (pos === 0) {
      	tc = str(nline).between('concept:',"(").trim();
        // Some lines have extra leading descriptors
        words = tc.split(" ");

        if (isConcept(words[0])) {
          c.highLevelConcepts.pushUnique(prepConcept(words[0]));
        }

        cConcept = findOrCreateConcept(str(words[0]));
        addConcepts(cConcept, nline);

      } else {

        if (cConcept) {
          addConcepts(cConcept, nline);
        } else {
          pos = nline.indexOf('table:');
          if (pos === 0) {
            // Reset the Fact Tables
            factDef = [];
            inTableData = false;
            tc = str(nline).between('table:',"(").trim();
            words = tc.split(" ");
            debug("Table", words[0]);
            c.tables.pushUnique(str(words[0]).chompLeft("~").toLowerCase().trim().s);
            tableArgs = (str(nline).between("(",")").trim()).split(" ").filter(function(e){return e;});
            debug("TableArgs", tableArgs);
          } else {

            // Deliberatly skip the check (missing the DATA line)
            if (inTableData) {
              // Skip comments
              if (nline.indexOf('#') == -1) {
                addTableData(nline);
              }
            } else {
              pos = nline.indexOf('^createfact');
              if (pos === 0) {
                factDef.push((str(nline).between("(",")").trim()).split(" "));
                debug("factDef", factDef);
              }
            }

            var td = nline.indexOf('DATA:');
            if (td === 0) {
              inTableData = true;
            }
          }
        }
      }
      index = remaining.indexOf('\n');
    }
  });

  input.on('end', function() {
    if (remaining.length > 0) {
      var nline = str(remaining).trimLeft();
      var pos = nline.indexOf('concept:');

      if (pos === 0) {
        var tc = str(nline).between('concept:',"(").trim();
        // Some lines have extra leading descriptors
        var words = tc.split(" ");

        if (isConcept(words[0])) {
          c.highLevelConcepts.pushUnique(prepConcept(words[0]));
        }

        cConcept = findOrCreateConcept(str(words[0]));
        addConcepts(cConcept, nline);
      } else {
        addConcepts(cConcept, nline);
      }
    }
    debug("Added # Facts", factCount);
    factCount = 0;
    cb(c);
  });

  var findOrCreateConcept = function(term, concept) {

    if (isConcept(term)) {
      c.referencedConcepts.pushUnique(prepConcept(term));
    }

    var nc = term.chompLeft("~").toLowerCase().trim();
    return nc.s;
  };

  var addTableData = function(line, args) {

    var buff = [], ia = false, ha = false, qw = false, i = 0, d = {}, nconcept;
    if (line.s !== "") {
      var l = line.s;

      for (var n = 0; n < line.length; n++) {

        if (/[~a-z0-9-._']/i.test(l[n]) || ia || qw) {
          buff.push(l[n]);
          if (l[n] == '"') {
            qw = false;
            buff.pop();
          }
          if (l[n] == ']') {
            ia = false;
            buff.pop();
          }
        } else if (l[n] == '"') {
          qw = true;
        } else if (l[n] == '[') {
          ia = true;
          ha = true;
        } else {
          nconcept = buff.join("");

          if (nconcept !== "") {
            if (ha) {
              d[tableArgs[i]] = parseArray(nconcept);
            } else {
              d[tableArgs[i]] = nconcept;
            }
            ha = false;
            i++;
            buff = [];
            if (i == tableArgs.length) {
              addFact(d);
            }
          }
        }
      }

      if (buff.length !== 0) {
        nconcept = buff.join("");
        if (ha) {
          d[tableArgs[i]] = parseArray(nconcept);
        } else {
          d[tableArgs[i]] = nconcept;
        }
        i++;

        if (i == tableArgs.length) {
          addFact(d);
        }
      }
    }
  };

  var isConcept = function(term) {
    if (_.isString(term) || _.isString(term.s)) {
      return (term.indexOf("~") != -1) ? true : false;
    } else  {
      return false;
    }
  };

  var prepConcept = function(term) {
    return str(term).chompLeft("~").toLowerCase().trim().s;
  };

  var factCount = 0, i = 0;
  var addFact = function(def) {
     if (factDef) {
      for (var i = 0; i < factDef.length; i++ ) {

        if (factDef[i].length == 3) {

          var p0 = (def[factDef[i][0]]) ? def[factDef[i][0]] : factDef[i][0];
          var p1 = (def[factDef[i][1]]) ? def[factDef[i][1]] : factDef[i][1];
          var p2 = (def[factDef[i][2]]) ? def[factDef[i][2]] : factDef[i][2];

          if (_.isArray(p0) || _.isArray(p2)) {
            if (_.isArray(p0)) {
              for (i = 0; i < p0.length; i++) {
                if (isConcept(p0[i])) c.referencedConcepts.pushUnique(prepConcept(p0[i]));
                if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
                if (isConcept(p2)) c.referencedConcepts.pushUnique(prepConcept(p2));
                c.createfact(p0[i], p1, prepConcept(p2));
                factCount++;
              }
            }
            if (_.isArray(p2)) {
              for (i = 0; i < p2.length; i++) {
                if (isConcept(p0)) c.referencedConcepts.pushUnique(prepConcept(p0));
                if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
                if (isConcept(p2[i])) c.referencedConcepts.pushUnique(prepConcept(p2[i]));
                c.createfact(p0, p1, prepConcept(p2[i]));
                factCount++;
              }
            }
          } else {

            if (isConcept(p0)) c.referencedConcepts.pushUnique(prepConcept(p0));
            if (isConcept(p1)) c.referencedConcepts.pushUnique(prepConcept(p1));
            if (isConcept(p2)) c.referencedConcepts.pushUnique(prepConcept(p2));

            c.createfact(p0, p1, prepConcept(p2));
            factCount++;
          }
        }
      }
    }
  };

  var parseArray = function(line) {
    var buff = [], qw = false, ar = [];
    for (var n = 0; n < line.length; n++) {

      if (/[~a-z0-9-_']/i.test(line[n]) || qw ) {
        buff.push(line[n]);
        if (line[n] == '"') {
          buff.pop();
          qw = false;
        }
      } else if (line[n] == '"') {
        qw = true;
      } else {
        if (buff.join("") !== "") {
          ar.push(buff.join(""));
        }
        buff = [];
      }
    }
    // Flush the remaining items from the buffer
    if (buff.length !== 0) {
      ar.push(buff.join(""));
    }

    return ar;
  };

  // Adds the Concept line, minus the main concept
  var addConcepts = function(cConcept, line) {
    var buff = [], qw = false;
    var l2 = str(line).between("(");
    var p = str(l2.s).indexOf("#");

    var eol = l2.length;
    if(p != -1) {
      eol = p-1;
    }

    for (var n = 0; n < eol; n++) {
      if (/[~a-z0-9-_']/i.test(l2.s[n]) || qw) {
        buff.push(l2.s[n]);
        if (l2.s[n] == '"') {
          buff.pop();
          qw = false;
        }
      } else if (l2.s[n] == '"') {
        qw = true;
      } else {
        var nconcept = buff.join("");
        if (nconcept !== "" && cConcept) {

          var cleanConcept = prepConcept(cConcept);
          var cleanRel = prepConcept(nconcept);
          c.createfact(cleanConcept, "example", cleanRel);
          c.createfact(cleanRel, "isa", cleanConcept);
        }
        buff = [];
      }
    }
  };
};

Array.prototype.pushUnique = function (item){
  if(this.indexOf(item) == -1) {
    this.push(item);
    return true;
  }
  return false;
};

// This is the same as read file, but it reads an array of files
exports.readFiles = function(files, db, callback) {

  var itor = function(file, next) {
    readFile(file, db, function(con) {

      // Add the reference concepts
      for (var i = 0; i < con.referencedConcepts.length; i++) {
        con.createfact(con.referencedConcepts[i], 'isa', 'concept');
      }

      next(null, con);
    });
  };

  async.mapSeries(files, itor, function(err, conceptMap){
    callback(err, conceptMap);
  });
};
