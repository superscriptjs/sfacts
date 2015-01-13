var debug = require('debug')("Server");
var data = ['./test/data/concepts.top'];

var facts = require("../");

var f = facts.explore('testfacts')
f.conceptToList("family_members", function(e,r) {
  console.log("--", r);
});


// facts.load(data, 'testfacts', function(err, f) {  
//   f.conceptToList("family_members", function(e,r) {
//     console.log("--", e,r);
//   });
// });

