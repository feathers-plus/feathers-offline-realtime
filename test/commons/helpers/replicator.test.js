
const assert = require('chai').assert;
const feathers = require('feathers');
const memory = require('feathers-memory');
const hooks = require('feathers-hooks');

const sampleLen = 5;
let app;

function services1 () {
  const app = this;

  app.configure(fromServiceNonPaginatedConfig);
}

function fromServiceNonPaginatedConfig () {
  const app = this;

  app.use('/from', memory({}));
}

export default function (Replicator, desc, useUuid) {
  describe(`${desc} - replicator ${useUuid ? 'using uuid' : 'using id'}`, () => {
    let data;
    let fromService;
    let replicator;

    beforeEach(() => {
      app = feathers()
        .configure(hooks())
        .configure(services1);

      fromService = app.service('from');

      data = [];
      for (let i = 0, len = sampleLen; i < len; i += 1) {
        data.push({ id: i, uuid: 1000 + i, order: i });
      }
    });

    describe('cryptographic', () => {
      beforeEach(() => {
        return fromService.create(clone(data))
          .then(() => {
            replicator = new Replicator(fromService, { sort: Replicator.sort('order'), useUuid });
          });
      });

      it('defaults to short uuid', () => {
        const uuid = replicator.getUuid();

        assert.isString(uuid);
        assert.isAtMost(uuid.length, 15);
      });

      it('can get long uuid', () => {
        replicator.useShortUuid(false);
        const uuid = replicator.getUuid();

        assert.isString(uuid);
        assert.lengthOf(uuid, 36);
      });

      it('can get short uuid', () => {
        replicator.useShortUuid(true);
        const uuid = replicator.getUuid();

        assert.isString(uuid);
        assert.isAtMost(uuid.length, 15);
      });
    });
  });
}

// Helpers

function clone (obj) {
  return JSON.parse(JSON.stringify(obj));
}
