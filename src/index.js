// import errors from 'feathers-errors';
import makeDebug from 'debug';

const debug = makeDebug('feathers-offline-realtime');

export default function init () {
  debug('Initializing feathers-offline-realtime plugin');
  return 'feathers-offline-realtime';
}
