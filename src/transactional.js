
// import NodeEventEmitter from 'node-event-emitter';
import Events from 'events';

import makeDebug from 'debug';
const debug = makeDebug('feathers-offline-realtime');

export default class Transactional extends Events {
  constructor (service, options = {}) {
    debug('constructor entered');
    super();

    this._service = service;
    this._publication = options.publication;
    this._sort = options.sort;
    this._subscriber = options.subscriber || (() => {});
    this.listening = false;

    this._listener = eventName => remoteRecord => this.mutateStore(eventName, remoteRecord);

    this._eventListeners = {
      created: this._listener('created'),
      updated: this._listener('updated'),
      patched: this._listener('patched'),
      removed: this._listener('removed')
    };

    this.store = {
      last: { eventName: '', action: '', record: {} },
      records: []
    };
  }

  snapshot (records) {
    debug('snapshot entered');

    this.store.last = { action: 'snapshot' };
    this.store.records = records;

    this.emit('events', this.store.records, this.store.last);
    this._subscriber(this.store.records, this.store.last);
  }

  addListeners () {
    debug('addListeners entered');
    const service = this._service;
    const eventListeners = this._eventListeners;

    service.on('created', eventListeners.created);
    service.on('updated', eventListeners.updated);
    service.on('patched', eventListeners.patched);
    service.on('removed', eventListeners.removed);

    this.listening = true;
    this.emit('events', this.store.records, { action: 'add-listeners' });
    this._subscriber(this.store.records, { action: 'add-listeners' });
  }

  removeListeners () {
    debug('removeListeners entered');

    if (this.listening) {
      const service = this._service;
      const eventListeners = this._eventListeners;

      service.removeListener('created', eventListeners.created);
      service.removeListener('updated', eventListeners.updated);
      service.removeListener('patched', eventListeners.patched);
      service.removeListener('removed', eventListeners.removed);

      this.listening = false;
      this.emit('events', this.store.records, { action: 'remove-listeners' });
      this._subscriber(this.store.records, { action: 'remove-listeners' });
    }
  }

  mutateStore (eventName, remoteRecord) {
    debug(`mutateStore started: ${eventName}`);
    const that = this;

    const idName = ('id' in remoteRecord) ? 'id' : '_id';
    const store = this.store;
    const records = store.records;

    const index = findIndex(records, record => record[idName] === remoteRecord[idName]);

    if (index >= 0) {
      records.splice(index, 1);
    }

    if (eventName === 'removed' && index >= 0) {
      return broadcast('remove');
    }

    if (this._publication && !this._publication(remoteRecord)) {
      return index >= 0 ? broadcast('left-pub') : undefined;
    }

    records[records.length] = remoteRecord;

    if (this._sort) {
      records.sort(this._sort);
    }

    return broadcast('mutated');

    function broadcast (action) {
      debug(`emitted ${index} ${eventName} ${action}`);
      store.last = { eventName, action, record: remoteRecord };

      that.emit('events', records, store.last);
      that._subscriber(records, store.last);
    }
  }
}

function findIndex (array, predicate = () => true, fromIndex = 0) {
  for (let i = fromIndex, len = array.length; i < len; i++) {
    if (predicate(array[i])) {
      return i;
    }
  }

  return -1;
}
