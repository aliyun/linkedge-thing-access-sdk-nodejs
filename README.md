[English](README.md)|[中文](README-zh.md)

# Link IoT Edge Thing Access SDK for Node.js
The project providers a node.js package to develop drivers which running on [Link IoT Edge](https://help.aliyun.com/product/69083.html?spm=a2c4g.11186623.6.540.7c1b705eoBIMFA) and helping things connect to it.

## Getting Started - HelloThing
The `HelloThing` sample demonstrates you the procedure that connecting things to Link IoT Edge.
1. Copy `examples/HelloThing` folder to your workspace.
2. Zip up the content of `HelloThing` folder so that the `index.js` is on the top of the zip file structure.
3. Go to Link IoT Edge console, **Edge Management**, **Driver Management** and then **Create Driver**.
4. Choose the programming language as *nodejs8*.
5. Set the driver name `HelloThing` and upload the previous zip file.
6. Create a product, which owns an property named `temperature`(type of int32), and an event named `high_temperature`(type of int32 and has a input parameter named `temperature` whose type is int32).
7. Create a device of the product created last step, with name `HelloThing`.
8. Create a new Edge Instance and add the Link IoT Edge gateway device into it.
9. Add the `HelloThing` device into the Instance. Choose `HelloThing` as its driver.
10. Add a *Message Router* with the following configuration:
  * Source: `HelloThing` device
  * TopicFilter: Properties.
  * Target: IoT Hub
11. Deploy. A message from `HelloThing` device should be published to IoT Hub every 2 seconds. You can check this by going to the Device Running State page on Link IoT Edge console.

## Usage
First install this library:
```
npm install linkedge-thing-access-sdk
```

Then connect things to Link IoT Edge. The most common use is as follows:
```
const {
  Config,
  ThingAccessClient
} = require('linkedge-thing-access-sdk');

const callbacks = {
  setProperties: function (properties) {
    // Set properties to the physical thing and return the result.
    // Return an object representing the result or the promise wrapper of the object.
    return {
      code: 0,
      message: 'success',
      }
    };
  },
  getProperties: function (keys) {
    // Get properties from the physical thing and return the result.
    // Return an object representing the result or the promise wrapper of the object.
    return {
      code: 0,
      message: 'success',
      params: {
        key1: 'value1',
        key2: 'value2',
      }
    };
  },
  callService: function (name, args) {
    // Call services on the physical thing and return the result.
    // Return an object representing the result or the promise wrapper of the object.
    return new Promise((resolve) => {
      resolve({
        code: 0,
        message: 'success',
      });
    });
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
```

Next follow the [Getting Started](#getting-started---hellothing) to upload and test the function.

## References
You can run the following command in the project root directory to generate the API references to `docs` directory:
```
npm run generate-docs
```

The main API references are as follows.

* **[getConfig()](#getconfig)**
* Config#**[get()](#get)**
* Config#**[getThingInfos()](#getthinginfos)**
* Config#**[getDriverInfo()](#getdriverinfo)**
* Config#**[registerChangedCallback()](#registerchangedcallback)**
* Config#**[unregisterChangedCallback()](#unregisterchangedcallback)**
* **[ThingInfo](#thinginfo)**
* **[ThingAccessClient()](#thingaccessclient)**
* ThingAccessClient#**[setup()](#setup)**
* ThingAccessClient#**[registerAndOnline()](#registerandonline)**
* ThingAccessClient#**[online()](#online)**
* ThingAccessClient#**[offline()](#offline)**
* ThingAccessClient#**[getTsl()](#gettsl)**
* ThingAccessClient#~~**[getTslConfig()](#gettslconfig)**~~
* ThingAccessClient#**[getTslExtInfo()](#gettslextinfo)**
* ThingAccessClient#**[reportEvent()](#reportevent)**
* ThingAccessClient#**[reportProperties()](#reportproperties)**
* ThingAccessClient#**[cleanup()](#cleanup)**
* ThingAccessClient#**[unregister()](#unregister)**

---
<a name="getconfig"></a>
### getConfig()
Returns the global config string.

Returns `Promise<String>`.

---
<a name="get"></a>
### Config.get()
Returns the global config as object.

Returns `Promise<Config>`.

---
<a name="getthinginfos"></a>
### Config.getThinginfos()
Returns all thing infos for further use.

Returns `Array<ThingInfo>`.

---
<a name="getdriverinfo"></a>
### Config.getDriverInfo()
Returns global driver info for further use.

Returns `Object`.

---
<a name="registerchangedcallback"></a>
### Config.registerchangedcallback(callback)
Registers a callback that will be notified when the config changed.

* `callback(configString)`: callback to notify when the config changed event occurs.

---
<a name="unregisterchangedcallback"></a>
### Config.unregisterchangedcallback(callback)
Unregisters a callback.

* `callback(configString)`: callback to notify when the config changed event occurs.

---
<a name="thinginfo"></a>
### ThingInfo
The infos of a thing, which includes:
* `productKey`: the product key of the thing, `String`.
* `deviceName`: the device name of the thing, `String`.
* `custom`: the custom config of the thing, `Object`.

---
<a name="thingaccessclient"></a>
### ThingAccessClient(config, callbacks)
Constructs a [ThingAccessClient](#thingaccessclient) with the specified config and callbacks.

* `config`: the meta data config about the client, `Object`.
* `callbacks`: callback functions responding to the requests from Link IoT Edge platform, `Object`.
  * `getProperties(keys)`: a function responding to get thing properties requests, `Function`.
  * `setProperties(properties)`: a fucntion responding to set thing properties requests, `Function`.
  * `callService(name, args)`: a function responding to call thing services requests, `Function`.

---
<a name="setup"></a>
### ThingAccessClient.setup()
(Deprecated) Performs common constructor intialization and setup operations.

Returns `Promise<Void>`.

---
<a name="registerandonline"></a>
### ThingAccessClient.registerAndOnline()
Registers thing to Link IoT Edge platform and informs it that thing is connected. When register, DEVICE_NAME will be used first if it exists, or LOCAL_NAME is used.

Returns `Promise<Void>`.

---
<a name="online"></a>
### ThingAccessClient.online()
Informs Link IoT Edge platform that thing is connected.

Returns `Promise<Void>`.

---
<a name="offline"></a>
### ThingAccessClient.offline()
Informs Link IoT Edge platform that thing is disconnected.

Returns `Promise<Void>`.

---
<a name="gettsl"></a>
### ThingAccessClient.getTsl()
Returns the TSL(Thing Specification Language) string.

Returns `Promise<String>`.

---
<a name="gettslconfig"></a>
### ~~ThingAccessClient.getTslConfig()~~
Deprecated. Use [getTslExtInfo](#gettslextinfo) instead.

Returns the TSL(Thing Specification Language) config string.

Returns `Promise<String>`.

---
<a name="gettslextinfo"></a>
### ThingAccessClient.getTslExtInfo()
Returns the TSL(Thing Specification Language) extend info string.

Returns `Promise<String>`.

---
<a name="reportevent"></a>
### ThingAccessClient.reportEvent(eventName, args)
Reports a event to Link IoT Edge platform.

* `eventName`: the name of the event, `String`.
* `args`: the parameters attached to the event, `Object`.

---
<a name="reportproperties"></a>
### ThingAccessClient.reportProperties(properties)
Reports new property values to Link IoT Edge platform.

* `properties`: the new properties, `String`.

---
<a name="cleanup"></a>
### ThingAccessClient.cleanup()
Called at the end of the usage of the instance to release resources.

Returns `Promise<Void>`.

---
<a name="unregister"></a>
### ThingAccessClient.unregister()
Removes the binding relationship between thing and Link IoT Edge platform. You usually don't call this function.

Returns `Promise<Void>`.

## License
```
Copyright (c) 2017-present Alibaba Group Holding Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
