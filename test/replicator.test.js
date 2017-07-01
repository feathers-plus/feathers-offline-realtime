
import test from './commons/helpers/replicator.test.js';
const Realtime = require('../src');

test(Realtime, 'realtime', false);
test(Realtime, 'realtime', true);
