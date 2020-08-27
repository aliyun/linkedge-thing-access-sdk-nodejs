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

// The module which helping connect things to Link IoT Edge. The main error
// handling policy here is described as follows. Suppose a case that we have
// 4 steps to accomplish a task. If the task is registering, allocating or
// requesting resources and it fails in step 3, the error handling policy is
// ignoring failure and unregistering, freeing or releasing resources which
// got from previous steps. If the task is reversed, that is we have 4 steps
// to unregister, free or release resources and fails in step 3, the policy
// is ignoring the error, and going on to do step 4.

'use strict';

const dbus = require('dbus-native');
const EventEmitter = require('events');

const MODULE_NAME = process.env.FUNCTION_ID;
if (!MODULE_NAME) {
  throw new Error(`Can't get FUNCTION_ID from runtime.`);
}

const FUNCTION_NAME = process.env.FUNCTION_NAME;
if (!FUNCTION_NAME) {
  throw new Error(`Can't get FUNCTION_NAME from runtime.`);
}

const MODULE_SERVICE_NAME = `iot.driver.id${MODULE_NAME}`;
const MODULE_OBJECT_PATH = `/iot/driver/id${MODULE_NAME}`;
const MODULE_INTERFACE_NAME = MODULE_SERVICE_NAME;

const ERROR_REGISTER_MODULE = 'register_module';
const ERROR_SETUP = 'setup';
const ERROR_CLEANUP = 'cleanup';
const ERROR_CONNECT = 'connect';
const ERROR_DISCONNECT = 'disconnect';
const ERROR_GET_TSL = 'get_tsl';
const ERROR_GET_TSL_EXT_INFO = 'get_tsl_ext_info';
const ERROR_GET_CONFIG = 'get_config';
const ERROR_UNREGISTER = 'unregister';

// Add finally shim to Promise.
if (!Promise.prototype.finally) {
  Promise.prototype.finally = function (callback) {
    var P = this.constructor;
    return this.then(
      value => P.resolve(callback()).then(() => value),
      reason => P.resolve(callback()).then(() => { throw reason })
    );
  };
}

// Default result handler for responses from remote services.
function handleDefaultResult(error, result) {
  console.info(`Handle default result: ${error}, ${result}.`);
  if (error) {
    throw error;
  }
  if (!result) {
    throw new Error('Illegal result from remote service.');
  }
  var parsed;
  try {
    parsed = JSON.parse(result);
  } catch (err) {
    throw new Error('Default result is not JSON string.');
  }
  if (parsed.code !== 0) {
    throw new Error(parsed.message);
  }
  return parsed;
}

// Throw a error with code and message.
function throwError(code, message, error) {
  if (message instanceof Error) {
    error = message;
  } else {
    if (error) {
      error.message = message;
    } else {
      error = new Error(message);
    }
  }
  error.code = code;
  throw error;
}

// Session which manages the wrapper of bus and some global states.
class Session {
  constructor() {
    this._reset();
  }

  initialize() {
    if (!this._initializePromise) {
      this._initializePromise = new Promise((resolve) => {
        console.info('Initialize edge bus...');
        resolve(this._initializeEdgeBus());
      }).then(() => {
        return this.requestName(MODULE_SERVICE_NAME)
      }).then(() => {
        this._exportModuleInterface();
        return this._registerModule();
      }).then(() => {
        console.info('Initialize successfully!');
        this._finalizePromise = undefined;
      }).catch(err => {
        var rollback = () => {
          this.configInterface = undefined;
          this.dimuInterface = undefined;
          if (this.edgeBus) {
            this.edgeBus.connection.end();
            this.edgeBus = undefined;
          }
          this._initializePromise = undefined;
          // Re-throw this error
          throw err;
        };
        if (err.code === ERROR_REGISTER_MODULE) {
          return this.releaseName(MODULE_SERVICE_NAME)
            .then(rollback, rollback);
        }
        rollback();
      });
    }
    return this._initializePromise;
  }

