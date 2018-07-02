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

/**
 * A wrapper client of APIs for connecting things to LinkEdge platform and interactions
 * between them.
 * <p>
 * The most common use is as follows:
 * <pre>
 *   const callbacks = {
      setProperties: function (properties) {
        // Set properties to thing and return the result.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      },
      getProperties: function (keys) {
        // Get properties from thing and return them.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      },
      callService: function (name, args) {
        // Call services on thing and return the result.
        return {
          code: RESULT_SUCCESS,
          message: 'success';
        };
      }
    };
    const config = {
      productKey: 'Your Product Key',
      deviceName: 'Your Device Name',
    };
    const client = new ThingAccessClient(config, callbacks);
    client.setup()
      .then(() => {
        return client.registerAndOnline();
      })
      .then(() => {
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
        return client.cleanup()
      })
      .catch(err => {
        console.log('Error: ' + err);
      });
 * </pre>
 */
class ThingAccessClient {

  /**
   * Constructs a {@link ThingAccessClient} with the specified <code>config</code> and
   * <code>callbacks</code>.
   *
   * @param {Object} config the meta data config about the client.
   * @param {Object} callbacks callbacks to response the requests from LinkEdge platform.
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
   * Performs common constructor initialization and setup.
   *
   * @returns {Promise<Void>}
   */
  setup() {
    return this.impl.setup();
  }

  /**
   * Registers the thing to LinkEdge platform and informs that the thing is connected.
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
   * Reports a event to LinkEdge platform when happened on thing.
   *
   * @param {String} eventName the name of the event.
   * @param {Object} args the parameters attached to the event.
   */
  reportEvent(eventName, args) {
    this.impl.signalEvent(eventName, args);
  }

  /**
   * Reports new property values to LinkEdge platform when some of them changed on thing.
   *
   * @param {Object} properties the new properties.
   */
  reportProperties(properties) {
    this.impl.signalProperties(properties);
  }

  /**
   * Informs LinkEdge platform that the thing has connected.
   *
   * @returns {Promise<Void>}
   */
  online() {
    return this.impl.connect();
  }

  /**
   * Informs LinkEdge platform that the thing has disconnected.
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
   * Removes the binding between the thing and LinkEdge platform. Usually you don't call
   * this function.
   *
   * @returns {Promise<Void>}
   */
  unregister() {
    return this.impl.unregister();
  }
}

module.exports = {
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
