/*
 * Copyright (c) 2018 Alibaba Group Holding Ltd. All rights reversed.
 */

const should = require('should');
const sinon = require('sinon');
const dbus = require('dbus-native');
const EventEmitter = require('events');

process.env.FUNCTION_ID = 'functionId';
process.env.FUNCTION_NAME = 'functionName';

const {
  session,
  DriverConfigManager,
  ThingAccessClient,
} = require('../../lib/thing-access');

describe('ThingAccessClient', function () {
  var config = {
    productKey: 'Your Product Key',
    deviceName: 'Your Device Name',
  };
  var callbacks = {
    setProperties: function (properties) {
      // Set properties to thing and return the result.
      return {};
    },
    getProperties: function (keys) {
      // Get properties from thing and return them.
      return {};
    },
    callService: function (name, args) {
      // Call services on thing and return the result.
      return {};
    }
  };

  describe('#constructor', function () {
    it('should fail since illegal config', function() {
      (function () {
        new ThingAccessClient(undefined, callbacks);
      }).should.throw();
    });
    it('should fail since illegal product key', function() {
      (function () {
        new ThingAccessClient({deviceName: config.deviceName}, callbacks);
      }).should.throw();
    });
    it('should fail since illegal device name and local name', function() {
      (function () {
        new ThingAccessClient({productKey: config.productKey}, callbacks);
      }).should.throw();
    });
    it('should fail since illegal callbacks', function() {
      (function () {
        new ThingAccessClient(config, undefined);
      }).should.throw();
    });
    it('should fail since illegal set properties callback', function() {
      (function () {
        new ThingAccessClient(config, {
          getProperties: callbacks.getProperties,
          callService: callbacks.callService,
        });
      }).should.throw();
    });
    it('should fail since illegal get properties callback', function() {
      (function () {
        new ThingAccessClient(config, {
          setProperties: callbacks.setProperties,
          callService: callbacks.callService,
        });
      }).should.throw();
    });
    it('should fail since illegal call service callback', function() {
      (function () {
        new ThingAccessClient(config, {
          setProperties: callbacks.setProperties,
          getProperties: callbacks.getProperties,
        });
      }).should.throw();
    });
    it('should pass since all requirements meet', function() {
      (function () {
        new ThingAccessClient(config, callbacks);
      }).should.not.throw();
    });
  });
  describe('#setup', function () {
    afterEach(function () {
      session._reset();
    });
    it('should fail since getting connection error', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        var connection = new EventEmitter();
        setTimeout(function () {
          connection.emit('error', new Error('Get connection error.'));
        }, 0);
        return { connection };
      });
      var client = new ThingAccessClient(config, callbacks);
      client.setup().should.be.rejected().then(function () {
        stub.restore();
        done();
      });
    });
    it('should fail since getting dimu interface error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return({
                getInterface: function (objName, ifaceName, callback) {
                  callback(new Error('Get dimu interface error.'));
                }
              });
            }
          }
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.setup().should.be.rejected().then(restore, restore);
    });
    it('should fail since getting config interface error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return({
                getInterface: function (objName, ifaceName, callback) {
                  callback(new Error('Get config interface error.'));
                }
              });
            }
          }
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.setup().should.be.rejected().then(restore, restore);
    });
    it('should fail since requesting module service name error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: function (name, flags, callback) {
            if (name === `iot.driver.${process.env.FUNCTION_ID}`) {
              callback(new Error('Request module service name error.'));
            }
          }
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.setup().should.be.rejected().then(restore, restore);
    });
    it('should fail since registering module error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return({
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: function (info, callback) {
                      callback(new Error('Register module error.'));
                    }
                  });
                }
              });
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.setup().should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.setup().should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#getTsl', function () {
    afterEach(function () {
      session._reset();
    });
    it('should fail since illegal product key', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(new Error('Illegal product key.'));
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient({
        productKey: 'Product Key',
        deviceName: config.deviceName,
      }, callbacks);
      client.getTsl()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal returned code', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(undefined, 5, undefined);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.getTsl()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal returned result', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(undefined, 0, {});
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.getTsl()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.getTsl()
        .should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#getTslConfig', function () {
    afterEach(function () {
      session._reset();
    });
    it('should fail since illegal product key', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(new Error('Illegal product key.'));
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient({
        productKey: 'Product Key',
        deviceName: config.deviceName,
      }, callbacks);
      client.getTslConfig()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal returned code', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(undefined, 5, undefined);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.getTslConfig()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal returned result', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(undefined, 0, {});
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.getTslConfig()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.getTslConfig()
        .should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#registerAndOnline', function () {
    var client;
    afterEach(function (done) {
      client.cleanup().then(function () {
        client = undefined;
        done();
      });
    });
    it('should fail since dimu connection error', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: function (tingInfo, callback) {
                      callback(new Error('Connection error.'));
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since undefined result', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: function (tingInfo, callback) {
                      callback(undefined, undefined);
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since non JSON format result', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: function (tingInfo, callback) {
                      callback(undefined, {});
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal result code', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: function (tingInfo, callback) {
                      callback(undefined, JSON.stringify({
                        code: 5,
                        message: 'Illegal product key',
                      }));
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since requesting thing service name error', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: function (name, flags, callback) {
            if (name.startsWith('iot.device.id')) {
              callback(undefined, 5);
              return;
            }
            callback(undefined, 1);
          },
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since starting up thing error', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: function (thingInfo, callback) {
                      callback(undefined, JSON.stringify({
                        code: 5,
                        message: 'Thing id is illegal.',
                      }));
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since illegal connect result error is caught', function (done) {
      var notifyConnectResult;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.connectResultNotify) {
              notifyConnectResult = iface.connectResultNotify;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          notifyConnectResult(undefined);
        })
        .should.not.be.rejected().then(restore, restore);
    });
    it('should pass since connect result not a JSON error is caught', function (done) {
      var notifyConnectResult;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.connectResultNotify) {
              notifyConnectResult = iface.connectResultNotify;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          notifyConnectResult('{code":0,"message":"success","params":{"productKey":"Your Product Key","deviceName":"Your Device Name"}}');
        })
        .should.not.be.rejected().then(restore, restore);
    });
    it('should pass since connect result code not 0 error is caught', function (done) {
      var notifyConnectResult;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.connectResultNotify) {
              notifyConnectResult = iface.connectResultNotify;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          notifyConnectResult('{"code":1,"message":"Illegal device name."}');
        })
        .should.not.be.rejected().then(restore, restore);
    });
    it('should pass since connect result no params error is caught', function (done) {
      var notifyConnectResult;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.connectResultNotify) {
              notifyConnectResult = iface.connectResultNotify;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          notifyConnectResult('{"code":0,"message":"Success."}');
        })
        .should.not.be.rejected().then(restore, restore);
    });
    it('should pass since connect result is absolutely right', function (done) {
      var notifyConnectResult;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.connectResultNotify) {
              notifyConnectResult = iface.connectResultNotify;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          notifyConnectResult('{"code":0,"message":"success","params":{"productKey":"Your Product Key","deviceName":"Your Device Name"}}');
        })
        .should.not.be.rejected().then(restore, restore);
    });
    it('should pass since invoking get function correctly',function (done) {
      var callServices;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.callServices) {
              callServices = iface.callServices;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          callServices('get', JSON.stringify({
            params: ['key1', 'key2']
          }));
        }).should.not.be.rejected().then(restore, restore);
    });
    it('should pass since invoking set function correctly',function (done) {
      var callServices;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.callServices) {
              callServices = iface.callServices;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          callServices('set', JSON.stringify({
            params: {
              key1: 'value1',
              key2: 'value2',
            }
          }));
        }).should.not.be.rejected().then(restore, restore);
    });
    it('should pass since invoking callServices function correctly',function (done) {
      var callServices;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.callServices) {
              callServices = iface.callServices;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          callServices('turnOn', JSON.stringify({
            params: {
              key1: 'value1',
              key2: 'value2',
            }
          }));
        }).should.not.be.rejected().then(restore, restore);
    });
    it('should pass since get connected things correctly',function (done) {
      var getThingInfos;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.getDeviceList) {
              getThingInfos = iface.getDeviceList;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          console.log(getThingInfos('deviceState=online'));
        }).should.not.be.rejected().then(restore, restore);
    });
    it('should pass since get disconnected things correctly',function (done) {
      var getThingInfos;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.getDeviceList) {
              getThingInfos = iface.getDeviceList;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.offline();
        }).then(function () {
          console.log(getThingInfos('deviceState=offline'));
        }).should.not.be.rejected().then(restore, restore);
    });
    it('should pass since get all things correctly',function (done) {
      var getThingInfos;
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: function (iface, objPath, ifaceDesc) {
            if (iface.getDeviceList) {
              getThingInfos = iface.getDeviceList;
            }
          },
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          console.log(getThingInfos());
        }).should.not.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet',function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#offline', function () {
    var client;
    afterEach(function (done) {
      client.cleanup().then(function () {
        client = undefined;
        done();
      });
    });
    it('should fail since shutting down thing error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  var firstCalled = true;
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: fakeConnect,
                    disconnect: function (thingId, callback) {
                      var result;
                      if (firstCalled) {
                        result = {
                          code: 5,
                          message: 'Thing id is illegal.',
                        };
                        firstCalled = false;
                      } else {
                        result = {
                          code: 0,
                          message: 'success',
                        }
                      }
                      callback(undefined, JSON.stringify(result));
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.offline();
        }).should.be.rejected().then(restore, restore);
    });
    it('should fail since thing is not registered', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.offline()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.offline();
        }).should.not.be.rejected().then(restore, restore);
        
    });
  });
  describe('#cleanup', function () {
    it('should fail since unregistering module error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: function (info, callback) {
                      callback(undefined, JSON.stringify({
                        code: 5,
                        message: 'Illegal module name error.',
                      }));
                    },
                    connect: fakeConnect,
                    disconnect: fakeDisconnect,
                    registerDriver: fakeRegisterModule,
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        session._reset();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.offline();
        })
        .then(function () {
          return client.cleanup();
        }).should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      var client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.offline();
        }).then(function () {
          return client.cleanup();
        }).should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#reportEvent', function () {
    var client;
    afterEach(function (done) {
      client.cleanup()
        .then(function () {
          client = undefined;
          done();
        });
    });
    it('should fail since sending message on bus error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        var connection = new EventEmitter();
        connection.end = function () {};
        connection.message = function () {
          throw new Error('Send message on bus error.');
        };
        setTimeout(function () {
          connection.emit('connect');
        }, 0);
        return {
          connection,
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.reportEvent('high_temperature', {temperature: 41});
        }).should.be.rejected()
        .then(function () {
          return client.offline();
        })
        .then(restore, restore);
    });
    it('should fail since signal undefined event', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.reportEvent(undefined, {temperature: 41});
        }).should.be.rejected()
        .then(function () {
          return client.offline();
        })
        .then(restore, restore);
    });
    it('should fail since thing is not registered', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.reportEvent('high_temperature', {temperature: 41})
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since thing is unregistered', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.unregister();
        })
        .then(function () {
          return client.reportEvent('high_temperature', {temperature: 41});
        }).should.be.rejected()
        .then(function () {
          return client.offline();
        }).then(restore, restore);
    });
  it('should fail since thing is offline', function(done) {
    var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
    function restore() {
      stub.restore();
      done();
    }
    client = new ThingAccessClient(config, callbacks);
    client.registerAndOnline()
        .then(function () {
          return client.offline();
        })
      .then(function () {
        return client.reportEvent('high_temperature', {temperature: 41});
      }).should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.reportEvent('high_temperature', {temperature: 41});
        }).should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#reportProperties', function () {
    var client;
    afterEach(function (done) {
      client.cleanup()
        .then(function () {
          client = undefined;
          done();
        });
    });
    it('should fail since sending message on bus error', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        var connection = new EventEmitter();
        connection.end = function () {};
        connection.message = function () {
          throw new Error('Send message on bus error.');
        };
        setTimeout(function () {
          connection.emit('connect');
        }, 0);
        return {
          connection,
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.reportProperties({
            'temperature': 41,
          });
        }).should.be.rejected()
        .then(function () {
          return client.offline();
        })
        .then(restore, restore);
    });
    it('should fail since thing is not registered', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.reportProperties({
        'temperature': 41,
      }).should.be.rejected().then(restore, restore);
    });
    it('should fail since thing is unregistered', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.unregister();
        })
        .then(function () {
        return client.reportProperties({
          'temperature': 41,
        });
      }).should.be.rejected().then(restore, restore);
    });
  it('should fail since thing is offline', function(done) {
    var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
    function restore() {
      stub.restore();
      done();
    }
    client = new ThingAccessClient(config, callbacks);
    client.registerAndOnline()
        .then(function () {
          return client.offline();
        })
      .then(function () {
        return client.reportProperties({
          'temperature': 41,
        });
      }).should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.reportEvent('high_temperature', {temperature: 41});
        })
        .then(function () {
          return client.reportProperties({
            'temperature': 42,
          });
        }).should.not.be.rejected()
        .then(function () {
          return client.offline();
        })
        .then(restore, restore);
    });
  });

  describe('#unregister', function () {
    var client;
    afterEach(function (done) {
      client.offline()
        .then(function () {
          return client.cleanup();
        })
        .then(function () {
          client = undefined;
          done();
        });
    });
    it('should fail since illegal thing id', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: fakeUnregisterModule,
                    connect: fakeConnect,
                    disconnect: fakeDisconnect,
                    unregisterDevice: function (info, callback) {
                      callback(undefined, JSON.stringify({
                        code: 5,
                        message: 'Illegal thing id.',
                      }));
                    },
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.unregister();
        }).should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      client = new ThingAccessClient(config, callbacks);
      client.registerAndOnline()
        .then(function () {
          return client.unregister();
        }).should.not.be.rejected().then(restore, restore);
    });
  });
});

