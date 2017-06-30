
import BaseReplicator from './commons/base-replicator';
import RealtimeEngine from './realtime-engine';

import makeDebug from 'debug';
const debug = makeDebug('realtime-replicator');

export default class RealtimeReplicator extends BaseReplicator {
  constructor (service, options = {}) {
    debug('constructor started');
    super(service, options);

    const engine = this.engine = new RealtimeEngine(service, options);
    this.changeSort = (...args) => engine.changeSort(...args);
    this.on = (...args) => engine.on(...args);
    this.store = engine.store;

    debug('constructor ended');
  }
}
