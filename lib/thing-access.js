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

const dbus = require('dbus-native');
const crypto = require('crypto');
const logger = require('./logger');

const MODULE_NAME = process.env.FUNCTION_ID;
if (!MODULE_NAME) {
  throw new Error(`Can't get FUNCTION_ID from runtime.`);
}
const MODULE_SERVICE_NAME = `iot.driver.${MODULE_NAME}`;
const MODULE_OBJECT_PATH = `/${MODULE_SERVICE_NAME.replace(/\./g, '/')}`;
const MODULE_INTERFACE_NAME = MODULE_SERVICE_NAME;

const ERROR_REGISTER_MODULE = 'register_module';
const ERROR_STARTUP_THING = 'startup_thing';

function handleDefaultResult(error, result) {
  logger.info(`Handle default error: ${error}`);
  logger.info(`Handle default result: ${result}`);
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
    throw new Error('Default result is not in JSON format.');
  }
  if (parsed.code !== 0) {
    throw new Error(parsed.message);
  }
  return parsed;
}

// Session which manages the wrapper of bus and some global states.
class Session {
  constructor() {
    this._reset();
  }

  initialize() {
    if (!this._initializePromise) {
      this._initializePromise = new Promise((resolve) => {
        logger.info('Initialize edge bus...');
        resolve(this._initializeEdgeBus());
      }).then(() => {
        return this.requestName(MODULE_SERVICE_NAME)
      }).then(() => {
        this._exportModuleInterface();
        return this._registerModule();
      }).then(() => {
        logger.info('Initialize successfully!');
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
        logger.info(`Finalize...`);
        resolve(this._unregisterModule());
      }).then(() => {
        var reset = () => {
          this.things.clear();
          this.connectedThings.clear();
          this.configInterface = undefined;
          this.dimuInterface = undefined;
          if (this.edgeBus) {
            this.edgeBus.connection.end();
            this.edgeBus = null;
          }
          this._initializePromise = undefined;
          logger.info(`Finalize successfully!`);
        };
        return this.releaseName(MODULE_SERVICE_NAME)
          .then(reset, reset /* Do NOT throw the err! It's finalize. */);
      }).catch(err => {
        this._finalizePromise = undefined;
        throw err;
      });
    }
    return this._finalizePromise;
  }

