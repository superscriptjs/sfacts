/* global describe before it */
import should from 'should';
import facts from '../src/system';

let gFacts;

const data = ['./test/data/concepts_sm.top', './test/data/animals.tbl'];

describe('Substitution Interface', () => {
  before((done) => {
    facts.load('systemDB', data, true, (err, sfacts) => {
      if (err) {
        return done(err);
      }
      gFacts = sfacts;
      done();
    });
  });

  describe('Find Knowledge', () => {
    // Given a concept, lets get all words that reference this concept
    it('expand terms - simple', (done) => {
      gFacts.conceptToList('air', (err, items) => {
        if (err) {
          return done(err);
        }
        items.should.have.length(3);
        items.should.eql(['air', 'atmosphere', 'oxygen']);
        done();
      });
    });

    // Concepts can reference other concepts, they should be merged in too
    it('expand terms - reference concept nest', (done) => {
      gFacts.conceptToList('adult', (err, items) => {
        if (err) {
          return done(err);
        }
        items.should.have.length(46);
        done();
      });
    });

    it('find parent concept', (done) => {
      gFacts.findParentConcepts('children', (err, concept) => {
        if (err) {
          return done(err);
        }
        concept[0].should.eql('age_gender');
        done();
      });
    });

    it('find parent concept 1', (done) => {
      gFacts.findParentConcepts('step-mother', (err, concept) => {
        if (err) {
          return done(err);
        }
        concept.should.eql(['family_adult_female', 'mother']);
        done();
      });
    });

    it('load new file', (done) => {
      const files = ['./test/data/names.top'];
      gFacts.loadFiles(files, (err, concept) => {
        if (err) {
          return done(err);
        }
        gFacts.findParentConcepts('sydney', (e, r) => {
          if (e) {
            return done(e);
          }
          r.should.eql(['girl_names']);
          done();
        });
      });
    });
  });
});