  finalize() {
    if (!this._finalizePromise) {
      this._finalizePromise = new Promise((resolve) => {
        console.info(`Finalize...`);
        resolve(this._unregisterModule());
      }).then(() => {
        var reset = () => {
          this.emitter.removeAllListeners();
          this.connectedThings.clear();
          this.things.clear();
          this.configInterface = undefined;
          this.dimuInterface = undefined;
          if (this.edgeBus) {
            this.edgeBus.connection.end();
            this.edgeBus = null;
          }
          this._initializePromise = undefined;
          console.info(`Finalize successfully!`);
        };
        return this.releaseName(MODULE_SERVICE_NAME)
          .then(reset, reset /* Do NOT throw the err! It's finalizing. */);
      }).catch(err => {
        this._finalizePromise = undefined;
        throw err;
      });
    }
    return this._finalizePromise;
  }

  requestName(serviceName) {
    console.info(`Request service name ${serviceName}.`);
    return new Promise((resolve) => {
      if (!this.edgeBus) {
        throw new Error('Client has not been setup or has been cleanup.');
      }
      this.edgeBus.requestName(serviceName, 0x4, (err, retCode) => {
        // If there was an error, warn user and fail
        if (err) {
          throw new Error(
            `Could not request service name ${serviceName}, the error is ${err}.`
          );
        }
        // Return code 0x1 means we successfully have the name
        if (retCode === 1) {
          console.log(`Successfully requested service name "${serviceName}"!`);
          resolve();
        } else {
          const reason = retCode === 3 ? 'already exists' : `errno ${retCode}`;
          throw new Error(
            `Failed to request service name ${serviceName}: ${reason}.`
          );
        }
      });
    });
  }

  releaseName(serviceName) {
    console.info(`Release service name ${serviceName}.`);
    return new Promise((resolve, reject) => {
      if (!this.edgeBus) {
        throw new Error('Client has not been setup or has been cleanup.');
      }
      this.edgeBus.releaseName(serviceName, (err) => {
        err ? reject(err) : resolve();
      });
    });
  }

  exportInterface(iface, objPath, ifaceDesc) {
    if (!this.edgeBus) {
      throw new Error('Client has not been setup or has been cleanup.');
    }
    this.edgeBus.exportInterface(iface, objPath, ifaceDesc);
  }

  message(msg) {
    if (!this.edgeBus) {
      throw new Error('Client has not been setup or has been cleanup.');
    }
    msg.serial = this.edgeBus.serial++;
    this.edgeBus.connection.message(msg);
  }

  /**
   * Register the module to DIMU.
   *
   * @returns {Promise<Void>}
   * @private
   */
  _registerModule() {
    return new Promise((resolve) => {
      if (!this.dimuInterface) {
        throwError(ERROR_REGISTER_MODULE,
          'Client has not been setup or has been cleanup.');
      }
      var info = {
        'params': {
          'driverLocalId': FUNCTION_NAME,
          'driverStartupTime': `${Date.now()}`,
        }
      };
      var str = JSON.stringify(info);
      console.info(`Register module to dimu ${str}.`);
      this.dimuInterface.registerDriver(str, (err, result) => {
        console.info('Return from registering module to dimu.');
        try {
          handleDefaultResult(err, result);
        } catch (error) {
          // Rethrow the error with code.
          throwError(ERROR_REGISTER_MODULE, error);
        }
        resolve();
      });
    });
  }

  /**
   * Unregister the module from DIMU.
   *
   * @returns {Promise<Void>}
   * @private
   */
  _unregisterModule() {
    return new Promise((resolve) => {
      if (!this.dimuInterface) {
        throw new Error('Client has not been setup or has been cleanup.');
      }
      var info = {
        'params': {
          'driverLocalId': MODULE_NAME,
        }
      };
      var str = JSON.stringify(info);
      console.info(`Unregister module from dimu ${str}.`);
      this.dimuInterface.unregisterDriver(str, (err, result) => {
        handleDefaultResult(err, result);
        resolve();
      });
    });
  }

