
import makeSnapshot from 'feathers-offline-snapshot';
import Transactional from './transactional';

import makeDebug from 'debug';
const debug = makeDebug('feathers-offline-realtime');

// const realtimeMessages = new Realtime(service, options).subscribe(records => {}).connect();
export default class Realtime {
  constructor (service, options = {}) {
    debug('New replicator');

    this._service = service;
    this._query = options.query || {};
    this._publication = options.publication || (() => true);
    this._sort = options.sort;
    this._subscriber = options.subscriber;
    this.replicator = new Transactional(service, options);
    this.store = this.replicator.store;
    this.connected = false;
  }

  connect () {
    if (this.replicator.listening) {
      this.replicator.removeListeners();
    }

    return this.snapshot()
      .then(records => {
        if (this._publication) {
          records = records.filter(this._publication);
        }

        this.replicator.setStore(records);
        this.replicator.addListeners();
        this.connected = true;

        if (this._subscriber) {
          this._subscriber('connected', null);
        }
      });
  }

  disconnect () {
    this.connected = false;

    if (this.replicator.listening) {
      this.replicator.removeListeners();
    }

    if (this._subscriber) {
      this._subscriber('disconnected', null);
    }
  }

  snapshot () {
    const that = this;

    return makeSnapshot(that._service, that._query)
      .then(records => {
        records.filter(that._publication);
        return that._sort ? records.sort(that._sort) : records;
      });
  }

  subscribe (subscriber) {
    this.replicator.subscriber(subscriber);
    this._subscriber = subscriber;
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
