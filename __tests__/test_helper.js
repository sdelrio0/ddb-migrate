import dynalite from 'dynalite';

const dynaliteServer = dynalite({createTableMs: 0});
const DYNALITE_PORT = 8000;

dynaliteServer.listen(DYNALITE_PORT, function(err) {
  if (err) throw err;
  
  console.log(`Dynalite started on port ${DYNALITE_PORT}`);
});

// before(function(done) {
//   this.timeout(200000);
//
//   dynaliteServer.listen(DYNALITE_PORT, function(err) {
//     console.log(`Dynalite started on port ${DYNALITE_PORT}`);
//     if (err) return done(err);
//   });
// });
//
// after(function(done) {
//   this.timeout(200000);
//   dynaliteServer.close(done);
// });