  _initializeEdgeBus() {
    return this._connectToEdgeBus()
      .then((edgeBus) => {
        this.edgeBus = edgeBus;
        this.edgeBus.connection.once('error', err => {
          // TODO: Just print the error? Should we end the connection?
          console.error(`Connection had a error: ${err}.`);
        });
        return this._getDimuInterface();
      })
      .then((iface) => {
        this.dimuInterface = iface;
        return this._getConfigInterface();
      })
      .then((iface) => {
        this.configInterface = iface;
      });
  }

  _connectToEdgeBus() {
    return new Promise((resolve, reject) => {
      console.info('Connect to edge bus.');
      var edgeBus = dbus.createClient({
        busAddress: 'unix:path=/tmp/var/run/mbusd/mbusd_socket'
      });
      edgeBus.connection.once('error', err => {
        reject(err);
      });
      edgeBus.connection.once('connect', () => {
        resolve(edgeBus);
      });
    });
  }

  _getDimuInterface() {
    return this._getDefaultInterface('iot.dmp.dimu');
  }

  _getConfigInterface() {
    return this._getDefaultInterface('iot.dmp.configmanager');
  }

  _getDefaultInterface(serviceName) {
    var defaultObjectPath = `/${serviceName.replace(/\./g, '/')}`;
    var defaultInterface = serviceName;
    console.info(`Get service default interface ${defaultInterface}.`);
    return new Promise((resolve, reject) => {
      if (!this.edgeBus) {
        throw new Error('Client has not been setup or has been cleanup.');
      }
      this.edgeBus.getService(serviceName).getInterface(defaultObjectPath, defaultInterface,
        (err, iface) => {
          err ? reject(err) : resolve(iface);
        });
    });
  }

  _exportModuleInterface() {
    console.info(`Export module interface ${MODULE_INTERFACE_NAME}.`);

    const notifyConfigChanges = 'notify_config';
    var self = this;
    var ifaceDesc = {
      name: MODULE_INTERFACE_NAME,
      methods: {
        getDeviceList: ['s', 's', ['selector'], ['result']],
        [notifyConfigChanges]: ['ss', 'i', ['key', 'value'], ['code']],
      },
      signals: {},
      properties: {},
    };
    var iface = {
      getDeviceList: function (selector) {
        var list;
        if (selector) {
          var state = selector.split('=').map(item => item.trim())[1];
          if (state === 'online') {
            list = [...self.connectedThings.keys()];
          } else if (state === 'offline') {
            list = [...self.things.keys()].filter((thingId) => {
              return !self.connectedThings.has(thingId)
            });
          } else {
            list = [...self.things.keys()];
          }
        } else {
          list = [...self.things.keys()];
        }
        var result = {
          code: 0,
          message: 'success',
          params: {
            devNum: list.length,
            devList: list
          }
        };
        return JSON.stringify(result);
      },
      [notifyConfigChanges]: function (key, value) {
        console.info(`Notify config changes: ${key}, ${value}.`);
        self.emitter.emit('config_changed', key, value);
        return 0;
      }
    };
    this.exportInterface(iface, MODULE_OBJECT_PATH, ifaceDesc);
  }

  /**
   * This method is just used for unit tests. It's same as constructor.
   *
   * @private
   */
  _reset() {
    if (this.edgeBus) {
      this.edgeBus.connection.end();
    }
    this.edgeBus = undefined;
    this.dimuInterface = undefined;
    this.configInterface = undefined;
    this.things = new Set();
    this.connectedThings = new Set();
    this.emitter = new EventEmitter();

    this._initializePromise = undefined;
    this._finalizePromise = undefined;
  }
}

const session = new Session();

// The key for driver config in config manager.
const KEY_DRIVER_CONFIG = `gw_driverconfig_${MODULE_NAME}`;

var manager;
class DriverConfigManager extends EventEmitter {

  static get() {
    if (!manager) {
      manager = new DriverConfigManager(session);
    }
    return manager;
  }

  constructor(session) {
    super();
    this.session = session;
    this._onConfigChanged = this._onConfigChanged.bind(this);
  }

