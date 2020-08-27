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

const ThingInfo = require('./lib/thing-info');
const Config = require('./lib/config');
const {
  session,
  ThingAccess,
  ThingAccessClient,
  DriverConfigManager,
} = require('./lib/thing-access');

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
 * Code for the error thrown during setting up.
 *
 * @type {String}
 */
const ERROR_SETUP = ThingAccessClient.ERROR_SETUP;
/**
 * Code for the error thrown during cleaning up.
 *
 * @type {String}
 */
const ERROR_CLEANUP = ThingAccess.ERROR_CLEANUP;
/**
 * Code for the error thrown during connecting.
 *
 * @type {String}
 */
const ERROR_CONNECT = ThingAccess.ERROR_CONNECT;
/**
 * Code for the error thrown during disconnecting.
 *
 * @type {String}
 */
const ERROR_DISCONNECT = ThingAccess.ERROR_DISCONNECT;
/**
 * Code for the error thrown during getting TSL.
 *
 * @type {String}
 */
const ERROR_GET_TSL = ThingAccess.ERROR_GET_TSL;

/**
 * Code for the error thrown during getting TSL extend info.
 *
 * @type {String}
 */
const ERROR_GET_TSL_EXT_INFO = ThingAccess.ERROR_GET_TSL_EXT_INFO;

/**
 * Code for the error thrown during getting TSL config.
 *
 * @type {String}
 * @deprecated Use {@link ERROR_GET_TSL_EXT_INFO} instead.
 */
const ERROR_GET_TSL_CONFIG = ERROR_GET_TSL_EXT_INFO;

/**
 * Code for the error thrown during getting custom config.
 *
 * @type {String}
 */
const ERROR_GET_CONFIG = ThingAccess.ERROR_GET_CONFIG;
/**
 * Code for the error thrown during unregistering.
 *
 * @type {String}
 */
const ERROR_UNREGISTER = ThingAccess.ERROR_UNREGISTER;

/**
 * Returns the global config string.
 *
 * @returns {Promise<String>}
 */
function getConfig() {
  return DriverConfigManager.get().getConfig();
}

// Initializing...
DriverConfigManager.get().listenChanges()
  .catch((err) => {
    console.log(`Failed to listen driver config changes: ${err}.`);
    process.exit(1);
  });

/**
 * Destroys the whole package. It's usually called when it's no longer used.
 *
 * @returns {Promise<Void>}
 */
function destroy() {
  return Promise.resolve(DriverConfigManager.get().unlistenChanges())
    .then(() => {
      return session.finalize();
  });
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
  ERROR_GET_TSL_CONFIG,
  ERROR_GET_TSL_EXT_INFO,
  ERROR_GET_CONFIG,
  ERROR_UNREGISTER,
  // Used for configs
  PRODUCT_KEY,
  DEVICE_NAME,
  LOCAL_NAME,
  getConfig,
  destroy,
  Config,
  ThingInfo,
  ThingAccessClient,
};
