import { expect } from 'chai';
import { fn } from '../../lib';

describe('ddb', function() {
  describe('list', function() {
    it('returns an array', function() {
      // return ddb.ddb('listTables')
      //   .then(res => {
      //     return Promise.all([
      //       expect(res).not.to.be.undefined,
      //       expect(res.TableNames).to.be.an('array')
      //     ]);
      //   });
      expect(fn(2)).to.equal(3);
    });
  });
});