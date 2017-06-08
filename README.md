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

Please refer to the [feathers-offline-realtime documentation](http://docs.feathersjs.com/) for more details.

## Complete Example

Here's an example of a Feathers server that uses `feathers-offline-realtime`. 

```js
const feathers = require('feathers');
const rest = require('feathers-rest');
const hooks = require('feathers-hooks');
const bodyParser = require('body-parser');
const errorHandler = require('feathers-errors/handler');
const plugin = require('feathers-offline-realtime');

// Initialize the application
const app = feathers()
  .configure(rest())
  .configure(hooks())
  // Needed for parsing bodies (login)
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  // Initialize your feathers plugin
  .use('/plugin', plugin())
  .use(errorHandler());

app.listen(3030);

console.log('Feathers app started on 127.0.0.1:3030');
```

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
