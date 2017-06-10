
const assert = require('chai').assert;
const feathers = require('feathers');
const memory = require('feathers-memory');
const hooks = require('feathers-hooks');
const Realtime = require('../src');

const sampleLen = 5;

function services1 () {
  const app = this;

  app.configure(fromServiceNonPaginatedConfig);
}

function fromServiceNonPaginatedConfig () {
  const app = this;

  app.use('/from', memory({}));
}

describe('emitters', () => {
  let data;
  let fromService;
  let realtime;

  beforeEach(() => {
    const app = feathers()
      .configure(hooks())
      .configure(services1);

    fromService = app.service('from');

    data = [];
    for (let i = 0, len = sampleLen; i < len; i += 1) {
      data.push({ id: i, order: i });
    }
  });

  describe('without publication', () => {
    let events;
    
    beforeEach(() => {
      events = [];
      
      return fromService.create(clone(data))
        .then(() => {
          realtime = new Realtime(fromService, { sort: Realtime.sort('order') });
          realtime.on('events', (records, last) => {
            events[events.length] = last;
          });
        });
    });

    it('create works', () => {
      return realtime.connect()
        .then(() => fromService.create({ id: 99, order: 99 }))
        .then(() => {
          const records = realtime.store.records;
          data[sampleLen] = { id: 99, order: 99 };

          assert.lengthOf(records, sampleLen + 1);
          assert.deepEqual(records, data);
          
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'created', action: 'mutated', record: { id: 99, order: 99 } },
          ]);
        });
    });

    it('update works', () => {
      return realtime.connect()
        .then(() => fromService.update(0, { id: 0, order: 99 }))
        .then(() => {
          const records = realtime.store.records;
          data.splice(0, 1);
          data[data.length] = { id: 0, order: 99 };

          assert.lengthOf(records, sampleLen);
          assert.deepEqual(records, data);
  
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'updated', action: 'mutated', record: { id: 0, order: 99 } },
          ]);
        });
    });

    it('patch works', () => {
      return realtime.connect()
        .then(() => fromService.patch(1, { order: 99 }))
        .then(() => {
          const records = realtime.store.records;
          data.splice(1, 1);
          data[data.length] = { id: 1, order: 99 };

          assert.lengthOf(records, sampleLen);
          assert.deepEqual(records, data);
  
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'patched', action: 'mutated', record: { id: 1, order: 99 } },
          ]);
        });
    });

    it('remove works', () => {
      return realtime.connect()
        .then(() => fromService.remove(2))
        .then(() => {
          const records = realtime.store.records;
          data.splice(2, 1);

          assert.lengthOf(records, sampleLen - 1);
          assert.deepEqual(records, data);
          
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'removed', action: 'remove', record: { id: 2, order: 2 } },
          ]);
        });
    });
  });

  describe('within publication', () => {
    const testLen = 4;
    let events;

    beforeEach(() => {
      events = [];
      
      return fromService.create(clone(data))
        .then(() => {
          realtime = new Realtime(fromService, {
            sort: Realtime.sort('order'),
            publication: record => record.order <= 3.5
          });

          data.splice(testLen);
  
          realtime.on('events', (records, last) => {
            events[events.length] = last;
          });
        });
    });

    it('create works', () => {
      return realtime.connect()
        .then(() => fromService.create({ id: 99, order: 3.5 }))
        .then(() => {
          const records = realtime.store.records;
          data[testLen] = { id: 99, order: 3.5 };

          assert.lengthOf(records, testLen + 1);
          assert.deepEqual(records, data);
  
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'created', action: 'mutated', record: { id: 99, order: 3.5 } },
          ]);
        });
    });
  });

  describe('outside publication', () => {
    const testLen = 4;
    let events;

    beforeEach(() => {
      events = [];
      
      return fromService.create(clone(data))
        .then(() => {
          realtime = new Realtime(fromService, {
            sort: Realtime.sort('order'),
            publication: record => record.order <= 3.5
          });

          data.splice(testLen);
  
          realtime.on('events', (records, last) => {
            events[events.length] = last;
          });
        });
    });

    it('create works', () => {
      return realtime.connect()
        .then(() => fromService.create({ id: 99, order: 99 }))
        .then(() => {
          const records = realtime.store.records;

          assert.lengthOf(records, testLen);
          assert.deepEqual(records, data);
          
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
          ]);
        });
    });
  });

  describe('moving in/out publication', () => {
    const testLen = 4;
    let events;

    beforeEach(() => {
      events = [];
      
      return fromService.create(clone(data))
        .then(() => {
          realtime = new Realtime(fromService, {
            sort: Realtime.sort('order'),
            publication: record => record.order <= 3.5
          });

          data.splice(testLen);
  
          realtime.on('events', (records, last) => {
            events[events.length] = last;
          });
        });
    });

    it('patching to without', () => {
      return realtime.connect()
        .then(() => fromService.patch(1, { order: 99 }))
        .then(() => {
          const records = realtime.store.records;
          data.splice(1, 1);

          assert.lengthOf(records, testLen - 1);
          assert.deepEqual(records, data);
  
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'patched', action: 'left-pub', record: { id: 1, order: 99 } },
          ]);
        });
    });

    it('patching to within', () => {
      return realtime.connect()
        .then(() => fromService.patch(4, { order: 3.5 }))
        .then(() => {
          const records = realtime.store.records;
          data[testLen] = { id: 4, order: 3.5 };

          assert.lengthOf(records, testLen + 1);
          assert.deepEqual(records, data);
  
          assert.deepEqual(events, [
            { action: 'snapshot' },
            { action: 'add-listeners' },
            { eventName: 'patched', action: 'mutated', record: { id: 4, order: 3.5 } },
          ]);
        });
    });
  });
});

// Helpers

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}
