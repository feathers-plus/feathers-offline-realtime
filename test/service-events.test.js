
import test from './commons/helpers/service-events.test.js';
const Realtime = require('../src');

test(Realtime, 'realtime', false);
test(Realtime, 'realtime', true);
