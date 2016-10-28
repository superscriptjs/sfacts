import facts from '../src/system';

describe('System', () => {
  it('should create a database.', (done) => {
    facts.create('systemDB2', (err, db) => {
      db.db.close((err) => {
        done();
      });
    });
  });

  it('should create a database synchronously.', (done) => {
    const db = facts.create('systemDB3');
    const openCheckInterval = setInterval(() => {
      if (db.db.isOpen()) {
        clearInterval(openCheckInterval);
        db.db.close((err) => {
          done();
        }, 100);
      }
    });
  });
});
