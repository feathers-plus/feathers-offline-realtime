
const assert = require('chai').assert;
const { isObject, stripProps } = require('../src/commons/utils');

describe('utils-misc:', () => {
  it('isObject works', () => {
    assert.isOk(isObject({}));
    assert.isNotOk(isObject([]));
    assert.isNotOk(isObject(null));
    assert.isNotOk(isObject(1));
    assert.isNotOk(isObject('a'));
    assert.isNotOk(isObject(undefined));
    assert.isNotOk(isObject(() => {
    }));
    assert.isNotOk(isObject(true));
  });

   it('stripProps works', () => {
   const from = { a: 1, id: 2, _id: 3, b: { c: 4, id: 5, _id: 6 }};
   
   assert.deepEqual(stripProps(from, ['id', '_id']), { a: 1, b: { c: 4 }});
   });
});
