import dynalite from 'dynalite';

const dynaliteServer = dynalite({createTableMs: 0});
const DYNALITE_PORT = 5798;

dynaliteServer.listen(DYNALITE_PORT, function(err) {
  if (err) throw err;
  console.log(`Dynalite started on port ${DYNALITE_PORT}`);
});