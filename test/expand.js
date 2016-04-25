var should  = require("should");
var rmdir = require("rmdir");
var facts = require("../");
var gFacts;

var data = ['./test/data/concepts_sm.top'];

describe('Expand', function(){

  before(function(done){
    facts.load(data, 'expandDB', function(err, sfacts){
      if(err) {
        return done(err);
      }
      gFacts = sfacts;
      done();
    });
  });

  it("should create a user database.", function() {
    var userDB = gFacts.createUserDB("SOME_USER_ID");
  });

  it("should create a user database with data", function(done) {
    var files = ['./test/data/names.top'];
    var userDBWithData = gFacts.createUserDBWithData("ANOTHER_USER_ID", files, function(err, db){
      done(err);
    });
  });

  after(function(done){
    facts.db('expandDB').close(function(err){
      rmdir('expandDB', function(){
        done();
      });
    });
  });

});
