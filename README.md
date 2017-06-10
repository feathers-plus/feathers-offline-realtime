# feathers-offline-realtime

[![Build Status](https://travis-ci.org/feathersjs/feathers-offline-realtime.png?branch=master)](https://travis-ci.org/feathersjs/feathers-offline-realtime)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-offline-realtime/badges/gpa.svg)](https://codeclimate.com/github/feathersjs/feathers-offline-realtime)
[![Test Coverage](https://codeclimate.com/github/feathersjs/feathers-offline-realtime/badges/coverage.svg)](https://codeclimate.com/github/feathersjs/feathers-offline-realtime/coverage)
[![Dependency Status](https://img.shields.io/david/feathersjs/feathers-offline-realtime.svg?style=flat-square)](https://david-dm.org/feathersjs/feathers-offline-realtime)
[![Download Status](https://img.shields.io/npm/dm/feathers-offline-realtime.svg?style=flat-square)](https://www.npmjs.com/package/feathers-offline-realtime)

> Offline-first realtime replication. Realtime, read-only publication from a service.

You can keep on the client a near realtime replica of (some of) the records
in a service configured on the server.
This may make your client more performant, so it appears "snappier."

You can replicate just a subset of the records in the service by providing a "publication" function
which, given a record, determines if the record belongs in the publication.
You or some other party may update the record so that it no longer belongs to the publication,
or so that it now belongs.
The replicator handles these situations.

Many apps have unique data for every user.
With publications, you can keep the records for all users in one table,
using the publication feature to replicate to the client
only those records belonging to the client's user.

A [snapshot replication](https://github.com/feathersjs/feathers-offline-snapshot)
is used to initially obtain the records.
By default, the publication function will be run against every record in the service.
You may however provide a
[Feathers query object](https://docs.feathersjs.com/api/databases/querying.html)
to reduce the number of records read initially.
The publication function will still be run against these records.

> **ProTip:** A publication function is required whenever you provide the query object,
and the publication must be at least as restrictive as the query.

The realtime replicator can notify you of data mutations by emitting an event and/or
calling a subscription function for every notification.
You can in addition periodically poll the replicator to obtain the current realtime records.

> **ProTip:** Every Feathers service event on the server is sent to the client.

You can control the order of the realtime records by providing a sorting function
compatible with `array.sort(options.sort)`.
Two sorting functions are provided for your convenience with this repo:
- `Realtime.sort(fieldName)` sorts on the `fieldName` in ascending order.
- `Realtime.multiSort({ fieldName1: 1, fieldName2: -1 })` sorts on multiple fields
in either ascending or descending order.

You can dynamically change the sort order as your needs change.
This can be very useful for your UI.


## Installation

```
npm install feathers-offline-realtime --save
```


## Documentation

```javascript
import Realtime from 'feathers-offline-realtime';
const messages = app.service('/messages');

const messagesRealtime = new Realtime(messages, options);

messagesRealtime.connect()
  .then(() => {
    messagesRealtime.changeSort(Realtime.multiSort(sortFunc));
    console.log(messagesRealtime.connected);
  });


```

**Options** Realtime() - Create a realtime replicator.
- `service` (*required*) - The service to read.
- `options` (*optional*) - The configuration object.
    - `publication` (*optional* but *required* if `query` is specified.
    Function with signature `record => boolean`.) - Function to
    determine if a record belongs to the publication.
    - `query` (*optional*) - The
    [Feathers query object](https://docs.feathersjs.com/api/databases/querying.html)
    to reduce the number of records read during the snapshot.
    The props $sort and $select are not allowed.
    Some of the props it may include are:
        - `$limit` (*optional*, default: 200) - Records to read at a time.
        The service's configuration may limit the actual number read.
        - `$skip` (*optional*, default: 0) will initially skip this number of records.
    - `sort` (*optional* Function with signature `(a, b) => 1 || -1 || 0`) - A function
    compatible with `array.sort(options.sort)`.
    - `subscriber` (*optional* Function with signature
    `(records, { action, eventName, record }) => ...`) - Function to call on mutation events.
    See example below.
    
**Options** changeSort() - Change the sort used for the records.
- `sortFunc` (*optional*) - Same as `options.sort`.

**Options** connected - Is the replicator listening to Feathers service events?

> **ProTip:** Replication events are always emitted. See example below.


discuss query vs publication
connected()

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

messagesRealtime.connect()
  .then(() => ...);
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

messagesRealtime.connect()
  .then(() => ...);

function subscriber(records, { action, eventName, record }) => {
  console.log('last mutation:', action, eventName, record);
  console.log('realtime records:', records);
  console.log('event listeners active:', messagesRealtime.connected);
}
```

## Example using periodic inspection

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

setTimeout(() => {
  const { records, last: { action, eventName, record }} = messagesRealtime.store;
  console.log('last mutation:', action, eventName, record);
  console.log('realtime records:', records);
  console.log('event listeners active:', messagesRealtime.connected);
}, 5 * 60 * 1000);


```

## Event information

All handlers receive the following information:

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
It would then update the local data with every addition or other mutation made on the remote.


#### Sources:

- (*) [Microsoft](https://docs.microsoft.com/en-us/sql/relational-databases/replication/snapshot-replication)
- (**) [MarinTodorov](https://www.slideshare.net/MarinTodorov/overcome-your-fear-of-implementing-offline-mode-in-your-apps?next_slideshow=1)


## License

Copyright (c) 2017

Licensed under the [MIT license](LICENSE).