  getConfig() {
    return new Promise((resolve) => {
      resolve(this.session.initialize());
    }).then(() => {
      return new Promise((resolve) => {
        console.info(`Getting driver config...`);
        var getConfig = 'get_config';
        session.configInterface[getConfig](KEY_DRIVER_CONFIG, (err, code, result) => {
          if (err) {
            throw err;
          }
          if (code !== 0) {
            throw new Error(`Get config failed: errno = ${code}`);
          }
          // Parse and extract useful parts.
          const parsed = JSON.parse(result);
          const res = JSON.stringify({
            deviceList: parsed.deviceList,
            config: parsed.config,
          });
          console.info(`Got driver config: ${res}`);
          resolve(res);
        });
      });
    });
  }

  _onConfigChanged(key, value) {
    if (key === KEY_DRIVER_CONFIG) {
      this.emit('changes', value);
    }
  }

  listenChanges() {
    return new Promise((resolve) => {
      resolve(this.session.initialize());
    }).then(() => {
      this.session.emitter.on('config_changed', this._onConfigChanged);
    }).then(() => {
      return new Promise((resolve) => {
        console.info(`Subscribing driver config...`);
        var subscribeConfig = 'subscribe_config';
        session.configInterface[subscribeConfig](MODULE_SERVICE_NAME, KEY_DRIVER_CONFIG,
          1, (err, code) => {
            if (err) {
              throw err;
            }
            if (code !== 0) {
              throw new Error(`Subscribe driver config failed: errno = ${code}`);
            }
            console.info('Subscribe driver config successfully.');
            resolve();
          });
      });
    });
  }

  unlistenChanges() {
    return new Promise((resolve) => {
      resolve(this.session.initialize());
    }).then(() => {
      return new Promise((resolve) => {
        console.info(`Unsubscribing driver config...`);
        var unsubscribeConfig = 'unsubscribe_config';
        this.session.configInterface[unsubscribeConfig](MODULE_SERVICE_NAME, KEY_DRIVER_CONFIG,
          (err, code) => {
            if (err) {
              throw err;
            }
            if (code !== 0) {
              throw new Error(`Unsubscribe driver config failed: errno = ${code}`);
            }
            console.info('Unsubscribe driver config successfully.');
            resolve();
          });
      });
    }).then(() => {
      this.session.emitter.removeListener('config_changed', this._onConfigChanged);
    });
  }
}

class ThingAccess {

  constructor(config, callbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this._thingId = undefined;
    this._thingInterface = undefined;
  }

  setup() {
    if (!this._setupPromise) {
      this._setupPromise = new Promise((resolve) => {
        resolve(session.initialize());
      }).then(() => {
        console.info('Setup successfully!');
        this._unregisterPromise = undefined;
        this._connectPromise = undefined;
        this._disconnectPromise = undefined;
        this._getTslPromise = undefined;
        this._getTslExtInfoPromise = undefined;
        this._cleanupPromise = undefined;
      }).catch(err => {
        // Reset and re-throw the error.
        this._setupPromise = undefined;
        throwError(ERROR_SETUP, err);
      });
    }
    return this._setupPromise;
  }

  connect() {
    var serviceName;
    if (!this._connectPromise) {
      this._connectPromise = new Promise((resolve) => {
        resolve(this._connect(this.config.productKey, this.config.deviceName,
          this.config.localName));
      }).then((thingId) => {
        console.info(`Connect thing to dimu successfully, got thing id ${thingId}!`);
        this._thingId = thingId;
        session.things.add(thingId);
        session.connectedThings.add(thingId);
        serviceName = `iot.device.id${thingId}`;
        return session.requestName(serviceName);
      }).then(() => {
        var objectPath = `/iot/device/id${this._thingId}`;
        var interfaceName = serviceName;
        this._exportDefaultThingInterface(serviceName, objectPath, interfaceName);
        this._disconnectPromise = undefined;
        console.info(`Thing ${this._thingId} is connected to Link IoT Edge.`);
      }).catch(err => {
        var rollback = () => {
          this._connectPromise = undefined;
          throwError(ERROR_CONNECT, err);
        };
        if (this._thingId) {
          var thingId = this._thingId;
          session.connectedThings.delete(thingId);
          session.things.delete(thingId);
          this._thingId = undefined;
          return this._disconnect(thingId)
            .then(rollback, rollback);
        }
        rollback();
      });
    }
    return this._connectPromise;
  }

