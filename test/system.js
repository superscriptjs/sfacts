var rmdir = require("rmdir");
var facts = require("../");

describe('System', function(){

  it("should create a database.", function(done) {
    facts.create('systemDB2', function(err){
      facts.db('systemDB2').close(function(err){
        rmdir('systemDB2', function(){
          done();
        });
      });
    });
  });

  it("should create a database synchronously.", function(done) {
    var db = facts.create('systemDB3');
    var openCheckInterval = setInterval(function(){
      if(db.db.isOpen()) {
        clearInterval(openCheckInterval);
        facts.db('systemDB3').close(function(err){
          rmdir('systemDB3', function(){
            done();
          });
        }, 100);
      }
    })
  });

});
