import facts from '../src/system';

describe('System', () => {
  it('should create a database.', (done) => {
    facts.create('systemDB2', false, (err, factSystem) => {
      factSystem.db.close((err) => {
        done();
      });
    });
  });

  it('should clean database.', (done) => {
    const data = ['./test/data/concepts_sm.top', './test/data/animals.tbl'];
    facts.load('systemDB3', data, false, (err, factSystem) => {
      if (err) {
        return done(err);
      }
      facts.clean('systemDB3', (err2) => {
        if (err2) {
          return done(err2);
        }
        return done();
      });
    });
  });
});