  requestName(serviceName) {
    logger.info(`Request service name ${serviceName}.`);
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
          throw new Error(
            `Failed to request service name ${serviceName}, the errno is ${retCode}.`
          );
        }
      });
    });
  }

  releaseName(serviceName) {
    logger.info(`Release service name ${serviceName}.`);
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
        throw new Error('Client has not been setup or has been cleanup.');
      }
      var info = {
        'params': {
          'driverLocalId': MODULE_NAME,
          'driverStartupTime': `${Date.now()}`,
        }
      };
      var str = JSON.stringify(info);
      logger.info(`Register module to dimu ${str}.`);
      this.dimuInterface.registerDriver(str, (err, result) => {
        logger.info('Return from registering module to dimu.');
        try {
          handleDefaultResult(err, result);
        } catch (error) {
          error.code = ERROR_REGISTER_MODULE;
          throw error;
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
      logger.info(`Unregister module from dimu ${str}.`);
      this.dimuInterface.unregisterDriver(str, (err, result) => {
        try {
          handleDefaultResult(err, result);
        } catch (error) {
          throw error;
        }
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
          logger.error(`Connection had a error: ${err}.`);
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
      logger.info('Connect to edge bus.');
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
    return this._getDefaultInteface('iot.dmp.dimu');
  }

  _getConfigInterface() {
    return this._getDefaultInteface('iot.dmp.configmanager');
  }

  _getDefaultInteface(serviceName) {
    var defaultObjectPath = `/${serviceName.replace(/\./g, '/')}`;
    var defaultInterface = serviceName;
    logger.info(`Get service default interface ${defaultInterface}.`);
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
    logger.info(`Export module interface ${MODULE_INTERFACE_NAME}.`);
    var self = this;
    var ifaceDesc = {
      name: MODULE_INTERFACE_NAME,
      methods: {
        getDeviceList: ['s', 's', ['selector'], ['result']],
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

    this._initializePromise = undefined;
    this._finalizePromise = undefined;
  }
}
const session = new Session();

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
        logger.info('Setup successfully!');
        this._registerPromise = undefined;
        this._unregisterPromise = undefined;
        this._connectPromise = undefined;
        this._disconnectPromise = undefined;
        this._getTslPromise = undefined;
        this._cleanupPromise = undefined;
      }).catch(err => {
        // Reset and re-throw the error.
        this._setupPromise = undefined;
        throw err;
      });
    }
    return this._setupPromise;
  }

  register() {
    if (!this._registerPromise) {
      this._registerPromise = new Promise((resolve) => {
        resolve(this.getTsl());
      }).then((tsl) => {
        return this._registerThing(this.config.productKey, this.config.deviceName,
          this.config.localName, tsl);
      }).then((thingId) => {
        logger.info(`Register thing successfully, get thing id ${thingId}!`);
        this._thingId = thingId;
        session.things.add(this._thingId);
        this._unregisterPromise = undefined;
      }).catch(err => {
        this._registerPromise = undefined;
        throw err;
      });
    }
    return this._registerPromise;
  }

  connect() {
    var serviceName;
    if (!this._connectPromise) {
      this._connectPromise = new Promise((resolve) => {
        if (!this._thingId) {
          throw new Error('You should register before calling this method.');
        }
        serviceName = `iot.device.id${this._thingId}`;
        resolve(session.requestName(serviceName));
      }).then(() => {
        return this._startupThing(this._thingId);
      }).then(() => {
        session.connectedThings.add(this._thingId);
        this._exportDefaultThingInterface(serviceName);
        this._disconnectPromise = undefined;
        logger.info(`Thing ${this._thingId} is connected to LinkEdge platform.`);
      }).catch(err => {
        var rollback = () => {
          this._connectPromise = undefined;
          throw err;
        };
        if (err.code === ERROR_STARTUP_THING) {
          return session.releaseName(serviceName)
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
        values: args,
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
        logger.info(`Get TSL...`);
        if (!session.configInterface) {
          throw new Error('Client has not been setup or setup failed.');
        }
        var getConfig = 'get_config';
        session.configInterface[getConfig](`gw_TSL_${this.config.productKey}`,
          (err, code, result) => {
            if (err) {
              throw err;
            }
            if (code !== 0) {
              throw new Error(`Get config failed: errno = ${code}`);
            }
            // Check if the result is JSON-welled.
            JSON.parse(result);
            logger.info(`Get TSL: ${result}`);
            resolve(result);
          });
      }).catch(err => {
        this._getTslPromise = undefined;
        throw err;
      });
    }
    return this._getTslPromise;
  }

  disconnect() {
    var thingInterface;
    if (!this._disconnectPromise) {
      this._disconnectPromise = new Promise((resolve) => {
        if (!this._thingId) {
          throw new Error(`Thing has not been registered.`);
        }
        thingInterface = this._thingInterface;
        this._thingInterface = undefined;
        session.connectedThings.delete(this._thingId);
        resolve(this._shutdownThing(this._thingId));
      }).then(() => {
        var serviceName = `iot.device.id${this._thingId}`;
        return session.releaseName(serviceName)
          .catch(err => {
            // We simply think releasing name failed does no matter.
            // So ignore the error.
          })
      }).then(() => {
        logger.info(`Thing is disconnected from LinkEdge platform.`);
        this._connectPromise = undefined;
      }).catch((err) => {
        // Rollback
        if (this._thingId) {
          // The error is thrown from shutdownThing.
          this._thingInterface = thingInterface;
          session.connectedThings.add(this._thingId);
        }
        this._disconnectPromise = undefined;
        throw err;
      });
    }
    return this._disconnectPromise;
  }

  cleanup() {
    if (!this._cleanupPromise) {
      this._cleanupPromise = new Promise((resolve) => {
        if (this._connectPromise) {
          logger.warn(`You should disconnect thing from LinkEdge platform first.`);
          // The thing has connected to LinkEdge platform.
          resolve(this.disconnect());
          return;
        }
        resolve();
      }).then(() => {
        if (this._thingId) {
          // The thing has been registered to LinkEdge platform.
          session.things.delete(this._thingId);
          this._thingId = undefined;
        }
        if (this._setupPromise) {
          this._setupPromise = undefined;
          this._registerPromise = undefined;
          this._unregisterPromise = undefined;
          this._connectPromise = undefined;
          this._disconnectPromise = undefined;
          this._getTslPromise = undefined;
          if (session.things.size === 0) {
            return session.finalize();
          }
        }
      }).then(() => {
        logger.info(`Clean up successfully!`);
      }).catch(err => {
        this._cleanupPromise = undefined;
        throw err;
      });
    }
    return this._cleanupPromise;
  }

  unregister() {
    if (!this._unregisterPromise) {
      this._unregisterPromise = new Promise((resolve) => {
        if (this._connectPromise) {
          logger.warn(`You should disconnect thing from LinkEdge platform first.`);
          // The thing has connected to LinkEdge platform.
          resolve(this.disconnect());
          return;
        }
        resolve();
      }).then(() => {
        if (!this._thingId) {
          throw new Error('Thing has not been registered or has been cleaned up.');
        }
        return this._unregisterThing(this._thingId);
      }).then(() => {
        session.things.delete(this._thingId);
        this._thingId = undefined;
        this._registerPromise = undefined;
        logger.info(`Unregister thing successfully!`);
      }).catch(err => {
        // Do not rollback if unregister thing failed.
        this._unregisterPromise = undefined;
        throw err;
      });
    }
    return this._unregisterPromise;
  }

  _registerThing(productKey, deviceName, localName, tsl) {
    return new Promise((resolve) => {
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      var tslMd5 = crypto.createHash('md5').update(tsl).digest('hex');
      var thingInfo = {
        productKey,
        driverName: MODULE_NAME,
        deviceProfile: JSON.parse(tsl),
        productMD5: tslMd5,
        isLocal: 'False',
      };
      if (deviceName) {
        thingInfo.deviceName = deviceName;
      } else {
        thingInfo.deviceLocalId = localName;
      }
      var str = JSON.stringify(thingInfo);
      logger.info(`Register thing to dimu ${str}.`);
      session.dimuInterface.registerDevice(str, (err, result) => {
        var parsed;
        try {
          parsed = handleDefaultResult(err, result);
        } catch (error) {
          throw error;
        }
        if (!parsed.params || !parsed.params.deviceCloudId) {
          throw new Error('Returned result is illegal.');
        }
        resolve(parsed.params.deviceCloudId);
      });
    });
  }

  _unregisterThing(thingId) {
    return new Promise((resolve) => {
      logger.info(`Unregister thing from dimu ${thingId}.`);
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      session.dimuInterface.unregisterDevice(thingId, (err, result) => {
        try {
          handleDefaultResult(err, result);
        } catch (error) {
          throw error;
        }
        resolve();
      });
    });
  }

  _startupThing(thingId) {
    return new Promise((resolve) => {
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      var str = JSON.stringify({
        deviceCloudId: thingId
      });
      logger.info(`Start up thing ${str}.`);
      session.dimuInterface.startupDevice(str, (err, result) => {
        try {
          handleDefaultResult(err, result);
        } catch (error) {
          error.code = ERROR_STARTUP_THING;
          throw error;
        }
        resolve();
      });
    });
  }

  _shutdownThing(thingId) {
    return new Promise((resolve) => {
      logger.info(`Shut down thing ${thingId}.`);
      if (!session.dimuInterface) {
        throw new Error('Client has not been setup or setup failed.');
      }
      session.dimuInterface.shutdownDevice(thingId, (err, result) => {
        try {
          handleDefaultResult(err, result);
        } catch (error) {
          throw error;
        }
        resolve();
      });
    });
  }

  _exportDefaultThingInterface(serviceName) {
    var self = this;
    var objectPath = `/${serviceName.replace(/\./g, '/')}`;
    var interfaceName = serviceName;
    var ifaceDesc = {
      name: interfaceName,
      methods: {
        callServices: ['ss', 's', ['service_name', 'service_args'], ['result']],
      },
      signals: {
        propertiesChanged: ['s', 'propertiesInfo']
      },
      properties: {},
    };
    var iface = {
      callServices: function (name, args) {
        logger.info(`Call service ${name} with ${args}.`);
        return Promise.resolve()
          .then(() => {
            var argsObj = JSON.parse(args);
            if (name === 'get') {
              if (Object.prototype.toString.call(argsObj.params) !== '[object Array]') {
                throw new Error('Parameters got from LinkEdge is not a array.');
              }
              return self.callbacks.getProperties.call(null, argsObj.params);
            } else if (name === 'set') {
              return self.callbacks.setProperties.call(null, argsObj.params);
            }
            return self.callbacks.callService.call(null, name, argsObj.params);
          })
          .then((result) => {
            return JSON.stringify(result);
          })
          .catch((err) => {
            // Catch and re-throw the error for tracing.
            logger.error(err);
            throw err;
          });
      },
      emit: function (eventName, ...args) {
        // Don't need to implement.
      }
    };
    logger.info(`Export default thing interface ${serviceName}.`);
    session.exportInterface(iface, objectPath, ifaceDesc);
    this._thingInterface = iface;
  }

  _signalSubscribe(signalName, signature, ...values) {
    if (!signalName) throw new Error('Trying to emit undefined signal.');

    if (!this._thingId) {
      throw new Error('You should register before calling this method.');
    }
    var interfaceName = `iot.device.id${this._thingId}`;
    var objectPath = `/${interfaceName.replace(/\./g, '/')}`;
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

module.exports = ThingAccess;
module.exports.ThingAccess = ThingAccess;
module.exports.default = ThingAccess;
module.exports.session = session;
