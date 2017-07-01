
const assert = require('chai').assert;
const { hash, hashOfRecord, genUuid } = require('../src/commons/utils');

describe('utils-cryptographic:', () => {
  it('hash hashes a string consistently', () => {
    const str = JSON.stringify({ a: 'a', b: true });
    const hash1 = hash(str);
    const hash2 = hash(str);

    assert.isString(hash1);
    assert.lengthOf(hash1, 40);
    assert.isString(hash2);
    assert.lengthOf(hash2, 40);

    assert.equal(hash1, hash2);
  });

  it('hashOfRecord ignores id and _id', () => {
    assert.equal(
      hashOfRecord({ id: 1, _id: 2, a: 3 }),
      hashOfRecord({ a: 3 })
    );
  });

  it('generates long uuid', () => {
    const uuid = genUuid(false);

    assert.isString(uuid);
    assert.lengthOf(uuid, 36);
  });

  it('generates short uuid', () => {
    const uuid = genUuid(true);

    assert.isString(uuid);
    assert.isAtMost(uuid.length, 15);
  });
});