  signalEvent(eventName, args) {
    var values = {
      params: {
        time: Date.now(),
        value: args,
      }
    };
    this._signalSubscribe(eventName, 's', JSON.stringify(values));
  }

  signalProperties(properties) {
    var props = Object.assign({}, properties);
    for (var key in props) {
      props[key] = {
        value: props[key],
        time: Date.now(),
      };
    }
    this._signalSubscribe('propertiesChanged', 's', JSON.stringify(props));
  }

  getTsl() {
    if (!this._getTslPromise) {
      this._getTslPromise = new Promise((resolve) => {
        console.info(`Getting TSL...`);
        if (!session.configInterface) {
          throwError(ERROR_GET_TSL, 'Client has not been setup or setup failed.');
        }
        var getConfig = 'get_config';
        session.configInterface[getConfig](`gw_TSL_${this.config.productKey}`,
          (err, code, result) => {
            if (err) {
              throwError(ERROR_GET_TSL, err);
            }
            if (code !== 0) {
              throwError(ERROR_GET_TSL, `Get config failed: errno = ${code}`);
            }
            // Check if the result is JSON-welled.
            JSON.parse(result);
            console.info(`Got TSL: ${result}`);
            resolve(result);
          });
      }).catch(err => {
        this._getTslPromise = undefined;
        throwError(ERROR_GET_TSL, err);
      });
    }
    return this._getTslPromise;
  }

  getTslExtInfo() {
    if (!this._getTslExtInfoPromise) {
      this._getTslExtInfoPromise = new Promise((resolve) => {
        console.info(`Getting TSL ext info...`);
        if (!session.configInterface) {
          throwError(ERROR_GET_TSL_EXT_INFO, 'Client has not been setup or setup failed.');
        }
        var getConfig = 'get_config';
        session.configInterface[getConfig](`gw_TSL_config_${this.config.productKey}`,
          (err, code, result) => {
            if (err) {
              throwError(ERROR_GET_TSL_EXT_INFO, err);
            }
            if (code !== 0) {
              throwError(ERROR_GET_TSL_EXT_INFO, `Get TSL ext info failed: errno = ${code}`);
            }
            // Check if the result is JSON-welled.
            JSON.parse(result);
            console.info(`Got TSL ext info: ${result}`);
            resolve(result);
          });
      }).catch(err => {
        this._getTslExtInfoPromise = undefined;
        throwError(ERROR_GET_TSL_EXT_INFO, err);
      });
    }
    return this._getTslExtInfoPromise;
  }

  disconnect() {
    var thingId = this._thingId;
    var thingInterface = this._thingInterface;
    if (!this._disconnectPromise) {
      this._disconnectPromise = new Promise((resolve) => {
        if (!thingId) {
          throw new Error(`Thing has not been connected.`);
        }
        this._thingInterface = undefined;
        session.connectedThings.delete(thingId);
        session.things.delete(thingId);
        this._thingId = undefined;
        resolve(this._disconnect(thingId));
      }).then(() => {
        var serviceName = `iot.device.id${thingId}`;
        return session.releaseName(serviceName)
          .catch(err => {
            console.warn(`Failed to release service name ${serviceName}: ${err}.`);
            // We simply think that releasing name failed does no matter.
            // So ignore the error.
          })
      }).then(() => {
        console.info(`Thing ${thingId} is disconnected from Link IoT Edge.`);
        this._connectPromise = undefined;
      }).catch((err) => {
        // The error is thrown from _disconnect, rollback.
        this._thingInterface = thingInterface;
        this._thingId = thingId;
        session.connectedThings.add(this._thingId);
        session.things.add(this._thingId);
        this._disconnectPromise = undefined;
        throwError(ERROR_DISCONNECT, err);
      });
    }
    return this._disconnectPromise;
  }

