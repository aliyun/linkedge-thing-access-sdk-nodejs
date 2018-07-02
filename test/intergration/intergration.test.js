/*
 * Copyright (c) 2018 Alibaba Group Holding Ltd. All rights reversed.
 */

process.env.FUNCTION_ID = 'functionId';

const {
  RESULT_SUCCESS,
  RESULT_FAILURE,
  ThingAccessClient,
} = require('../../index');

const config = {
  productKey: 'Your Product Key',
  deviceName: 'Your Device Name'
};
const callbacks = {
  setProperties: function (properties) {
    // Properties is formed as follow:
    // {
    //   key1: 'value1',
    //   key2: 'value2'
    // };
    // Set properties to thing and return the result.
    console.log('Set properties %s to thing %s-%s', JSON.stringify(properties),
      config.productKey, config.deviceName);
    // Return a object result or a promise of it. Throw the error if one raises.
    return {
      code: RESULT_SUCCESS,
      message: 'success',
      params: { // Optional
        key1: 'value1',
        key2: 'value2',
      }
    };
  },
  getProperties: function (keys) {
    // Keys is formed as follow:
    // ['key1', 'key2'];

    // Get properties from thing and return them.
    console.log('Get properties %s from thing %s-%s', JSON.stringify(keys),
      config.productKey, config.deviceName);
    // Return a object result or a promise of it. Throw the error if one raises.
    return {
      code: RESULT_SUCCESS,
      message: 'success',
      params: {
        key1: 'value1',
        key2: 'value2',
      }
    };
  },
  callService: function (name, args) {
    // Name and args are formed as follow:
    // name: 'service name';
    // args: {
    //   key1: 'value1',
    //   key2: 'value2'
    // };

    // Call services on thing and return the result.
    console.log('Call service %s with %s on thing %s-%s', JSON.stringify(name),
      JSON.stringify(args), config.productKey, config.deviceName);
    // Return a object result or a promise of it. Throw the error if one raises.
    return new Promise((resolve) => {
      resolve({
        code: RESULT_SUCCESS,
        message: 'success',
        params: { // Optional
          code: 200,
          message: 'success',
          data: { // Optional
            key1: 'value1',
            key2: 'value2'
          }
        }
      })
    });
  }
};


var client = new ThingAccessClient(config, callbacks);
client.setup()
  .then(() => {
    return client.registerAndOnline();
  })
  .then(() => {
    // Push events and properties to LinkEdge platform.
    return new Promise(() => {
      setInterval(() => {
        client.reportEvent('high_temperature', {temperature: 41});
        client.reportProperties({
          'temperature': 41,
        });
      }, 2000);
    });
  })
  .then(() => {
    return client.offline();
  })
  .then(() => {
    return client.cleanup();
  })
  .catch(err => {
    console.log(err);
  });
