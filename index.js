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

const Thing = require('./lib/thing');
const Config = require('./lib/config');
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

// Error no. for callbacks.
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

// Errors
/**
 * Code for errors thrown during setting up.
 *
 * @type {String}
 */
const ERROR_SETUP = ThingAccess.ERROR_SETUP;
/**
 * Code for errors thrown during cleaning up.
 *
 * @type {String}
 */
const ERROR_CLEANUP = ThingAccess.ERROR_CLEANUP;
/**
 * Code for errors thrown during connecting.
 *
 * @type {String}
 */
const ERROR_CONNECT = ThingAccess.ERROR_CONNECT;
/**
 * Code for errors thrown during disconnecting.
 *
 * @type {String}
 */
const ERROR_DISCONNECT = ThingAccess.ERROR_DISCONNECT;
/**
 * Code for errors thrown during getting TSL.
 *
 * @type {String}
 */
const ERROR_GET_TSL = ThingAccess.ERROR_GET_TSL;

/**
 * Code for errors thrown during getting custom config.
 *
 * @type {String}
 */
const ERROR_GET_CONFIG = ThingAccess.ERROR_GET_CONFIG;
/**
 * Code for errors thrown during unregistering.
 *
 * @type {String}
 */
const ERROR_UNREGISTER = ThingAccess.ERROR_UNREGISTER;

/**
 * Returns the associated {@link Config}.
 *
 * @returns {Promise<Config>}
 */
function getConfig() {
  return new Promise((resolve) => {
    resolve(ThingAccess.getDriverConfig())
  }).then((config) => {
    return new Config(config);
  });
}

/**
 * A wrapper client of APIs for connecting things to Link IoT Edge and interactions
 * between them.
 * <p>
 * The most common use is as follows:
 * <pre>
 *  const callbacks = {
      setProperties: function(properties) {
        // Set properties to the physical thing and return the result.
        // Return an object representing the result or the promise wrapper of the object.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      },
      getProperties: function(keys) {
        // Get properties from the physical thing and return the result.
        // Return an object representing the result or the promise wrapper of the object.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      },
      callService: function(name, args) {
        // Call services on the physical thing and return the result.
        // Return an object representing the result or the promise wrapper of the object.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      }
    };
    getConfig()
      .then(config => {
        const things = config.getThings();
        things.forEach(thing => {
          const client = new ThingAccessClient(thing, callbacks);
          client.registerAndOnline()
            .then(() => {
              return new Promise(() => {
                setInterval(() => {
                  client.reportEvent('high_temperature', { temperature: 41 });
                  client.reportProperties({ 'temperature': 41 });
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
          });
        });
 * </pre>
 */
class ThingAccessClient {

  /**
   * Constructs a {@link ThingAccessClient} with the specified <code>config</code> and
   * <code>callbacks</code>.
   *
   * @param {Object} config the meta data config about the client.
   * @param {Object} callbacks callback functions responding to the requests from Link IoT Edge.
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
   * Performs common initialization and setup operations.
   *
   * @deprecated It's no need to call this method any more since it is called prior to
   * any other methods automatically.
   *
   * @returns {Promise<Void>}
   */
  setup() {
    return this.impl.setup();
  }

  /**
   * Registers thing to Link IoT Edge and informs it that thing is connected.
   * When register, {@link DEVICE_NAME} will be used first if it exists, or
   * {@link LOCAL_NAME} is used.
   *
   * @returns {Promise<Void>}
   */
  registerAndOnline() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.online();
    });
  }

  /**
   * Reports a event to Link IoT Edge.
   *
   * @param {String} eventName the name of the event.
   * @param {Object} args the parameters attached to the event.
   *
   * @returns {Promise<Boolean>} Returns true if the event has been posted to the
   *                              underlying message queue, or false.
   */
  reportEvent(eventName, args) {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      this.impl.signalEvent(eventName, args);
    });
  }

  /**
   * Reports new property values to Link IoT Edge.
   *
   * @param {Object} properties the new properties.
   *
   * @returns {Promise<Boolean>} Returns true if the event has been posted to the
   *                              underlying message queue, or false.
   */
  reportProperties(properties) {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      this.impl.signalProperties(properties);
    });
  }

  /**
   * Informs Link IoT Edge that thing is connected.
   *
   * @returns {Promise<Void>}
   */
  online() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.impl.connect();
    });
  }

  /**
   * Informs Link IoT Edge that thing is disconnected.
   *
   * @returns {Promise<Void>}
   */
  offline() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.impl.disconnect();
    });
  }

  /**
   * Returns the TSL(Thing Specification Language) string.
   *
   * @returns {Promise<String>}
   */
  getTsl() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.impl.getTsl();
    });
  }

  /**
   * Called at the end of the usage of the instance to release resources.
   *
   * @returns {Promise<Void>}
   */
  cleanup() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.impl.cleanup();
    });
  }

  /**
   * Removes the binding relationship between thing and Link IoT Edge. You
   * usually don't call this function.
   *
   * @returns {Promise<Void>}
   */
  unregister() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.impl.unregister();
    });
  }
}

module.exports = {
  // Used for callbacks
  RESULT_SUCCESS,
  RESULT_FAILURE,
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
  SET_PROPERTIES,
  GET_PROPERTIES,
  CALL_SERVICE,
  // Used for errors
  ERROR_SETUP,
  ERROR_CLEANUP,
  ERROR_CONNECT,
  ERROR_DISCONNECT,
  ERROR_GET_TSL,
  ERROR_GET_CONFIG,
  ERROR_UNREGISTER,
  // Used for configs
  PRODUCT_KEY,
  DEVICE_NAME,
  LOCAL_NAME,
  getConfig,
  Config,
  Thing,
  ThingAccessClient,
};
