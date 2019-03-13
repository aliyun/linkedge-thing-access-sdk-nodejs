[English](README.md)|[中文](README-zh.md)

# Link IoT Edge设备接入SDK Node.js版
本项目提供一个Node.js包，方便用户在[Link IoT Edge](https://help.aliyun.com/product/69083.html?spm=a2c4g.11186623.6.540.7c1b705eoBIMFA)上编写驱动以接入设备。

## 快速开始 - HelloThing
`HelloThing`示例演示将设备接入Link IoT Edge的全过程。
1. 复制`examples/HelloThing`文件夹到你的工作目录。
2. 压缩`HelloThing`目录的内容为一个zip包，确保`index.js`在顶级目录下。
3. 进入Link IoT Edge控制台，**分组管理**，**驱动管理**，**新建驱动**。
4. 语言类型选择*nodejs8*。
5. 驱动名称设置为`HelloThing`，并上传前面准备好的zip包。
6. 创建一个产品。该产品包含一个`temperature`属性（int32类型）和一个`high_temperature`事件（int32类型和一个int32类型名为`temperature`的输入参数）。
7. 创建一个名为`HelloThing`的上述产品的设备。
8. 创建一个新的分组，并将Link IoT Edge网关设备加入到分组。
9. 进入设备驱动页，将之前添加的驱动加入到分组。
10. 将`HelloThing`设备添加到分组，并将`HelloThing`驱动作为其驱动。
11. 使用如下配置添加*消息路由*：
  * 消息来源：`HelloThing`设备
  * TopicFilter：属性
  * 消息目标：IoT Hub
12. 部署分组。`HelloThing`设备将每隔2秒上报属性到云端，可在Link IoT Edge控制台设备运行状态页面查看。

## 使用
首先，安装设备接入SDK：
```
npm install linkedge-thing-access-sdk
```

然后，实现设备接入。最常用的使用方式如下：
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

接下来，按照上述[快速开始](#快速开始---hellothing)的步骤上传和测试函数。

## API参考文档
在项目根目录执行如下命令将生成API参考文档至`docs`目录：
```
npm run generate-docs
```

主要的API参考文档如下：

* **[getConfig()](#getconfig)**
* Config#**[getThingInfos()](#getthinginfos)**
* Config#**[registerChangedCallback()](#registerchangedcallback)**
* Config#**[unregisterChangedCallback()](#unregisterchangedcallback)**
* **[ThingInfo](#thinginfo)**
* **[ThingAccessClient()](#thingaccessclient)**
* ThingAccessClient#**[setup()](#setup)**
* ThingAccessClient#**[registerAndOnline()](#registerandonline)**
* ThingAccessClient#**[online()](#online)**
* ThingAccessClient#**[offline()](#offline)**
* ThingAccessClient#**[getTsl()](#getTsl)**
* ThingAccessClient#**[reportEvent()](#reportevent)**
* ThingAccessClient#**[reportProperties()](#reportproperties)**
* ThingAccessClient#**[cleanup()](#cleanup)**
* ThingAccessClient#**[unregister()](#unregister)**

---
<a name="getconfig"></a>
### getConfig()
返回相关的配置字符串，该配置通常在设备与此驱动程序关联是由系统自动生成。

返回`Promise<String>`.

---
<a name="getthinginfos"></a>
### Config.getThingInfos()
返回所有的关联的Thing信息。

返回 `Array<ThingInfo>`.

---
<a name="registerchangedcallback"></a>
### Config.registerchangedcallback(callback)
注册配置变更回调函数.

* `callback(configString)`: 回调函数，配置发生变更时回调.

---
<a name="unregisterchangedcallback"></a>
### Config.unregisterchangedcallback(callback)
注销配置变更回调函数.

* `callback(configString)`: 回调函数，配置发生变更时回调.

---
<a name="thinginfo"></a>
### ThingInfo
Thing信息类，包含:
* `productKey`: 设备product key。
* `deviceName`: 设备device name。
* `custom`: 设备自定义配置。

---
<a name="thingaccessclient"></a>
### ThingAccessClient(config, callbacks)
使用指定配置和回调函数构造[ThingAccessClient](#thingaccessclient)。

* `config`: 配置相关的元信息, `Object`。
* `callbacks`: 响应来自Link IoT Edge请求的回调函数, `Object`。
  * `getProperties(keys)`: 响应获取属性请求的回调函数, `function`。
  * `setProperties(properties)`: 响应设置属性请求的回调函数, `function`。
  * `callService(name, args)`: 响应调用服务请求的回调函数, `function`。

<a name="setup"></a>
### ThingAccessClient.setup()
(已废弃) 执行通用的初始化操作。

返回`Promise<Void>`。

---
<a name="registerandonline"></a>
### ThingAccessClient.registerAndOnline()
注册设备到Link IoT Edge，并通知设备上线。注册时，优先使用DEVICE_NAME，若没有则使用LOCAL_NAME。

返回`Promise<Void>`.

---
<a name="online"></a>
### ThingAccessClient.online()
通知Link IoT Edge设备上线。

返回`Promise<Void>`。

---
<a name="offline"></a>
### ThingAccessClient.offline()
通知Link IoT Edge设备下线。

返回`Promise<Void>`。

---
<a name="gettsl"></a>
### ThingAccessClient.getTsl()
返回TSL(Thing Specification Language)字符串。

返回`Promise<String>`。

---
<a name="reportevent"></a>
### ThingAccessClient.reportEvent(eventName, args)
上报事件到Link IoT Edge。

* `eventName`: 事件名, `String`。
* `args`: 事件附属信息, `Object`。

---
<a name="reportProperties"></a>
### ThingAccessClient.reportProperties(properties)
上报属性到Link IoT Edge。

* `properties`: 上报的属性, `String`。

---
<a name="cleanup"></a>
### ThingAccessClient.cleanup()
清理资源。使用结束时调用。

返回`Promise<Void>`。

---
<a name="unregister"></a>
### ThingAccessClient.unregister()
移除设备和Link IoT Edge的绑定关系。通常无需调用。

返回`Promise<Void>`。

## 许可证
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
