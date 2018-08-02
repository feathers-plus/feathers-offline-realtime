/*
 Forked from feathers-memory/src/index.js
 */
import Proto from 'uberproto';
import errors from '@feathersjs/errors';
import { sorter, select, _, filterQuery } from '@feathersjs/commons';
import sift from 'sift';

class Service {
  constructor (options = {}) {
    this._replicator = options.replicator;
    this._engine = this._replicator.engine;

    if (!this._engine.useUuid) {
      throw new Error('Replicator must be configured for uuid for optimistic updates. (offline)');
    }

    this._mutateStore = this._engine._mutateStore.bind(this._engine);
    this._alwaysSelect = ['id', '_id', 'uuid'];
    this._getUuid = this._replicator.getUuid;

    this.store = this._engine.store || { records: [] };
    this.paginate = options.paginate || {};
  }

  extend (obj) {
    return Proto.extend(obj, this);
  }

  // Find without hooks and mixins that can be used internally and always returns
  // a pagination object
  _find (params, getFilter = filterQuery) {
    const { query, filters } = getFilter(params.query || {});
    let values = _.values(this.store.records).filter(sift(query));

    const total = values.length;

    if (filters.$sort) {
      values.sort(sorter(filters.$sort));
    }

    if (filters.$skip) {
      values = values.slice(filters.$skip);
    }

    if (typeof filters.$limit !== 'undefined') {
      values = values.slice(0, filters.$limit);
    }

    if (filters.$select) {
      values = values.map(value => _.pick(value, ...filters.$select));
    }

    return Promise.resolve({
      total,
      limit: filters.$limit,
      skip: filters.$skip || 0,
      data: values
    });
  }

  find (params) {
    const paginate = typeof params.paginate !== 'undefined' ? params.paginate : this.paginate;
    // Call the internal find with query parameter that include pagination
    const result = this._find(params, query => filterQuery(query, paginate));

    if (!(paginate && paginate.default)) {
      return result.then(page => page.data);
    }

    return result;
  }

  get (uuid, params) {
    const records = this.store.records;
    const index = findUuidIndex(records, uuid);

    if (index === -1) {
      return Promise.reject(new errors.NotFound(`No record found for uuid '${uuid}'`));
    }

    return Promise.resolve(records[index])
      .then(select(params, ...this._alwaysSelect));
  }

  // Create without hooks and mixins that can be used internally
  _create (data, params) {
    this._checkConnected();

    if (!('uuid' in data)) {
      data.uuid = this._getUuid();
    }

    const records = this.store.records;
    const index = findUuidIndex(records, data.uuid);
    if (index > -1) {
      throw new errors.BadRequest('Optimistic create requires unique uuid. (offline)');
    }

    // optimistic mutation
    this._mutateStore('created', data, 1);

    // Start actual mutation on remote service
    this._replicator._service.create(shallowClone(data), params)
      .catch(() => {
        this._mutateStore('removed', data, 2);
      });

    return Promise.resolve(data)
      .then(select(params, ...this._alwaysSelect));
  }

  create (data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this._create(current)));
    }

    return this._create(data, params);
  }

  // Update without hooks and mixins that can be used internally
  _update (uuid, data, params) {
    this._checkConnected();
    checkUuidExists(data);

    const records = this.store.records;
    const index = findUuidIndex(records, uuid);
    if (index === -1) {
      return Promise.reject(new errors.NotFound(`No record found for uuid '${uuid}'`));
    }

    // We don't want our id to change type if it can be coerced
    const beforeRecord = shallowClone(records[index]);
    const beforeUuid = beforeRecord.uuid;
    data.uuid = beforeUuid == uuid ? beforeUuid : uuid; // eslint-disable-line

    // Optimistic mutation
    this._mutateStore('updated', data, 1);

    // Start actual mutation on remote service
    this._replicator._service.update(getId(data), shallowClone(data), params)
      .catch(() => {
        this._mutateStore('updated', beforeRecord, 2);
      });

    return Promise.resolve(data)
      .then(select(params, ...this._alwaysSelect));
  }

  update (uuid, data, params) {
    if (uuid === null || Array.isArray(data)) {
      return Promise.reject(new errors.BadRequest(
        `You can not replace multiple instances. Did you mean 'patch'?`
      ));
    }

    return this._update(uuid, data, params);
  }

  // Patch without hooks and mixins that can be used internally
  _patch (uuid, data, params) {
    this._checkConnected();

    const records = this.store.records;
    const index = findUuidIndex(records, uuid);
    if (index === -1) {
      return Promise.reject(new errors.NotFound(`No record found for uuid '${uuid}'`));
    }

    // Optimistic mutation
    const beforeRecord = shallowClone(records[index]);
    const afterRecord = Object.assign({}, beforeRecord, data);
    this._mutateStore('patched', afterRecord, 1);

    // Start actual mutation on remote service
    this._replicator._service.patch(getId(beforeRecord), shallowClone(data), params)
      .catch(() => {
        this._mutateStore('updated', beforeRecord, 2);
      });

    return Promise.resolve(afterRecord)
      .then(select(params, ...this._alwaysSelect));
  }

  patch (uuid, data, params) {
    if (uuid === null) {
      return this._find(params).then(page => {
        return Promise.all(page.data.map(
          current => this._patch(current.uuid, data, params))
        );
      });
    }

    return this._patch(uuid, data, params);
  }

  // Remove without hooks and mixins that can be used internally
  _remove (uuid, params) {
    this._checkConnected();

    const records = this.store.records;
    const index = findUuidIndex(records, uuid);
    if (index === -1) {
      return Promise.reject(new errors.NotFound(`No record found for uuid '${uuid}'`));
    }

    // Optimistic mutation
    const beforeRecord = shallowClone(records[index]);
    this._mutateStore('removed', beforeRecord, 1);

    // Start actual mutation on remote service
    this._replicator._service.remove(getId(beforeRecord), params)
      .catch(() => {
        this._mutateStore('created', beforeRecord, 2);
      });

    return Promise.resolve(beforeRecord)
      .then(select(params, ...this._alwaysSelect));
  }

  remove (uuid, params) {
    if (uuid === null) {
      return this._find(params).then(page =>
        Promise.all(page.data.map(current =>
          this._remove(current.uuid, params
          )
        )));
    }

    return this._remove(uuid, params);
  }

  _checkConnected () {
    if (!this._replicator.connected) {
      throw new errors.BadRequest('Replicator not connected to remote. (offline)');
    }
  }
}

export default function init (options) {
  return new Service(options);
}

init.Service = Service;

// Helpers

function findUuidIndex (array, uuid) {
  for (let i = 0, len = array.length; i < len; i++) {
    if (array[i].uuid == uuid) { // eslint-disable-line
      return i;
    }
  }

  return -1;
}

function checkUuidExists (record) {
  if (!('uuid' in record)) {
    throw new errors.BadRequest('Optimistic mutation requires uuid. (offline)');
  }
}

function getId (record) {
  return ('id' in record ? record.id : record._id);
}

function shallowClone (obj) {
  return Object.assign({}, obj);
}
