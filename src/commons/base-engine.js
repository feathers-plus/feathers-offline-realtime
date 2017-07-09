
import EventEmitter from 'component-emitter';

import makeDebug from 'debug';
const debug = makeDebug('base-engine');

export default class BaseEngine {
  constructor (service, options = {}) {
    debug('constructor entered');

    this._service = service;
    this._publication = options.publication;
    this._subscriber = options.subscriber || (() => {});
    this._sorter = options.sort;
    this._eventEmitter = new EventEmitter();

    this._listener = eventName => remoteRecord => this._mutateStore(
      eventName, remoteRecord, 0
    );

    this._eventListeners = {
      created: this._listener('created'),
      updated: this._listener('updated'),
      patched: this._listener('patched'),
      removed: this._listener('removed')
    };

    this.useUuid = options.uuid;
    this.emit = this._eventEmitter.emit;
    this.on = this._eventEmitter.on;
    this.listening = false;

    this.store = {
      last: { eventName: '', action: '', record: {} },
      records: []
    };
  }

  snapshot (records) {
    debug('snapshot entered');

    this.store.last = { action: 'snapshot' };
    this.store.records = records;

    if (this._sorter) {
      records.sort(this._sorter);
    }

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

  _mutateStore (eventName, remoteRecord, source) {
    debug(`_mutateStore started: ${eventName}`);
    const that = this;

    const idName = this._useUuid ? 'uuid' : ('id' in remoteRecord ? 'id' : '_id');
    const store = this.store;
    const records = store.records;

    const index = this._findIndex(records, record => record[idName] === remoteRecord[idName]);

    if (index >= 0) {
      records.splice(index, 1);
    }

    if (eventName === 'removed') {
      if (index >= 0) {
        broadcast('remove');
      } else if (source === 0 && (!this._publication || this._publication(remoteRecord))) {
        // Emit service event if it corresponds to a previous optimistic remove
        broadcast('remove');
      }

      return; // index >= 0 ? broadcast('remove') : undefined;
    }

    if (this._publication && !this._publication(remoteRecord)) {
      return index >= 0 ? broadcast('left-pub') : undefined;
    }

    records[records.length] = remoteRecord;

    if (this._sorter) {
      records.sort(this._sorter);
    }

    return broadcast('mutated');

    function broadcast (action) {
      debug(`emitted ${index} ${eventName} ${action}`);
      store.last = { source, action, eventName, record: remoteRecord };

      that.emit('events', records, store.last);
      that._subscriber(records, store.last);
    }
  }

  changeSort (sort) {
    this._sorter = sort;

    if (this._sorter) {
      this.store.records.sort(this._sorter);
    }

    this.emit('events', this.store.records, { action: 'change-sort' });
    this._subscriber(this.store.records, { action: 'change-sort' });
  }

  _findIndex (array, predicate = () => true, fromIndex = 0) {
    for (let i = fromIndex, len = array.length; i < len; i++) {
      if (predicate(array[i])) {
        return i;
      }
    }

    return -1;
  }
}
