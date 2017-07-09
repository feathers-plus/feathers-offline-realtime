
const assert = require('chai').assert;
const feathers = require('feathers');
const memory = require('feathers-memory');
const hooks = require('feathers-hooks');
const errors = require('feathers-errors');

const optimisticMutator = require('../../../src/optimistic-mutator');

const sampleLen = 5;

let app;
let clientService;

function services1 () {
  app = this;

  app.configure(fromServiceNonPaginatedConfig);
}

function fromServiceNonPaginatedConfig () {
  const app = this;

  app.use('/from', memory({}));

  app.service('from').hooks({
    before: {
      all: context => {
        if (context.params.query && context.params.query._fail) {
          throw new errors.BadRequest('Fail requested');
        }
      }
    }
  });
}

export default function (Replicator, desc) {
  describe(`${desc} - optimistic mutation online`, () => {
    let data;
    let fromService;
    let replicator;

    beforeEach(() => {
      const app = feathers()
        .configure(hooks())
        .configure(services1);

      fromService = app.service('from');

      data = [];
      for (let i = 0, len = sampleLen; i < len; i += 1) {
        data.push({ id: i, uuid: 1000 + i, order: i });
      }
    });

    describe('not connected', () => {
      let events;

      beforeEach(() => {
        events = [];

        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, { sort: Replicator.sort('order'), uuid: true });

            app.use('clientService', optimisticMutator({ replicator }));

            clientService = app.service('clientService');

            replicator.on('events', (records, last) => {
              events[events.length] = last;
            });
          });
      });

      it('create fails', () => {
        return clientService.create({ id: 99, uuid: 1099, order: 99 })
          .then(() => {
            assert(false, 'Unexpectedly succeeded.');
          })
          .catch(err => {
            assert.equal(err.className, 'bad-request');
          });
      });
    });

    describe('without publication', () => {
      let events;

      beforeEach(() => {
        events = [];

        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, { sort: Replicator.sort('order'), uuid: true });

            app.use('clientService', optimisticMutator({ replicator }));

            clientService = app.service('clientService');

            replicator.on('events', (records, last) => {
              events[events.length] = last;
            });
          });
      });

      it('find works', () => {
        return replicator.connect()
          .then(() => clientService.find({ query: { order: { $lt: 3 } } }))
          .then(result => {
            const records = replicator.store.records;

            assert.deepEqual(result, data.slice(0, 3));
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('get works', () => {
        return replicator.connect()
          .then(() => clientService.get(1000))
          .then(result => {
            const records = replicator.store.records;

            assert.deepEqual(result, { id: 0, uuid: 1000, order: 0 });
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('create works', () => {
        return replicator.connect()
          .then(() => clientService.create({ id: 99, uuid: 1099, order: 99 }))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;

            data[sampleLen] = { id: 99, uuid: 1099, order: 99 };

            assert.deepEqual(result, { id: 99, uuid: 1099, order: 99 });
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 99 } },
              { source: 0, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 99 } }
            ]);

            assert.lengthOf(records, sampleLen + 1);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('create adds missing uuid', () => {
        return replicator.connect()
          .then(() => clientService.create({ id: 99, order: 99 }))
          .then(data => {
            assert.isString(data.uuid);
          })
          .then(() => replicator.disconnect());
      });

      it('update works', () => {
        return replicator.connect()
          .then(() => clientService.update(1000, { id: 0, uuid: 1000, order: 99 }))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;
            data.splice(0, 1);
            data[data.length] = { id: 0, uuid: 1000, order: 99 };

            assert.deepEqual(result, { id: 0, uuid: 1000, order: 99 });
            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'updated', action: 'mutated', record: { id: 0, uuid: 1000, order: 99 } },
              { source: 0, eventName: 'updated', action: 'mutated', record: { id: 0, uuid: 1000, order: 99 } }
            ]);
          });
      });

      it('patch works', () => {
        return replicator.connect()
          .then(() => clientService.patch(1001, { order: 99 }))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;
            data.splice(1, 1);
            data[data.length] = { id: 1, uuid: 1001, order: 99 };

            assert.deepEqual(result, { id: 1, uuid: 1001, order: 99 });
            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'patched', action: 'mutated', record: { id: 1, uuid: 1001, order: 99 } },
              { source: 0, eventName: 'patched', action: 'mutated', record: { id: 1, uuid: 1001, order: 99 } }
            ]);
          });
      });

      it('remove works', () => {
        return replicator.connect()
          .then(() => clientService.remove(1002))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;
            data.splice(2, 1);

            assert.deepEqual(result, { id: 2, uuid: 1002, order: 2 });
            assert.lengthOf(records, sampleLen - 1);
            assert.deepEqual(records, data);

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'removed', action: 'remove', record: { id: 2, uuid: 1002, order: 2 } },
              { source: 0, eventName: 'removed', action: 'remove', record: { id: 2, uuid: 1002, order: 2 } }
            ]);
          });
      });
    });

    describe('without publication, null id', () => {
      let events;

      beforeEach(() => {
        events = [];

        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, {sort: Replicator.sort('order'), uuid: true});

            app.use('clientService', optimisticMutator({replicator}));

            clientService = app.service('clientService');

            replicator.on('events', (records, last) => {
              events[events.length] = last;
            });
          });
      });

      it('create works', () => {
        return replicator.connect()
          .then(() => clientService.create([
            { id: 98, uuid: 1098, order: 98 },
            { id: 99, uuid: 1099, order: 99 }
          ]))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;

            data[sampleLen] = { id: 98, uuid: 1098, order: 98 };
            data[sampleLen + 1] = { id: 99, uuid: 1099, order: 99 };

            assert.deepEqual(result, [
              { id: 98, uuid: 1098, order: 98 },
              { id: 99, uuid: 1099, order: 99 }
            ]);
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'created', action: 'mutated', record: { id: 98, uuid: 1098, order: 98 } },
              { source: 1, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 99 } },
              { source: 0, eventName: 'created', action: 'mutated', record: { id: 98, uuid: 1098, order: 98 } },
              { source: 0, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 99 } }
            ]);

            assert.lengthOf(records, sampleLen + 2);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('patch works', () => {
        return replicator.connect()
          .then(() => clientService.patch(null, { foo: 1 }, { query: { order: { $gt: 0, $lt: 4 } } }))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;

            data[1].foo = 1;
            data[2].foo = 1;
            data[3].foo = 1;

            assert.deepEqual(result, [
              { id: 1, uuid: 1001, order: 1, foo: 1 },
              { id: 2, uuid: 1002, order: 2, foo: 1 },
              { id: 3, uuid: 1003, order: 3, foo: 1 }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'patched', action: 'mutated', record: { id: 1, uuid: 1001, order: 1, foo: 1 } },
              { source: 1, eventName: 'patched', action: 'mutated', record: { id: 2, uuid: 1002, order: 2, foo: 1 } },
              { source: 1, eventName: 'patched', action: 'mutated', record: { id: 3, uuid: 1003, order: 3, foo: 1 } },
              { source: 0, eventName: 'patched', action: 'mutated', record: { id: 1, uuid: 1001, order: 1, foo: 1 } },
              { source: 0, eventName: 'patched', action: 'mutated', record: { id: 2, uuid: 1002, order: 2, foo: 1 } },
              { source: 0, eventName: 'patched', action: 'mutated', record: { id: 3, uuid: 1003, order: 3, foo: 1 } }
            ]);
          });
      });

      it('remove works', () => {
        return replicator.connect()
          .then(() => clientService.remove(null, { query: { order: { $gt: 0, $lt: 4 } } }))
          .then(delay())
          .then(result => {
            const records = replicator.store.records;
            data.splice(1, 3);

            assert.deepEqual(result, [
              { id: 1, uuid: 1001, order: 1 },
              { id: 2, uuid: 1002, order: 2 },
              { id: 3, uuid: 1003, order: 3 }
            ]);

            assert.lengthOf(records, sampleLen - 3);
            assert.deepEqual(records, data);

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'removed', action: 'remove', record: { id: 1, uuid: 1001, order: 1 } },
              { source: 1, eventName: 'removed', action: 'remove', record: { id: 2, uuid: 1002, order: 2 } },
              { source: 1, eventName: 'removed', action: 'remove', record: { id: 3, uuid: 1003, order: 3 } },
              { source: 0, eventName: 'removed', action: 'remove', record: { id: 1, uuid: 1001, order: 1 } },
              { source: 0, eventName: 'removed', action: 'remove', record: { id: 2, uuid: 1002, order: 2 } },
              { source: 0, eventName: 'removed', action: 'remove', record: { id: 3, uuid: 1003, order: 3 } }
            ]);
          });
      });
    });

    describe('without publication & remote error', () => {
      let events;

      beforeEach(() => {
        events = [];

        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, { sort: Replicator.sort('order'), uuid: true });

            app.use('clientService', optimisticMutator({ replicator }));

            clientService = app.service('clientService');

            replicator.on('events', (records, last) => {
              events[events.length] = last;
            });
          });
      });

      it('get fails correctly', () => {
        return replicator.connect()
          .then(() => clientService.get(9999))
          .then(() => {
            assert(false, 'Unexpectedly succeeded');
          })
          .catch(err => {
            assert.equal(err.className, 'not-found');
          })
          .then(() => replicator.disconnect());
      });

      it('create recovers', () => {
        return replicator.connect()
          .then(() => clientService.create({ id: 99, uuid: 1099, order: 99 }, { query: { _fail: true } }))
          .then(delay())
          .then(() => {
            const records = replicator.store.records;

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 99 } },
              { source: 2, eventName: 'removed', action: 'remove', record: { id: 99, uuid: 1099, order: 99 } }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('update recovers', () => {
        return replicator.connect()
          .then(() => clientService.update(1000, { id: 0, uuid: 1000, order: 99 }, { query: { _fail: true } }))
          .then(delay())
          .then(() => {
            const records = replicator.store.records;

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'updated', action: 'mutated', record: { id: 0, uuid: 1000, order: 99 } },
              { source: 2, eventName: 'updated', action: 'mutated', record: { id: 0, uuid: 1000, order: 0 } }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('patch recovers', () => {
        return replicator.connect()
          .then(() => clientService.patch(1001, { order: 99 }, { query: { _fail: true } }))
          .then(delay())
          .then(() => {
            const records = replicator.store.records;

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'patched', action: 'mutated', record: { id: 1, uuid: 1001, order: 99 } },
              { source: 2, eventName: 'updated', action: 'mutated', record: { id: 1, uuid: 1001, order: 1 } }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });

      it('remove recovers', () => {
        return replicator.connect()
          .then(() => clientService.remove(1002, { query: { _fail: true } }))
          .then(delay())
          .then(() => {
            const records = replicator.store.records;

            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 1, eventName: 'removed', action: 'remove', record: { id: 2, uuid: 1002, order: 2 } },
              { source: 2, eventName: 'created', action: 'mutated', record: { id: 2, uuid: 1002, order: 2 } }
            ]);

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          })
          .then(() => replicator.disconnect());
      });
    });
  });
}

// Helpers

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}

function delay (ms = 0) {
  return data => new Promise(resolve => {
    setTimeout(() => {
      resolve(data);
    }, ms);
  });
}
