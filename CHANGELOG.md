# Changelog

### v0.1.0
* Add initial version.

### v0.2.0
* Fix registering failed after unregistering.

### v0.3.0
* Retrieve connection infos from driver config of devices.
* Fix event parsing error.

### v0.4.0
* Update documentation.
* Fix unit test failed cases.

### v0.4.1
* Fix LightSensor restarting all the time.

### v0.5.0
* Use connect APIs for concurrently connecting.
* Get driver config through APIs instead of environment variables.
* Add getConfig(), getThings(), Thing to retrieve driver config.

### v0.5.1
* Rename getThings() to getThingInfos(), Thing to ThingInfo.

### v0.5.2
* Support for notifying config changes.
* Add destroy() to destroy the whole package when no more used.
* Add reason to error message when error no. is 3.

### v0.5.3
* Add getTslConfig() to retrieve TSL(Thing Specification Language) config string.

### v0.5.4
* Keep callback interfaces consistent
* Discard the custom config if it's not JSON string

