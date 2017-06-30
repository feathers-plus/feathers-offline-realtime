
const assert = require('chai').assert;
const feathers = require('feathers');
const memory = require('feathers-memory');
const hooks = require('feathers-hooks');

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

export default function (Replicator, desc) {
  describe(`${desc} - subscribers`, () => {
    let data;
    let fromService;
    let replicator;
    
    beforeEach(() => {
      app = feathers()
        .configure(hooks())
        .configure(services1);
      
      fromService = app.service('from');
      
      data = [];
      for (let i = 0, len = sampleLen; i < len; i += 1) {
        data.push({ id: i, uuid: 1000 + i, order: i });
      }
    });
    
    describe('without publication', () => {
      let events;
      
      beforeEach(() => {
        events = [];
        
        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              subscriber: (records, last) => { events[events.length] = last; },
            });
          });
      });
      
      it('create works', () => {
        return replicator.connect()
          .then(() => fromService.create({ id: 99, uuid: 1099, order: 99 }))
          .then(() => replicator.disconnect())
          .then(() => {
            const records = replicator.store.records;
            data[sampleLen] = { id: 99, uuid: 1099, order: 99 };
            
            assert.lengthOf(records, sampleLen + 1);
            assert.deepEqual(records, data);
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 99 } },
              { action: 'remove-listeners' }
            ]);
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'updated', action: 'mutated', record: { id: 0, uuid: 1000, order: 99 } }
            ]);
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'patched', action: 'mutated', record: { id: 1, uuid: 1001, order: 99 } }
            ]);
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'removed', action: 'remove', record: { id: 2, uuid: 1002, order: 2 } }
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
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              publication: record => record.order <= 3.5,
              subscriber: (records, last) => { events[events.length] = last; },
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'created', action: 'mutated', record: { id: 99, uuid: 1099, order: 3.5 } }
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
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              publication: record => record.order <= 3.5,
              subscriber: (records, last) => { events[events.length] = last; },
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' }
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
            replicator = new Replicator(fromService, {
              sort: Replicator.sort('order'),
              publication: record => record.order <= 3.5,
              subscriber: (records, last) => { events[events.length] = last; },
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'patched', action: 'left-pub', record: { id: 1, uuid: 1001, order: 99 } }
            ]);
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
            
            assert.deepEqual(events, [
              { action: 'snapshot' },
              { action: 'add-listeners' },
              { source: 0, eventName: 'patched', action: 'mutated', record: { id: 4, uuid: 1004, order: 3.5 } }
            ]);
          });
      });
    });
  });
};

// Helpers

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}