describe('DriverConfigManager', function () {
  describe('#getConfig', function () {
    afterEach(function () {
      session._reset();
    });
    it('should fail since illegal function name', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(new Error('Illegal function name.'));
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().getConfig()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal returned code', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(undefined, 5, undefined);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().getConfig()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since illegal returned result', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    get_config: function (key, callback) {
                      callback(undefined, 0, {});
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().getConfig()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function(done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().getConfig()
        .should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#listenChanges', function () {
    afterEach(function () {
      session._reset();
    });
    it('should fail since session initialization failed', function (done) {
      var stub = sinon.stub(session, 'initialize').rejects(new Error('Cannot initialize'));
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().listenChanges()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since dbus error when subscribing config changes', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    subscribe_config: function (moduleName, key, owner, cb) {
                      cb(new Error('DBus error'));
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().listenChanges()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since invalid returned code when subscribing config changes', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    subscribe_config: function (moduleName, key, owner, cb) {
                      cb(null, 1);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().listenChanges()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    subscribe_config: function (moduleName, key, owner, cb) {
                      cb(null, 0);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().listenChanges()
        .should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#unlistenChanges', function () {
    afterEach(function () {
      session._reset();
    });
    it('should fail since session initialization failed', function (done) {
      var stub = sinon.stub(session, 'initialize').rejects(new Error('Cannot initialize'));
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().unlistenChanges()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since dbus error when unsubscribing config changes', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    unsubscribe_config: function (moduleName, key, cb) {
                      cb(new Error('DBus error'));
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().unlistenChanges()
        .should.be.rejected().then(restore, restore);
    });
    it('should fail since invalid returned code when unsubscribing config changes', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    unsubscribe_config: function (moduleName, key, cb) {
                      cb(null, 1);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().unlistenChanges()
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return fakeDimuService;
            } else if (serviceName === 'iot.dmp.configmanager') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    unsubscribe_config: function (moduleName, key, cb) {
                      cb(null, 0);
                    },
                  });
                }
              };
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      DriverConfigManager.get().unlistenChanges()
        .should.not.be.rejected().then(restore, restore);
    });
  });
});

describe('session', function () {
  describe('#finalize', function () {
    afterEach(function () {
      session._reset();
    });
    /*it('should fail since session has not been initialized', function (done) {
      session.finalize().should.be.rejected().then(done, done);
    });*/
    it('should fail since unregistering module from DIMU failed', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: function (serviceName) {
            if (serviceName === 'iot.dmp.dimu') {
              return {
                getInterface: function (objName, ifaceName, callback) {
                  callback(undefined, {
                    registerDriver: fakeRegisterModule,
                    unregisterDriver: function (infos, callback) {
                      callback(new Error('Cannot unregister module'));
                    },
                    connect: fakeConnect,
                  });
                }
              };
            } else if (serviceName === 'iot.dmp.configmanager') {
              return fakeConfigService;
            }
          },
          requestName: fakeRequestName,
          releaseName: fakeReleaseName,
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      session.finalize().should.be.rejected().then(restore, restore);
    });
    it('should fail since releasing name failed', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(function () {
        return {
          connection: fakeCreateConnection(),
          getService: fakeGetService,
          requestName: fakeRequestName,
          releaseName: function (name, callback) {
            callback(new Error(`Cannot release ${name}`));
          },
          exportInterface: fakeExportInterface,
        };
      });
      function restore() {
        stub.restore();
        done();
      }
      session.initialize()
        .then(function () {
          return session.finalize();
        })
        .should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(dbus, 'createClient').callsFake(fakeCreateClient);
      function restore() {
        stub.restore();
        done();
      }
      session.initialize()
        .then(function () {
          return session.finalize();
        })
        .should.not.be.rejected().then(restore, restore);
    });
  });
});

