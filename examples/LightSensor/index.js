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
 * The example demonstrates connecting a simulated light sensor to a Link IoT Edge
 * gateway using Link IoT Edge Thing Access Node.js SDK. The sensor will continuously
 * report the measured illuminance. Since the function is long-lived it will run
 * forever when deployed to a Link IoT Edge gateway.
 */

'use strict';

const {
  RESULT_SUCCESS,
  RESULT_FAILURE,
  ThingAccessClient,
} = require('linkedge-thing-access-sdk');

// Max retry interval in seconds for registerAndOnline.
const MAX_RETRY_INTERVAL = 30;

// Retrieves configs from the FC_DRIVER_CONFIG environment variable.
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
    lightSensor: {
      // Properties.
      illuminance: 200,
      delta: 100,

      // Start to work.
      start: function () {
        console.log('Starting light sensor...');
        setInterval(function () {
          // Update illuminance and delta.
          var delta = self.lightSensor.delta;
          var illuminance = self.lightSensor.illuminance;
          if (illuminance >= 600 || illuminance <= 100) {
            delta = -delta;
          }
          illuminance += delta;
          self.lightSensor.delta = delta;
          self.lightSensor.illuminance = illuminance;

          if (self.lightSensor.listener) {
            self.lightSensor.listener({
              properties: {
                illuminance,
              }
            });
          }
        }, 2000);
      },

      listen: function(callback) {
        if (callback) {
          self.lightSensor.listener = callback;
          // Start to work when some one listen to this.
          self.lightSensor.start();
        }
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
        if (keys.includes('MeasuredIlluminance')) {
          return {
            code: RESULT_SUCCESS,
            message: 'success',
            params: {
              'MeasuredIlluminance': self.lightSensor.illuminance,
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

// Connects to Link IoT Edge platform.
args.forEach((item) => {
  var client = new ThingAccessClient(item.config, item.callbacks);
  client.setup()
    .then(() => {
      // Initially, try with 1 second retry interval.
      return registerAndOnlineWithBackOffRetry(client, 1);
    })
    .then(() => {
      // Rejects the client reference into the item.
      item.client = client;

      // Running..., listen to sensor, and report to Link IoT Edge.
      item.lightSensor.listen((data) => {
        if (data && data.properties && data.properties.illuminance) {
          var properties = {'MeasuredIlluminance': data.properties.illuminance};
          console.log(`Report properties: ${JSON.stringify(properties)}`);
          client.reportProperties(properties);
        }
      });
    })
    .catch(err => {
      console.log(err);
      return client.cleanup();
    })
    .catch(err => {
      console.log(err);
    });
});

function registerAndOnlineWithBackOffRetry(client, retryInterval) {
  return new Promise((resolve) => {
    function retry(interval) {
      client.registerAndOnline()
        .then(() => resolve())
        .catch((err) => {
          console.log(`RegisterAndOnline failed due to ${err}, retry in ${interval} seconds...`);
          setTimeout(() => {
            var nextInterval = Math.min(MAX_RETRY_INTERVAL, interval * 2);
            retry(nextInterval);
          }, interval * 1000);
        });
    }
    retry(retryInterval);
  });
}

// This is a handler which never be invoked in the example.
module.exports.handler = function (event, context, callback) {
  console.log(event);
  console.log(context);
  callback(null);
};
