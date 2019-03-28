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

const should = require('should');
const sinon = require('sinon');

process.env.FUNCTION_ID = 'functionId';
process.env.FUNCTION_NAME = 'functionName';

const Config = require('../../lib/config');
const { DriverConfigManager } = require('../../lib/thing-access');

describe('Config', function () {
  const configObject = {
    deviceList: [
      {
        productKey: 'Your Product Key',
        deviceName: 'Your Device Name',
        custom: JSON.stringify({
          connection: {
            ip: "100.69.166.91",
            name: "TCP",
            port: 18002,
            protocol: "TCP",
            slaveId: 1
          }
        })
      }
    ],
    config: {}
  };
  describe('#construct', function () {
    it('should fail since the config is not in JSON', function () {
      (function () {
        new Config('{deviceList":[{"productKey":"Your Product Key","deviceName":"Your Device Name","custom":{"connection":{"ip":"100.69.166.91","name":"TCP","port":18002,"protocol":"TCP","slaveId":1}}}],"config":{}}');
      }).should.throw();
    });
    it('should fail since no devices config found in the config', function () {
      const _config = Object.assign({}, configObject, { deviceList: undefined });
      (function () {
        new Config(JSON.stringify(_config));
      }).should.throw();
    });
    it('should fail since devices config is not in array', function () {
      const _config = Object.assign({}, configObject, { deviceList: '' });
      (function () {
        new Config(JSON.stringify(_config));
      }).should.throw();
    });
    it('should fail since no devices found in the config', function () {
      const _config = Object.assign({}, configObject, { deviceList: [] });
      (function () {
        new Config(JSON.stringify(_config));
      }).should.throw();
    });
    it('should pass since all requirements meet', function () {
      const _config = Object.assign({}, configObject);
      (function () {
        new Config(JSON.stringify(_config));
      }).should.not.throw();
    });
  });
  describe('#getThingInfos', function () {
    it('should pass since all requirements meet', function () {
      (function () {
        new Config(JSON.stringify(configObject))
          .getThingInfos();
      }).should.not.throw();
    });
  });
  describe('#get', function () {
    it('should fail since get config failed', function (done) {
      var stub = sinon.stub(DriverConfigManager.get(), 'getConfig')
        .rejects(new Error('Cannot get config'));
      function restore() {
        stub.restore();
        done();
      }
      Config.get()
        .should.not.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(DriverConfigManager.get(), 'getConfig')
        .resolves(JSON.stringify(configObject));
      function restore() {
        stub.restore();
        done();
      }
      Config.get()
        .should.not.be.rejected().then(restore, restore);
    });
  });
  describe('#registerChangedCallback', function () {
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(DriverConfigManager.get(), 'on').resolves();
      function restore() {
        stub.restore();
        done();
      }
      (function () {
        Config.registerChangedCallback(function () {});
      }).should.not.throw();
      restore();
    });
  });
  describe('#unregisterChangedCallback', function () {
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(DriverConfigManager.get(), 'removeListener').resolves();
      function restore() {
        stub.restore();
        done();
      }
      (function () {
        Config.unregisterChangedCallback(function () {});
      }).should.not.throw();
      restore();
    });
  });
});