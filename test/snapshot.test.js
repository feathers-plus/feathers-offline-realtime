
const assert = require('chai').assert;
const feathers = require('feathers');
const memory = require('feathers-memory');
const hooks = require('feathers-hooks');

const Realtime = require('../src');

const sampleLen = 25;
let data;
let fromService;
let fromServicePaginated;

function services1 () {
  const app = this;

  app.configure(fromServiceNonPaginatedConfig);
  app.configure(fromServicePaginatedConfig);
}

function fromServiceNonPaginatedConfig () {
  const app = this;

  app.use('/from', memory({}));
}

function fromServicePaginatedConfig () {
  const app = this;

  app.use('/frompaginated', memory({
    paginate: {
      default: 2,
      max: 3
    }
  }));
}

describe('realtime', () => {
  describe('sorts', () => {
    let dataOrder;
    let dataId;
    let dataIdOrder;
    let dataIdXOrder;

    beforeEach(() => {
      data = [
        { id: 'q', order: 5 },
        { id: 'a', order: 9 },
        { id: 'z', order: 1 },
        { id: 'q', order: 3 }
      ];

      dataOrder = [
        { id: 'z', order: 1 },
        { id: 'q', order: 3 },
        { id: 'q', order: 5 },
        { id: 'a', order: 9 }
      ];

      dataId = [
        { id: 'a', order: 9 },
        { id: 'q', order: 5 },
        { id: 'q', order: 3 },
        { id: 'z', order: 1 }
      ];

      dataIdOrder = [
        { id: 'a', order: 9 },
        { id: 'q', order: 3 },
        { id: 'q', order: 5 },
        { id: 'z', order: 1 }
      ];

      dataIdXOrder = [
        { id: 'z', order: 1 },
        { id: 'q', order: 3 },
        { id: 'q', order: 5 },
        { id: 'a', order: 9 }
      ];
    });

    it('single sort works', () => {
      assert.deepEqual(data.sort(Realtime.sort('order')), dataOrder);
    });

    it('single sort is stable', () => {
      assert.deepEqual(data.sort(Realtime.sort('id')), dataId);
    });

    it('multiple sort works', () => {
      assert.deepEqual(data.sort(Realtime.multiSort({ id: 1, order: 1 })), dataIdOrder);
    });

    it('multiple sort order works', () => {
      assert.deepEqual(data.sort(Realtime.multiSort({ id: -1, order: 1 })), dataIdXOrder);
    });
  });

  describe('snapshot', () => {
    beforeEach(() => {
      const app = feathers()
        .configure(hooks())
        .configure(services1);

      fromService = app.service('from');
      fromServicePaginated = app.service('frompaginated');

      data = [];
      for (let i = 0, len = sampleLen; i < len; i += 1) {
        data.push({ id: i, order: i });
      }

      return Promise.all([
        fromService.create(data),
        fromServicePaginated.create(data)
      ]);
    });

    it('non-paginated file', () => {
      const realtime = new Realtime(fromService);

      return realtime.connect()
        .then(() => {
          const records = realtime.store.records;
          assert.lengthOf(records, sampleLen);

          assert.deepEqual(records.sort(Realtime.sort('order')), data);
        });
    });

    it('paginated file', () => {
      const realtime = new Realtime(fromServicePaginated);

      return realtime.connect()
        .then(() => {
          const records = realtime.store.records;
          assert.lengthOf(records, sampleLen);

          assert.deepEqual(records.sort(Realtime.sort('order')), data);
        });
    });

    it('query works', () => {
      const query = { order: { $lt: 15 } };
      const realtime = new Realtime(fromServicePaginated, { query });

      return realtime.connect()
        .then(() => {
          const records = realtime.store.records;
          assert.lengthOf(records, 15);

          assert.deepEqual(records.sort(Realtime.sort('order')), data.slice(0, 15));
        });
    });

    it('publication works', () => {
      const query = { order: { $lt: 15 } };
      const publication = record => record.order < 10;
      const realtime = new Realtime(fromService, { query, publication });

      return realtime.connect()
        .then(() => {
          const records = realtime.store.records;
          assert.lengthOf(records, 10);

          assert.deepEqual(records.sort(Realtime.sort('order')), data.slice(0, 10));
        });
    });

    it('sort works', () => {
      const query = { order: { $lt: 15 } };
      const publication = record => record.order < 10;
      const realtime = new Realtime(fromService, { query, publication, sort: Realtime.sort('order') });

      return realtime.connect()
        .then(() => {
          const records = realtime.store.records;
          assert.lengthOf(records, 10);

          assert.deepEqual(records, data.slice(0, 10));
        });
    });
  });
});
