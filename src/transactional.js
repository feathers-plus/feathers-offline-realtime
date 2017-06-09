
import NodeEventEmitter from 'node-event-emitter';

import makeDebug from 'debug';
const debug = makeDebug('feathers-offline-realtime');

export default class Transactional extends NodeEventEmitter {
  constructor (service, options = {}) {
    debug('constructor entered');
    super();

    this._service = service;
    this._publication = options.publication || (record => true);
    this._sort = options.sort;
    this.listening = false;

    this._listener = (eventName) => (remoteRecord) => this.mutateStore(eventName, remoteRecord);

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

  setStore (records) {
    debug('setStore entered');

    this.store.last = { eventName: '', action: 'setStore', record: {} };
    this.store.records = records;

    this.emit('setStore', this.store.records, this.store.last);
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
    this.emit('addedListeners', this.store.records, this.store.last);
  }

  removeListeners () {
    debug('removeListeners entered');
    const service = this._service;
    const eventListeners = this._eventListeners;

    service.removeListener('created', eventListeners.created);
    service.removeListener('updated', eventListeners.updated);
    service.removeListener('patched', eventListeners.patched);
    service.removeListener('removed', eventListeners.removed);

    this.listening = false;
    this.emit('removedListeners', this.store.records, this.store.last);
  }

  mutateStore (eventName, remoteRecord) {
    debug(`mutateStore started: ${eventName}`);

    const idName = ('id' in remoteRecord) ? 'id' : '_id';
    const store = this.store;
    const records = store.records;

    const index = findIndex(records, record => record[idName] === remoteRecord[idName]);

    if (index >= 0) {
      records.splice(index, 1);
    }

    if (eventName === 'removed' && index >= 0) {
      return emitMutate('remove');
    }

    if (!this._publication(remoteRecord)) {
      return index >= 0 ? emitMutate('left-pub') : undefined;
    }

    records[records.length] = remoteRecord;

    if (this._sort) {
      records.sort(this._sort);
    }

    return emitMutate('mutated');

    function emitMutate (action) {
      debug(`emitted ${index} ${eventName} ${action}`);
      store.last = { eventName, action, record: remoteRecord };
      // this.emit('events', records, store.last);
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
