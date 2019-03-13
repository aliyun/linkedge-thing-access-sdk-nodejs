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
  Config,
} = require('linkedge-thing-access-sdk');

// Max retry interval in seconds for registerAndOnline.
const MAX_RETRY_INTERVAL = 30;

// Wraps registering and connecting to Link IoT Edge with back off retry policy.
function registerAndOnlineWithBackOffRetry(client, retryInterval) {
  return new Promise((resolve) => {
    function retry(interval) {
      client.registerAndOnline()
        .then(() => resolve())
        .catch((err) => {
          console.log(
            `RegisterAndOnline failed due to ${err}, retry in ${interval} seconds...`);
          setTimeout(() => {
            const nextInterval = Math.min(MAX_RETRY_INTERVAL, interval * 2);
            retry(nextInterval);
          }, interval * 1000);
        });
    }

    retry(retryInterval);
  });
}

/**
 * A dummy light sensor which starts to publish illuminance between 100 and 600 with 100
 * delta changes once someone listen to it.
 */
class LightSensor {
  constructor() {
    this._illuminance = 200;
    this._delta = 100;
  }

  get illuminance() {
    return this._illuminance;
  }

  // Start to work.
  start() {
    if (this._clearInterval) {
      this._clearInterval();
    }
    console.log('Starting light sensor...');
    const timeout = setInterval(() => {
      // Update illuminance and delta.
      let delta = this._delta;
      let illuminance = this._illuminance;
      if (illuminance >= 600 || illuminance <= 100) {
        delta = -delta;
      }
      illuminance += delta;
      this._delta = delta;
      this._illuminance = illuminance;

      if (this._listener) {
        this._listener({
          properties: {
            illuminance,
          }
        });
      }
    }, 2000);
    this._clearInterval = () => {
      clearInterval(timeout);
      this._clearInterval = undefined;
    };
    return this._clearInterval;
  }

  stop() {
    console.log('Stopping light sensor ...');
    if (this._clearInterval) {
      this._clearInterval();
    }
  }

  listen(callback) {
    if (callback) {
      this._listener = callback;
      // Start to work when some one listen to this.
      this.start();
    } else {
      this._listener = undefined;
      this.stop();
    }
  }
}

/**
 * The class combines ThingAccessClient and the thing that connects to Link IoT Edge.
 */
class Connector {
  constructor(config, lightSensor) {
    this.config = config;
    this.lightSensor = lightSensor;
    this._client = new ThingAccessClient(config, {
      setProperties: this._setProperties.bind(this),
      getProperties: this._getProperties.bind(this),
      callService: this._callService.bind(this),
    });
  }

  /**
   * Connects to Link IoT Edge and publishes properties to it.
   */
  connect() {
    return registerAndOnlineWithBackOffRetry(this._client, 1)
      .then(() => {
        return new Promise(() => {
          // Running..., listen to sensor, and report to Link IoT Edge.
          this.lightSensor.listen((data) => {
            const properties = {'MeasuredIlluminance': data.properties.illuminance};
            console.log(`Report properties: ${JSON.stringify(properties)}`);
            this._client.reportProperties(properties);
          });
        });
      })
      .catch(err => {
        console.log(err);
        return this._client.cleanup();
      })
      .catch(err => {
        console.log(err);
      });
  }

  /**
   * Disconnects from Link IoT Edge.
   */
  disconnect() {
    // Clean the listener.
    this.lightSensor.listen(undefined);
    return this._client.cleanup()
      .catch(err => {
        console.log(err);
      });
  }

  _setProperties(properties) {
    console.log('Set properties %s to thing %s-%s', JSON.stringify(properties),
      this.config.productKey, this.config.deviceName);
    return {
      code: RESULT_FAILURE,
      message: 'The property is read-only.',
    };
  }

  _getProperties(keys) {
    console.log('Get properties %s from thing %s-%s', JSON.stringify(keys),
      this.config.productKey, this.config.deviceName);
    if (keys.includes('MeasuredIlluminance')) {
      return {
        code: RESULT_SUCCESS,
        message: 'success',
        params: {
          'MeasuredIlluminance': this.lightSensor.illuminance,
        }
      };
    }
    return {
      code: RESULT_FAILURE,
      message: 'The requested properties does not exist.',
    }
  }

  _callService(name, args) {
    console.log('Call service %s with %s on thing %s-%s', JSON.stringify(name),
      JSON.stringify(args), this.config.productKey, this.config.deviceName);
    return {
      code: RESULT_FAILURE,
      message: 'The requested service does not exist.',
    };
  }
}

// Get the config which is auto-generated when devices are bound to this driver.
Config.get()
  .then((config) => {
    // Get the device information from config, which contains product key, device
    // name, etc. of the device.
    const thingInfos = config.getThingInfos();
    thingInfos.forEach((thingInfo) => {
      const lightSensor = new LightSensor();
      // The Thing format is just right for connector config, pass it directly.
      const connector = new Connector(thingInfo, lightSensor);
      connector.connect();
    });
  });

// This is a handler which never be invoked in the example.
module.exports.handler = function (event, context, callback) {
  console.log(event);
  console.log(context);
  callback(null);
};
