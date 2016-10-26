import facts from '../';

describe('System', () => {
  it('should create a database.', (done) => {
    facts.create('systemDB2', (err) => {
      facts.db('systemDB2').close((err) => {
        done();
      });
    });
  });

  it('should create a database synchronously.', (done) => {
    const db = facts.create('systemDB3');
    const openCheckInterval = setInterval(() => {
      if (db.db.isOpen()) {
        clearInterval(openCheckInterval);
        facts.db('systemDB3').close((err) => {
          done();
        }, 100);
      }
    });
  });
});