  cleanup() {
    if (!this._cleanupPromise) {
      this._cleanupPromise = new Promise((resolve) => {
        if (this._connectPromise) {
          console.warn(`You should disconnect thing from Link IoT Edge first.`);
          // The thing has connected to Link IoT Edge.
          return resolve(this.disconnect());
        }
        resolve();
      }).then(() => {
        if (this._setupPromise) {
          this._setupPromise = undefined;
          this._unregisterPromise = undefined;
          this._connectPromise = undefined;
          this._disconnectPromise = undefined;
          this._getTslPromise = undefined;
          this._getTslExtInfoPromise = undefined;
        }
      }).then(() => {
        console.info(`Clean up successfully!`);
      }).catch(err => {
        this._cleanupPromise = undefined;
        throwError(ERROR_CLEANUP, err);
      });
    }
    return this._cleanupPromise;
  }

  unregister() {
    var thingId = this._thingId;
    if (!this._unregisterPromise) {
      this._unregisterPromise = new Promise((resolve) => {
        if (this._connectPromise) {
          console.warn(`You should disconnect thing from Link IoT Edge first.`);
          // The thing has connected to Link IoT Edge.
          return resolve(this.disconnect());
        }
        resolve();
      }).then(() => {
        if (!thingId) {
          throw new Error('Thing has not been connected or has been cleaned up.');
        }
        return this._unregisterThing(thingId);
      }).then(() => {
        console.info(`Unregister thing successfully!`);
      }).catch(err => {
        // Do not rollback if unregister thing failed.
        this._unregisterPromise = undefined;
        throwError(ERROR_UNREGISTER, err);
      });
    }
    return this._unregisterPromise;
  }

  _unregisterThing(thingId) {
    return new Promise((resolve) => {
      console.info(`Unregister thing from dimu ${thingId}.`);
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      session.dimuInterface.unregisterDevice(thingId, (err, result) => {
        handleDefaultResult(err, result);
        resolve();
      });
    });
  }

  _connect(productKey, deviceName, localName) {
    return new Promise((resolve) => {
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      var thingInfo = {
        productKey,
        driverName: MODULE_NAME,
        isLocal: 'False',
      };
      if (deviceName) {
        thingInfo.deviceName = deviceName;
      } else {
        thingInfo.deviceLocalId = localName;
      }
      var str = JSON.stringify(thingInfo);
      console.info(`Connect thing to dimu ${str}.`);
      session.dimuInterface.connect(str, (err, result) => {
        var parsed = handleDefaultResult(err, result);
        if (!parsed.params || !parsed.params.deviceCloudId) {
          throw new Error('Returned result is illegal.');
        }
        resolve(parsed.params.deviceCloudId);
      });
    });
  }

  _disconnect(thingId) {
    return new Promise((resolve) => {
      console.info(`Disconnect thing ${thingId} from dimu.`);
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      session.dimuInterface.disconnect(thingId, (err, result) => {
        handleDefaultResult(err, result);
        resolve();
      });
    });
  }


