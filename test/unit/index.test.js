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

const {
  DriverConfigManager,
  session,
} = require('../../lib/thing-access');

const configObject = {
  deviceList: [
    {
      productKey: 'Your Product Key',
      deviceName: 'Your Device Name',
      custom: {
        connection: {
          ip: "100.69.166.91",
          name: "TCP",
          port: 18002,
          protocol: "TCP",
          slaveId: 1
        }
      }
    }
  ],
  config: {}
};

describe('index', function () {
  var listenChanges;
  var getConfig;
  var destroy;
  before(function () {
    listenChanges = sinon.stub(DriverConfigManager.get(), 'listenChanges').resolves();
    getConfig = require('../../index').getConfig;
    destroy = require('../../index').destroy;
  });
  after(function () {
    listenChanges.restore();
    listenChanges = undefined;
    getConfig = undefined;
    destroy = undefined;
  });
  describe('#getConfig', function () {
    it('should pass since all requirements meet', function (done) {
      var stub = sinon.stub(DriverConfigManager.get(), 'getConfig')
        .resolves(JSON.stringify(configObject));
      function restore() {
        stub.restore();
        done();
      }
      getConfig().should.not.be.rejected().then(restore, restore);
    });
  });

  describe('#destroy', function () {
    it('should fail since can not unlisten changes', function (done) {
      var stub = sinon.stub(DriverConfigManager.get(), 'unlistenChanges')
        .rejects(new Error('Cannot unlisten changes'));
      function restore() {
        stub.restore();
        done();
      }
      destroy().should.be.rejected().then(restore, restore);
    });
    it('should fail since can not finalize the session', function (done) {
      var stub = sinon.stub(session, 'finalize')
        .rejects(new Error('Cannot finalize'));
      function restore() {
        stub.restore();
        done();
      }
      destroy().should.be.rejected().then(restore, restore);
    });
    it('should pass since all requirements meet', function (done) {
      var unlistenChanges = sinon.stub(DriverConfigManager.get(), 'unlistenChanges').resolves();
      var finalize = sinon.stub(session, 'finalize').resolves();
      function restore() {
        finalize.restore();
        unlistenChanges.restore();
        done();
      }
      destroy().should.not.be.rejected().then(restore, restore);
    });
  });
});