function fakeCreateConnection() {
  var connection = new EventEmitter();
  connection.end = function () {};
  connection.message = function () {};
  setTimeout(function () {
    connection.emit('connect');
  }, 0);
  return connection;
}

function fakeRegisterModule(info, callback) {
  callback(null, JSON.stringify({
    code: 0,
    message: 'success'
  }));
}

function fakeUnregisterModule(infos, callback) {
  callback(undefined, JSON.stringify({
    code: 0,
    message: 'success',
  }));
}

function fakeUnregisterThing(thingId, callback) {
  callback(undefined, JSON.stringify({
    code: 0,
    message: 'success',
  }));
}

function fakeConnect(thingInfo, callback) {
  callback(undefined, JSON.stringify({
    code: 0,
    message: 'success',
    params: {
      deviceCloudId: '627a0cdad79975',
    },
  }));
}

function fakeDisconnect(thingId, callback) {
  callback(undefined, JSON.stringify({
    code: 0,
    message: 'success',
  }));
}

function fakeRequestName(name, flags, callback) {
  callback(undefined, 1);
}

function fakeReleaseName(name, callback) {
  callback(undefined);
}

function fakeExportInterface() {

}

function fakeGetConfig(key, callback) {
  callback(null, 0, JSON.stringify({}));
}

function fakeGetService(serviceName) {
  if (serviceName === 'iot.dmp.dimu') {
    return fakeDimuService;
  } else if (serviceName === 'iot.dmp.configmanager') {
    return fakeConfigService;
  }
}

function fakeCreateClient() {
  return {
    connection: fakeCreateConnection(),
    getService: fakeGetService,
    requestName: fakeRequestName,
    releaseName: fakeReleaseName,
    exportInterface: fakeExportInterface,
  };
}

var fakeConfigInterface = {
  get_config: fakeGetConfig,
};
var fakeConfigService = {
  getInterface: function (objName, ifaceName, callback) {
    callback(undefined, fakeConfigInterface);
  }
};

var fakeDimuInterface = {
  registerDriver: fakeRegisterModule,
  unregisterDriver: fakeUnregisterModule,
  unregisterDevice: fakeUnregisterThing,
  connect: fakeConnect,
  disconnect: fakeDisconnect,
};

var fakeDimuService = {
  getInterface: function (objName, ifaceName, callback) {
    callback(undefined, fakeDimuInterface);
  }
};