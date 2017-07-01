
import snapshot from 'feathers-offline-snapshot';
import { genUuid } from './utils';

import makeDebug from 'debug';
const debug = makeDebug('base-replicator');

export default class BaseReplicator {
  constructor (service, options = {}) {
    debug('constructor entered');

    // Higher order class defines: this.engine, this.store, this.changeSort, this.on

    this._service = service;
    this._query = options.query || {};
    this._publication = options.publication;

    this.genShortUuid = true;
  }

  get connected () {
    return this.engine.listening;
  }

  connect () {
    this.engine.removeListeners();

    return snapshot(this._service, this._query)
      .then(records => {
        records = this._publication ? records.filter(this._publication) : records;
        records = this.engine.sorter ? records.sort(this.engine.sorter) : records;

        this.engine.snapshot(records);
        this.engine.addListeners();
      });
  }

  disconnect () {
    this.engine.removeListeners();
  }

  useShortUuid (ifShortUuid) {
    this.genShortUuid = !!ifShortUuid;
  }

  getUuid () {
    return genUuid(this.genShortUuid);
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
