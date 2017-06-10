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

const messagesRealtime = new Realtime(messages, {
  query: { username },
  publication: record => record.username === username && record.inappropriate === false,
  sort: Realtime.multiSort({ channel: 1, topic: 1 }),
});

messagesRealtime.on('events', (records, { action, eventName, record }) => {
  console.log('last mutation:', action, eventName, record);
  console.log('realtime records:', records);
  console.log('event listeners active:', messagesRealtime.connected);
});
```

## Example using a subscriber

```js
const Realtime = require('feathers-offline-realtime');

const app = ... // Configure Feathers, including the `/messages` service.
const username = ... // The username authenticated on this client
const messages = app.service('/messages');

const messagesRealtime = new Realtime(messages, {
  query: { username },
  publication: record => record.username === username && record.inappropriate === false,
  sort: Realtime.multiSort({ channel: 1, topic: 1 }),
  subscriber
});

function subscriber(records, { action, eventName, record }) => {
  console.log('last mutation:', action, eventName, record);
  console.log('realtime records:', records);
  console.log('event listeners active:', messagesRealtime.connected);
}
```

## Event information

Event and subscriber handlers receive the same information:

- `action` - The latest replication action.
- `eventName` - The Feathers realtime service event.
- `record` - The record associated with `eventName`.
- `records` - The realtime, sorted records.

| action           | eventName | record | records | description
|------------------|-----------|--------|---------|--------------------------
| snapshot         |     -     |    -   |   yes   | snapshot performed
| add-listeners    |     -     |    -   |   yes   | started listening to service events
| mutated          | see below |   yes  |   yes   | record added to or mutated within publication
| left-pub         | see below |   yes  |   yes   | mutated record is no longer within publication
| remove           | see below |   yes  |   yes   | record within publication has been deleted
| change-sort      |     -     |    -   |   yes   | records resorted using the new sort criteria
| remove-listeners |     _     |    -   |   yes   | stopped listening to service events

| **eventName:** `created`, `updated`, `patched` or `removed`.

## What is the Realtime strategy?

> Realtime is also commonly called transactional replication.

Realtime typically starts with a snapshot of the remote database data.
As soon as the initial snapshot is taken,
subsequent data changes made at the remote are delivered to the client as they occur (in near real time).
The data changes are applied at the client in the same order as they occurred at the remote.

Realtime is appropriate in each of the following cases:
- You want incremental changes to be propagated to clients as they occur.
- The application requires low latency between the time changes are made at the remote and the changes arrive at the client.
- The application requires access to intermediate data states.
For example, if a row changes five times, realtime allows an application to respond to each change
(such as running hooks), not simply to the net data change to the row.
- The remote has a very high volume of create, update, patch, and remove activity.
- Realtime should be treated as **read-only**, because local changes are not propagated back to the remote.

## Realtime Case Study

Let's consider an application which shows historical stock prices.

![stock price panel](./assets/realtime-3a.jpg)

The realtime strategy would snapshot the initial historical data.
It would then the local data with every addition or other mutation made on the remote.


#### Sources:

- (*) [Microsoft](https://docs.microsoft.com/en-us/sql/relational-databases/replication/snapshot-replication)
- (**) [MarinTodorov](https://www.slideshare.net/MarinTodorov/overcome-your-fear-of-implementing-offline-mode-in-your-apps?next_slideshow=1)


## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
