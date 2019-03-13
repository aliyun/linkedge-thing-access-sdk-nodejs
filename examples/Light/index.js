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
 * The example demonstrates connecting a simulated light to a Link IoT Edge gateway
 * using Link IoT Edge Thing Access Node.js SDK. The light reports its switch state
 * once the state changed. Since the function is long-lived it will run forever
 * when deployed to a Link IoT Edge gateway.
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
 * A dummy light which can be turned on or off by updating its <code>isOn</code> property.
 */
class Light {
  constructor() {
    this._isOn = true;
  }

  get isOn() {
    return this._isOn;
  }

  set isOn(value) {
    return this._isOn = value;
  }
}

/**
 * The class combines ThingAccessClient and the thing that connects to Link IoT Edge.
 */
class Connector {
  constructor(config, light) {
    this.config = config;
    this.light = light;
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
          // Publish properties to Link IoT Edge.
          const properties = { 'LightSwitch': this.light.isOn ? 1 : 0 };
          this._client.reportProperties(properties);
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
   * Disconnects from Link IoT Edge and stops publishing properties to it.
   */
  disconnect() {
    return this._client.cleanup()
      .catch(err => {
        console.log(err);
      });
  }

  _setProperties(properties) {
    console.log('Set properties %s to thing %s-%s', JSON.stringify(properties),
      this.config.productKey, this.config.deviceName);
    if ('LightSwitch' in properties) {
      var value = properties['LightSwitch'];
      var isOn = value === 1;
      if (this.light.isOn !== isOn) {
        // Report new property to Link IoT Edge if it changed.
        this.light.isOn = isOn;
        if (this._client) {
          properties = {'LightSwitch': value};
          console.log(`Report properties: ${JSON.stringify(properties)}`);
          this._client.reportProperties(properties);
        }
      }
      return {
        code: RESULT_SUCCESS,
        message: 'success',
      };
    }
    return {
      code: RESULT_FAILURE,
      message: 'The requested properties does not exist.',
    };
  }

  _getProperties(keys) {
    console.log('Get properties %s from thing %s-%s', JSON.stringify(keys),
      this.config.productKey, this.config.deviceName);
    if (keys.includes('LightSwitch')) {
      return {
        code: RESULT_SUCCESS,
        message: 'success',
        params: {
          'LightSwitch': this.light.isOn ? 1 : 0,
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
      const light = new Light();
      // The Thing format is just right for connector config, pass it directly.
      const connector = new Connector(thingInfo, light);
      connector.connect();
    });
  });

// This is a handler which never be invoked in the example.
module.exports.handler = function (event, context, callback) {
  console.log(event);
  console.log(context);
  callback(null);
};
