
import BaseEngine from './commons/base-engine';

import makeDebug from 'debug';
const debug = makeDebug('realtime-engine');

export default class RealtimeEngine extends BaseEngine {
  constructor (service, options = {}) {
    debug('constructor started');

    super(service, options);

    debug('constructor ended');
  }
}
