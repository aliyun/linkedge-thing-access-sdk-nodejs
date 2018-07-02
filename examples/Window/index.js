/*
 * Copyright (c) 2018 Alibaba Group Holding Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const {
  RESULT_SUCCESS,
  RESULT_FAILURE,
  ThingAccessClient,
} = require('linkedge-thing-access-sdk');

var configs = [
  {
    productKey: 'Your Product Key',
    deviceName: 'Your Device Name'
  },
];
var args = configs.map((config) => {
  var self = {
    // The simulated window device.
    window: {
      // This state is read-only.
      isOpen: false,
      open: function () {
        this.isOpen = true;
      },
      close: function () {
        this.isOpen = false;
      }
    },
    config,
    callbacks: {
      setProperties: function (properties) {
        console.log('Set properties %s to thing %s-%s', JSON.stringify(properties),
          config.productKey, config.deviceName);
        return {
          code: RESULT_FAILURE,
          message: 'The property is read-only.',
        };
      },
      getProperties: function (keys) {
        console.log('Get properties %s from thing %s-%s', JSON.stringify(keys),
          config.productKey, config.deviceName);
        if (keys.includes('isOpen')) {
          return {
            code: RESULT_SUCCESS,
            message: 'success',
            params: {
              isOpen: self.window.isOpen ? 1 : 0,
            }
          };
        }
        return {
          code: RESULT_FAILURE,
          message: 'The requested properties does not exist.',
        }
      },
      callService: function (name, args) {
        console.log('Call service %s with %s on thing %s-%s', JSON.stringify(name),
          JSON.stringify(args), config.productKey, config.deviceName);
        if (name === 'open' || name === 'close') {
          self.window[name]();
          return {
            code: RESULT_SUCCESS,
            message: 'success',
          };
        }
        return {
          code: RESULT_FAILURE,
          message: 'The requested service does not exist.',
        };
      }
    },
  };
  return self;
});
args.forEach((item) => {
  var client = new ThingAccessClient(item.config, item.callbacks);
  client.setup()
    .then(() => {
      return client.registerAndOnline();
    })
    .then(() => {
      return new Promise(() => {
        console.log('Waiting here...');
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
});

module.exports.handler = function (event, context, callback) {
  console.log(event);
  console.log(context);
  callback(null);
};
