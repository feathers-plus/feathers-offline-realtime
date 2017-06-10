
import snapshot from 'feathers-offline-snapshot';
import Transactional from './transactional';

import makeDebug from 'debug';
const debug = makeDebug('feathers-offline-realtime');

export default class Realtime {
  constructor (service, options = {}) {
    debug('constructor entered');

    this._service = service;
    this._query = options.query || {};
    this._publication = options.publication;
    this.replicator = new Transactional(service, options);

    this.changeSort = (...args) => this.replicator.changeSort(...args);
    this.on = (...args) => this.replicator.on(...args);
    this.store = this.replicator.store;
  }

  get connected () {
    return this.replicator.listening;
  }

  connect () {
    this.replicator.removeListeners();

    return snapshot(this._service, this._query)
      .then(records => {
        records = this._publication ? records.filter(this._publication) : records;
        records = this.replicator.sorter ? records.sort(this.replicator.sorter) : records;

        this.replicator.snapshot(records);
        this.replicator.addListeners();
      });
  }

  disconnect () {
    this.replicator.removeListeners();
  }

  // array.sort(Realtime.sort('fieldName'));
  static sort (prop) {
    return (a, b) => a[prop] > b[prop] ? 1 : (a[prop] < b[prop] ? -1 : 0);
  }

  // array.sort(Realtime.multiSort({ field1: 1, field2: -1 }))
  static multiSort (order) {
    const props = Object.keys(order);
    const len = props.length;

    return (a, b) => {
      let result = 0;
      let i = 0;

      while (result === 0 && i < len) {
        const prop = props[i];
        const sense = order[prop];

        result = a[prop] > b[prop] ? 1 * sense : (a[prop] < b[prop] ? -1 * sense : 0);
        i++;
      }

      return result;
    };
  }
}
