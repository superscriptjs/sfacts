
var mocha = require("mocha");
var should  = require("should");
var rmdir = require("rmdir");
var facts = require("../");
var gFacts;

var data = ['./test/data/concepts_sm.top']

describe('SuperScript substitution Interface', function(){

  before(function(done){
    facts.load(data, 'systemDB', function(err, sfacts){
      gFacts = sfacts;
      done();
    });
  });
 
  describe('Find Knowledge', function(){
    
    // Given a concept, lets get all words that reference this concept
    it("expand terms - simple", function(done) {
      gFacts.conceptToList("air", function(err, items){
        items.should.have.length(3);
        items.should.eql([ 'air', 'atmosphere', 'oxygen' ]);
        done();  
      });
    });

    // Concepts can reference other concepts, they should be merged in too
    it("expand terms - reference concept nest", function(done) {
      gFacts.conceptToList("adult", function(err, items){
        items.should.have.length(46);
        done();
      });
    });

    it("find parent concept", function(done) {
      gFacts.findParentConcepts("children", function(err, concept){
        concept[0].should.eql('age_gender');
        done();
      });
    });

    it("find parent concept 1", function(done) {
      gFacts.findParentConcepts("step-mother", function(err, concept){
        concept.should.eql([ 'family_adult_female', 'mother']);
        done();
      });
    });
    

    it("load new file", function(done) {
      var files = ['./test/data/names.top']
      gFacts.loadFile(files, function(err, concept){
        gFacts.findParentConcepts("sydney", function(e,r){
          r.should.eql(['girl_names'])
          done();
        });
      });
    });

  });

  after(function(done){
    rmdir('systemDB', function(){
      done();
    });
  });
});


// var sfacts = facts.create("systemDB");
// var userA = sfacts.createUserDB("userA").db;
// var userB = sfacts.createUserDB("userB").db;

// sfacts.db.put({subject:"global", predicate:"name", object : "user" })

// var triple1 = {subject:"my", predicate:"name", object : "Rob" };
// var triple2 = {subject:"my", predicate:"name", object : "Jane" };

// userA.put(triple1, function(){
// 	userB.put(triple2, function(){
// 		console.log("Done");
// 		process.exit();
// 	});
// });

// sfacts.db.on('put',function(op){
// 	console.log("Fired")	
// })

// var gtriple = {subject:"my", predicate:"name"};

// // SOme time later
// userA.get(gtriple, function(e,r){
// 	console.log(e,r);
// 	userB.get(gtriple, function(e,r){
// 		console.log(e,r);
// 		console.log("Done");

// 		sfacts.db.get({}, function(e,r){
// 			console.log(r);
// 			process.exit();
// 		})
		
// 	});
// });