  _exportDefaultThingInterface(serviceName, objectPath, interfaceName) {
    var self = this;
    var _handleConnectResult = function (result) {
      if (!result) {
        console.error('Illegal connect result: null.');
        return null;
      }
      console.log(`Handle connect result ${result}.`);
      var parsed;
      try {
        parsed = JSON.parse(result);
      } catch (err) {
        console.error('Illegal connect result: not JSON.');
        return null;
      }
      if (parsed.code === 520 && self._connectPromise) {
        // Retry if it's 520 error, and it was connected.
        console.info('Connecting failed, try to reconnect...');
        self.connect().catch((err) => console.error(err));
        return null;
      }
      if (parsed.code !== 0) {
        console.error(parsed.message);
        return null;
      }
      var params = parsed.params;
      if (!params) {
        console.error('Illegal connect result: params not found');
        return null;
      }
      console.info(
        `Thing ${params.productKey} ${params.deviceName} is connected to the cloud.`);
      return null;
    };

    var ifaceDesc = {
      name: interfaceName,
      methods: {
        callServices: ['ss', 's', ['service_name', 'service_args'], ['result']],
        connectResultNotify: ['s', '', ['result']],
      },
      signals: {
        propertiesChanged: ['s', 'propertiesInfo']
      },
      properties: {},
    };
    var iface = {
      callServices: function (name, args) {
        console.info(`Call service ${name} with ${args}.`);
        return Promise.resolve()
          .then(() => {
            var argsObj = JSON.parse(args);
            if (name === 'get') {
              if (Object.prototype.toString.call(argsObj.params) !== '[object Array]') {
                throw new Error('"params" got from Link IoT Edge is not a array.');
              }
              return self.callbacks.getProperties.call(null, argsObj.params);
            } else if (name === 'set') {
              if (!argsObj.params) {
                throw Error('"params" got from Link IoT Edge is undefined or null.');
              }
              return self.callbacks.setProperties.call(null, argsObj.params);
            }
            return self.callbacks.callService.call(null, name, argsObj.params);
          })
          .then((ret) => {
            console.log(`Result returned from "${name}" callback: ${JSON.stringify(ret)}.`);
            var result = {};
            result.code = ret.code ? 100000 : 0; // Return unknown error if it's non-zero.
            result.message = ret.message || '';
            if (name === 'get') {
              if (!ret.code && !ret.params) {
                throw new Error(`"params" is required when "get" callback returns success.`);
              }
              result.params = ret.params || {};
            } else if (name === 'set') {
              result.params = ret.params || {};
            } else {
              // This is the case of calling service.
              result.params = {
                code: result.code,
                message: result.message,
                data: ret.params || {},
              };
            }
            return JSON.stringify(result);
          })
          .catch((err) => {
            // Catch and re-throw the error for tracing.
            console.warn(err);
            throw err;
          });
      },
      connectResultNotify: function (result) {
        return _handleConnectResult(result);
      },
      emit: function (eventName, ...args) {
        // Don't need to implement.
      }
    };
    console.info(`Export default thing interface ${serviceName}.`);
    session.exportInterface(iface, objectPath, ifaceDesc);
    this._thingInterface = iface;
  }

  _signalSubscribe(signalName, signature, ...values) {
    if (!signalName) throw new Error('Trying to emit undefined signal.');

    if (!this._thingId) {
      throw new Error('You should connect before calling this method.');
    }
    var interfaceName = `iot.device.id${this._thingId}`;
    var objectPath = `/iot/device/id${this._thingId}`;
    var signalMsg = {
      type: dbus.messageType.signal,
      destination: 'iot.dmp.subscribe',
      path: objectPath,
      'interface': interfaceName,
      member: signalName
    };
    if (signature) {
      signalMsg.signature = signature;
      signalMsg.body = values;
    }
    try {
      session.message(signalMsg);
    } catch (err) {
      throw err;
    }
  }
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
 Config.get()
 .then(config => {
        const thingInfos = config.getThingInfos();
        thingInfos.forEach(thingInfo => {
          const client = new ThingAccessClient(thingInfo, callbacks);
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
   * Returns the TSL(Thing Specification Language) config string.
   *
   * @returns {Promise<String>}
   * @deprecated Use {@link getTslExtInfo} instead.
   */
  getTslConfig() {
    return this.getTslExtInfo();
  }

  /**
   * Returns the TSL(Thing Specification Language) extend info string.
   *
   * @returns {Promise<String>}
   */
  getTslExtInfo() {
    return new Promise((resolve) => {
      resolve(this.setup());
    }).then(() => {
      return this.impl.getTslExtInfo();
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

module.exports = ThingAccess;
module.exports.ThingAccess = ThingAccess;
module.exports.ThingAccessClient = ThingAccessClient;
module.exports.default = ThingAccess;
module.exports.session = session;
module.exports.DriverConfigManager = DriverConfigManager;
module.exports.ERROR_SETUP = ERROR_SETUP;
module.exports.ERROR_CLEANUP = ERROR_CLEANUP;
module.exports.ERROR_CONNECT = ERROR_CONNECT;
module.exports.ERROR_DISCONNECT = ERROR_DISCONNECT;
module.exports.ERROR_GET_TSL = ERROR_GET_TSL;
module.exports.ERROR_GET_TSL_EXT_INFO = ERROR_GET_TSL_EXT_INFO;
module.exports.ERROR_GET_CONFIG = ERROR_GET_CONFIG;
module.exports.ERROR_UNREGISTER = ERROR_UNREGISTER;
