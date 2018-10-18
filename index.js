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

const ThingAccess = require('./lib/thing-access');

/**
 * Key for specifying product key in <i>config</i> that passed to {@link ThingAccessClient}
 * constructor.
 *
 * @type {String}
 */
const PRODUCT_KEY = 'productKey';

/**
 * Key for specifying device name in <i>config</i> that passed to {@link ThingAccessClient}
 * constructor. The device name is auto-generated when you create a device on web console.
 * But also you can specify a device local name instead.
 *
 * @type {String}
 * @see {@link LOCAL_NAME}
 */
const DEVICE_NAME = 'deviceName';

/**
 * Key for specifying device local name in <i>config</i> that passed to
 * {@link ThingAccessClient} constructor. This is useful when you'd like to use a local
 * name instead of the auto-generated device name.
 *
 * @type {String}
 * @see {@link DEVICE_NAME}
 */
const LOCAL_NAME = 'localName';

/**
 * Key for specifying a function in <i>callbacks</i> that passed to
 * {@link ThingAccessClient} constructor, which invoking services on thing.
 *
 * @type {String}
 */
const CALL_SERVICE = 'callService';
/**
 * Key for specifying a function in <i>callbacks</i> that passed to
 * {@link ThingAccessClient} constructor, which setting properties to thing.
 *
 * @type {String}
 */
const SET_PROPERTIES = 'setProperties';
/**
 *
 * Key for specifying a function in <i>callbacks</i> that passed to
 * {@link ThingAccessClient} constructor, which getting properties from thing.
 *
 * @type {String}
 */
const GET_PROPERTIES = 'getProperties';

/**
 *
 * A result code representing success.
 *
 * @type {Number}
 */
const RESULT_SUCCESS = 0;

/**
 * A result code representing failure.
 *
 * @type {Number}
 */
const RESULT_FAILURE = -3;

// Error no.
const ERROR_PROPERTY_NOT_EXIST = 109002;
const ERROR_PROPERTY_READ_ONLY = 109003;
const ERROR_PROPERTY_WRITE_ONLY = 109004;
const ERROR_SERVICE_NOT_EXIST = 109005;
const ERROR_SERVICE_INVALID_PARAM = 109006;
const ERROR_INVALID_JSON = 109007;
const ERROR_INVALID_TYPE = 109008;

const ERROR_UNKNOWN = 100000;
const ERROR_TIMEOUT = 100006;
const ERROR_PARAM_RANGE_OVERFLOW = 100007;
const ERROR_SERVICE_UNREACHABLE = 100008;
const ERROR_FILE_NOT_EXIST = 100009;

/**
 * A wrapper client of APIs for connecting things to Link IoT Edge platform and interactions
 * between them.
 * <p>
 * The most common use is as follows:
 * <pre>
 *   const callbacks = {
      setProperties: function (properties) {
        // Set properties to the physical thing and return the result.
        // Return an object representing the result or the promise wrapper of the object.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      },
      getProperties: function (keys) {
        // Get properties from the physical thing and return the result.
        // Return an object representing the result or the promise wrapper of the object.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      },
      callService: function (name, args) {
        // Call services on the physical thing and return the result.
        // Return an object representing the result or the promise wrapper of the object.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      }
    };
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
    const client = new ThingAccessClient(config, callbacks);
    client.setup()
      .then(() => {
        return client.registerAndOnline();
      })
      .then(() => {
        return new Promise(() => {
          setInterval(() => {
            client.reportEvent('high_temperature', {temperature: 41});
            client.reportProperties({'temperature': 41});
          }, 2000);
        });
      })
      .catch(err => {
        console.log(err);
        client.cleanup();
      });
      .catch(err => {
        console.log(err);
      });
 * </pre>
 */
class ThingAccessClient {

  /**
   * Constructs a {@link ThingAccessClient} with the specified <code>config</code> and
   * <code>callbacks</code>.
   *
   * @param {Object} config the meta data config about the client.
   * @param {Object} callbacks callback functions responding to the requests from Link IoT Edge platform.
   */
  constructor(config, callbacks) {
    if (!callbacks || !callbacks.getProperties || !callbacks.setProperties
      || !callbacks.callService) {
      throw new Error('Illegal callbacks');
    }
    if (!config || !config.productKey || (!config.deviceName && !config.localName)) {
      throw new Error('Illegal config');
    }
    this.impl = new ThingAccess(config, callbacks);
  }

  /**
   * Performs common constructor initialization and setup operations.
   *
   * @returns {Promise<Void>}
   */
  setup() {
    return this.impl.setup();
  }

  /**
   * Registers thing to Link IoT Edge platform and informs it that thing is connected.
   * When register, {@link DEVICE_NAME} will be used first if it exists, or
   * {@link LOCAL_NAME} is used.
   *
   * @returns {Promise<Void>}
   */
  registerAndOnline() {
    return this.impl.register()
      .then(() => {
        return this.impl.connect();
      });
  }

  /**
   * Reports a event to Link IoT Edge platform.
   *
   * @param {String} eventName the name of the event.
   * @param {Object} args the parameters attached to the event.
   */
  reportEvent(eventName, args) {
    this.impl.signalEvent(eventName, args);
  }

  /**
   * Reports new property values to Link IoT Edge platform.
   *
   * @param {Object} properties the new properties.
   */
  reportProperties(properties) {
    this.impl.signalProperties(properties);
  }

  /**
   * Informs Link IoT Edge platform that thing is connected.
   *
   * @returns {Promise<Void>}
   */
  online() {
    return this.impl.connect();
  }

  /**
   * Informs Link IoT Edge platform that thing is disconnected.
   *
   * @returns {Promise<Void>}
   */
  offline() {
    return this.impl.disconnect();
  }

  /**
   * Returns the TSL(Thing Specification Language) string.
   *
   * @returns {Promise<String>}
   */
  getTsl() {
    return this.impl.getTsl();
  }

  /**
   * Called at the end of the usage of the instance to release resources.
   *
   * @returns {Promise<Void>}
   */
  cleanup() {
    return this.impl.cleanup();
  }

  /**
   * Removes the binding relationship between thing and Link IoT Edge platform. You
   * usually don't call this function.
   *
   * @returns {Promise<Void>}
   */
  unregister() {
    return this.impl.unregister();
  }
}

module.exports = {
  ERROR_PROPERTY_NOT_EXIST,
  ERROR_PROPERTY_READ_ONLY,
  ERROR_PROPERTY_WRITE_ONLY,
  ERROR_SERVICE_NOT_EXIST,
  ERROR_SERVICE_INVALID_PARAM,
  ERROR_INVALID_JSON,
  ERROR_INVALID_TYPE,
  ERROR_UNKNOWN,
  ERROR_TIMEOUT,
  ERROR_PARAM_RANGE_OVERFLOW,
  ERROR_SERVICE_UNREACHABLE,
  ERROR_FILE_NOT_EXIST,
  PRODUCT_KEY,
  DEVICE_NAME,
  LOCAL_NAME,
  SET_PROPERTIES,
  GET_PROPERTIES,
  CALL_SERVICE,
  RESULT_SUCCESS,
  RESULT_FAILURE,
  ThingAccessClient,
};
