import { expect } from 'chai';
import { ddb } from '../../lib';

describe('dynamodb', function() {
  describe('list', function() {
    it('returns an empty array', function() {
      return ddb('listTables')
        .then(res => {
          return Promise.all([
            expect(res).not.to.be.undefined,
            expect(res.TableNames).to.be.an('array')
          ]);
        });
    });
  });
});
//
// import DdbLocal from 'ddb-local';
//
// describe('ddb', function () {
//   this.timeout(10000);
//
//   var ddblocal = new DdbLocal();
//
//   before(function (done) {
//     ddblocal.start(done);
//   });
//
//   describe('list', function() {
//     it('returns an empty array', function() {
//       return ddb('listTables')
//         .then(res => {
//           return Promise.all([
//             expect(res).not.to.be.undefined,
//             expect(res.TableNames).to.be.an('array')
//           ]);
//         });
//     });
//   });
//
//   after(function (done) {
//     ddblocal.stop(done);
//   });
// });