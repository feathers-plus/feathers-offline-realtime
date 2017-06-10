# feathers-offline-realtime

[![Build Status](https://travis-ci.org/feathersjs/feathers-offline-realtime.png?branch=master)](https://travis-ci.org/feathersjs/feathers-offline-realtime)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-offline-realtime/badges/gpa.svg)](https://codeclimate.com/github/feathersjs/feathers-offline-realtime)
[![Test Coverage](https://codeclimate.com/github/feathersjs/feathers-offline-realtime/badges/coverage.svg)](https://codeclimate.com/github/feathersjs/feathers-offline-realtime/coverage)
[![Dependency Status](https://img.shields.io/david/feathersjs/feathers-offline-realtime.svg?style=flat-square)](https://david-dm.org/feathersjs/feathers-offline-realtime)
[![Download Status](https://img.shields.io/npm/dm/feathers-offline-realtime.svg?style=flat-square)](https://www.npmjs.com/package/feathers-offline-realtime)

> Offline-first realtime replication. Realtime, read-only publication from a service.

## Installation

```
npm install feathers-offline-realtime --save
```

## Documentation

`snapshort(service, query)`

- `service` (*required*) - The service to read.
- `query` (*optional*, default: `{}`) - The
[Feathers query object](https://docs.feathersjs.com/api/databases/querying.html)
selecting the records to read.
Some of the props it may include are:
    - `$limit` (*optional*, default: 200) - Records to read at a time.
    The service's configuration may limit the actual number read.
    - `$skip` (*optional*, default: 0) will initially skip this number of records.
    - `$sort` (*optional*, default: `{}`) will sort the records.
    You can sort on multiple props, for example `{ field1: 1, field2: -1 }`.



## Example using event emitters

```js
const Realtime = require('feathers-offline-realtime');

const app = ... // Configure Feathers, including the `/messages` service.
const username = ... // The username authenticated on this client
const messages = app.service('/messages');

const messagesReplicator = new Realtime(messages, {
  query: { username },
  publication: record => record.username === username && record.inappropriate !== true,
  sort: Realtime.multiSort({ channel: 1, topic: 1 }),
});

messagesReplicator.on('events', (records, { action, eventName, record }) => {
  console.log('last mutation:', action, eventName, record);
  console.log('current records:', records);
  console.log('event listeners active:', messagesReplicator.connected);
});
```

## Example using a subscriber

```js
const Realtime = require('feathers-offline-realtime');

const app = ... // Configure Feathers, including the `/messages` service.
const username = ... // The username authenticated on this client
const messages = app.service('/messages');

const messagesReplicator = new Realtime(messages, {
  query: { username },
  publication: record => record.username === username && record.inappropriate !== true,
  sort: Realtime.multiSort({ channel: 1, topic: 1 }),
  subscriber
});

function subscriber(records, { action, eventName, record }) => {
  console.log('last mutation:', action, eventName, record);
  console.log('current records:', records);
  console.log('event listeners active:', messagesReplicator.connected);
}
```

## Event information

Events and subscriber calls provide the same information:
- `records` - The current, up-to-date records.
- `action` - The latest replication action.
- `eventName` - The latest Feathers service event, e.g. created, updated, patched, removed.
- `record` - The record associated with `eventName`.

The possible `action` values are:

| action           | eventName | record | records | description
|------------------|-----------|--------|---------|--------------------------
| snapshot         |     -     |    -   |   yes   | snapshot performed
| add-listeners    |     -     |    -   |   yes   | listening to service events
| mutated          | see below |   yes  |   yes   | record created or mutated
| left-pub         | see below |   yes  |   yes   | mutated record no longer within publication
| remove           | see below |   yes  |   yes   | record within publication removed
| change-sort      |     -     |    -   |   yes   | records resorted by new sort criteria
| remove-listeners |     _     |    -   |   yes   | stopped listening to service events
|

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
