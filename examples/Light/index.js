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

/*
 * The example demonstrates connecting a simulated light to a LinkEdge gateway
 * using LinkEdge Thing Access Node.js SDK. The light reports its switch state
 * once the state changed. Since the function is long-lived it will run forever
 * when deployed to a LinkEdge gateway.
 */

'use strict';

const {
  RESULT_SUCCESS,
  RESULT_FAILURE,
  ThingAccessClient,
} = require('linkedge-thing-access-sdk');

// Retrieves configs from the FC_DRIVER_CONFIG variable.
var driverConfig;
try {
  driverConfig = JSON.parse(process.env.FC_DRIVER_CONFIG)
} catch (err) {
  throw new Error('The driver config is not in JSON format!');
}
var configs = driverConfig['deviceList'];
if (!Array.isArray(configs) || configs.length === 0) {
  throw new Error('No device is bound with the driver!');
}

var args = configs.map((config) => {
  var self = {
    lightSwitch: {
      isOn: true,
    },
    config,
    callbacks: {
      setProperties: function (properties) {
        console.log('Set properties %s to thing %s-%s', JSON.stringify(properties),
          config.productKey, config.deviceName);
        if ('LightSwitch' in properties) {
          self.lightSwitch.isOn = properties['LightSwitch'] === 1;
          return {
            code: RESULT_SUCCESS,
            message: 'success',
          };
        }
        return {
          code: RESULT_FAILURE,
          message: 'The requested properties does not exist.',
        };
      },
      getProperties: function (keys) {
        console.log('Get properties %s from thing %s-%s', JSON.stringify(keys),
          config.productKey, config.deviceName);
        if (keys.includes('LightSwitch')) {
          return {
            code: RESULT_SUCCESS,
            message: 'success',
            params: {
              'LightSwitch': self.lightSwitch.isOn ? 1 : 0,
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
        return {
          code: RESULT_FAILURE,
          message: 'The requested service does not exist.',
        };
      }
    },
  };
  return self;
});

// Connects to LinkEdge platform.
args.forEach((item) => {
  var client = new ThingAccessClient(item.config, item.callbacks);
  client.setup()
    .then(() => {
      return client.registerAndOnline();
    })
    .then(() => {
      // Push events and properties to LinkEdge platform.
      return new Promise(() => {
        var properties = {'LightSwitch': item.lightSwitch.isOn ? 1 : 0};
        client.reportProperties(properties);

        var isOn = item.lightSwitch.isOn;
        setInterval(() => {
          if (isOn !== item.lightSwitch.isOn) {
            // Properties changed, report it.
            properties = {'LightSwitch': item.lightSwitch.isOn ? 1 : 0};
            console.log(`Report properties: ${JSON.stringify(properties)}`);
            client.reportProperties(properties);
            isOn = item.lightSwitch.isOn;
          }
        }, 2000);
      });
    })
    .catch(err => {
      console.log(err);
      client.cleanup();
    })
    .catch(err => {
      console.log(err);
    });
});

// This is a handler which never be invoked in the example.
module.exports.handler = function (event, context, callback) {
  console.log(event);
  console.log(context);
  callback(null);
};
