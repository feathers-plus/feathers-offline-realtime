
const assert = require('chai').assert;
const feathers = require('@feathersjs/feathers');
const memory = require('feathers-memory');

const sampleLen = 5;

let app;

function services1 () {
  const app = this;

  app.configure(fromServiceNonPaginatedConfig);
}

function fromServiceNonPaginatedConfig () {
  const app = this;

  app.use('/from', memory({}));
}

export default function (Replicator, desc, useUuid) {
  describe(`${desc} - mutations ${useUuid ? 'using uuid' : 'using id'}`, () => {
    let data;
    let fromService;
    let replicator;

    beforeEach(() => {
      app = feathers()
        .configure(services1);

      fromService = app.service('from');

      data = [];
      for (let i = 0, len = sampleLen; i < len; i += 1) {
        data.push({ id: i, uuid: 1000 + i, order: i });
      }
    });

    describe('without publication', () => {
      beforeEach(() => {
        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, { sort: Replicator.sort('order'), useUuid });
          });
      });

      it('create works', () => {
        return replicator.connect()
          .then(() => fromService.create({ id: 99, uuid: 1099, order: 99 }))
          .then(() => {
            const records = replicator.store.records;
            data[sampleLen] = { id: 99, uuid: 1099, order: 99 };

            assert.lengthOf(records, sampleLen + 1);
            assert.deepEqual(records, data);
          });
      });

      it('update works', () => {
        return replicator.connect()
          .then(() => fromService.update(0, { id: 0, uuid: 1000, order: 99 }))
          .then(() => {
            const records = replicator.store.records;
            data.splice(0, 1);
            data[data.length] = { id: 0, uuid: 1000, order: 99 };

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          });
      });

      it('patch works', () => {
        return replicator.connect()
          .then(() => fromService.patch(1, { order: 99 }))
          .then(() => {
            const records = replicator.store.records;
            data.splice(1, 1);
            data[data.length] = { id: 1, uuid: 1001, order: 99 };

            assert.lengthOf(records, sampleLen);
            assert.deepEqual(records, data);
          });
      });

      it('remove works', () => {
        return replicator.connect()
          .then(() => fromService.remove(2))
          .then(() => {
            const records = replicator.store.records;
            data.splice(2, 1);

            assert.lengthOf(records, sampleLen - 1);
            assert.deepEqual(records, data);
          });
      });
    });

    describe('within publication', () => {
      const testLen = 4;

      beforeEach(() => {
        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              publication: record => record.order <= 3.5,
              useUuid
            });

            data.splice(testLen);
          });
      });

      it('create works', () => {
        return replicator.connect()
          .then(() => fromService.create({ id: 99, uuid: 1099, order: 3.5 }))
          .then(() => {
            const records = replicator.store.records;
            data[testLen] = { id: 99, uuid: 1099, order: 3.5 };

            assert.lengthOf(records, testLen + 1);
            assert.deepEqual(records, data);
          });
      });

      it('update works', () => {
        return replicator.connect()
          .then(() => fromService.update(0, { id: 0, uuid: 1000, order: 3.5 }))
          .then(() => {
            const records = replicator.store.records;
            data.splice(0, 1);
            data[data.length] = { id: 0, uuid: 1000, order: 3.5 };

            assert.lengthOf(records, testLen);
            assert.deepEqual(records, data);
          });
      });

      it('patch works', () => {
        return replicator.connect()
          .then(() => fromService.patch(1, { order: 1.1 }))
          .then(() => {
            const records = replicator.store.records;
            data[1] = { id: 1, uuid: 1001, order: 1.1 };

            assert.lengthOf(records, testLen);
            assert.deepEqual(records, data);
          });
      });

      it('remove works', () => {
        return replicator.connect()
          .then(() => fromService.remove(2))
          .then(() => {
            const records = replicator.store.records;
            data.splice(2, 1);

            assert.lengthOf(records, testLen - 1);
            assert.deepEqual(records, data);
          });
      });
    });

    describe('outside publication', () => {
      const testLen = 4;

      beforeEach(() => {
        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              publication: record => record.order <= 3.5,
              useUuid
            });

            data.splice(testLen);
          });
      });

      it('create works', () => {
        return replicator.connect()
          .then(() => fromService.create({ id: 99, uuid: 1099, order: 99 }))
          .then(() => {
            const records = replicator.store.records;

            assert.lengthOf(records, testLen);
            assert.deepEqual(records, data);
          });
      });

      it('update works', () => {
        return replicator.connect()
          .then(() => fromService.update(4, { id: 4, uuid: 1004, order: 99 }))
          .then(() => {
            const records = replicator.store.records;

            assert.lengthOf(records, testLen);
            assert.deepEqual(records, data);
          });
      });

      it('patch works', () => {
        return replicator.connect()
          .then(() => fromService.patch(4, { order: 99 }))
          .then(() => {
            const records = replicator.store.records;

            assert.lengthOf(records, testLen);
            assert.deepEqual(records, data);
          });
      });

      it('remove works', () => {
        return replicator.connect()
          .then(() => fromService.remove(4))
          .then(() => {
            const records = replicator.store.records;

            assert.lengthOf(records, testLen);
            assert.deepEqual(records, data);
          });
      });
    });

    describe('moving in/out publication', () => {
      const testLen = 4;

      beforeEach(() => {
        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              publication: record => record.order <= 3.5,
              useUuid
            });

            data.splice(testLen);
          });
      });

      it('patching to without', () => {
        return replicator.connect()
          .then(() => fromService.patch(1, { order: 99 }))
          .then(() => {
            const records = replicator.store.records;
            data.splice(1, 1);

            assert.lengthOf(records, testLen - 1);
            assert.deepEqual(records, data);
          });
      });

      it('patching to within', () => {
        return replicator.connect()
          .then(() => fromService.patch(4, { order: 3.5 }))
          .then(() => {
            const records = replicator.store.records;
            data[testLen] = { id: 4, uuid: 1004, order: 3.5 };

            assert.lengthOf(records, testLen + 1);
            assert.deepEqual(records, data);
          });
      });
    });
  });
}

// Helpers

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}
