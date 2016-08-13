import dynalite from 'dynalite';

const dynaliteServer = dynalite({path: './.dynamodb', createTableMs: 0});
const DYNALITE_PORT = 8000;

// Listen on port 4567
dynaliteServer.listen(DYNALITE_PORT, function(err) {
  if (err) throw err;
  
  console.log(`Dynalite started on port ${DYNALITE_PORT}`);
});