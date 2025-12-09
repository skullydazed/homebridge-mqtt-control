import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import * as mqtt from 'mqtt';

import { ExamplePlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

// This is only required when using Custom Services and Characteristics not support by HomeKit
import { EveHomeKitTypes } from 'homebridge-lib/EveHomeKitTypes';

interface MQTTConfig extends PlatformConfig {
  broker: string;
  username?: string;
  password?: string;
  topicPrefix?: string;
  accessories?: Array<{
    name: string;
    type: string;
  }>;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  // This is only required when using Custom Services and Characteristics not support by HomeKit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly CustomServices: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly CustomCharacteristics: any;

  // MQTT client
  public mqttClient?: mqtt.MqttClient;
  public readonly topicPrefix: string;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // This is only required when using Custom Services and Characteristics not support by HomeKit
    this.CustomServices = new EveHomeKitTypes(this.api).Services;
    this.CustomCharacteristics = new EveHomeKitTypes(this.api).Characteristics;

    // Get MQTT configuration
    const mqttConfig = this.config as MQTTConfig;
    this.topicPrefix = mqttConfig.topicPrefix || 'homebridge';

    this.log.debug('Finished initializing platform:', this.config.name);

    // Validate MQTT configuration
    if (!mqttConfig.broker) {
      this.log.error('MQTT broker URL is required in config');
      return;
    }

    // Connect to MQTT broker
    this.connectMQTT(mqttConfig);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * Connect to MQTT broker
   */
  connectMQTT(mqttConfig: MQTTConfig) {
    const options: mqtt.IClientOptions = {};
    
    if (mqttConfig.username) {
      options.username = mqttConfig.username;
    }
    if (mqttConfig.password) {
      options.password = mqttConfig.password;
    }

    this.log.info('Connecting to MQTT broker:', mqttConfig.broker);
    this.mqttClient = mqtt.connect(mqttConfig.broker, options);

    this.mqttClient.on('connect', () => {
      this.log.info('Connected to MQTT broker');
      // Publish connection status
      this.publishStatus('connected', 'true');
    });

    this.mqttClient.on('error', (error) => {
      this.log.error('MQTT connection error:', error.message);
    });

    this.mqttClient.on('close', () => {
      this.log.warn('MQTT connection closed');
    });

    this.mqttClient.on('reconnect', () => {
      this.log.info('Reconnecting to MQTT broker...');
    });
  }

  /**
   * Publish a status message to MQTT
   */
  publishStatus(topic: string, message: string) {
    if (!this.mqttClient || !this.mqttClient.connected) {
      this.log.warn('Cannot publish to MQTT: not connected');
      return;
    }

    try {
      const fullTopic = `${this.topicPrefix}/${topic}`;
      this.mqttClient.publish(fullTopic, message, { retain: true }, (error) => {
        if (error) {
          this.log.error('Error publishing to MQTT:', error.message);
        } else {
          this.log.debug('Published to MQTT:', fullTopic, '=', message);
        }
      });
    } catch (error) {
      this.log.error('Exception while publishing to MQTT:', error);
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // Get accessories from config
    const mqttConfig = this.config as MQTTConfig;
    const configuredAccessories = mqttConfig.accessories || [];

    // If no accessories are configured, log a message and return
    if (configuredAccessories.length === 0) {
      this.log.warn('No accessories configured. Please add accessories in the plugin config.');
      return;
    }

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of configuredAccessories) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.name);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new ExamplePlatformAccessory(this, existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new ExamplePlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // push into discoveredCacheUUIDs
      this.discoveredCacheUUIDs.push(uuid);
    }

    // you can also deal with accessories from the cache which are no longer present by removing them from Homebridge
    // for example, if your plugin logs into a cloud account to retrieve a device list, and a user has previously removed a device
    // from this cloud account, then this device will no longer be present in the device list but will still be in the Homebridge cache
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
