import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import * as mqtt from 'mqtt';

import { ExamplePlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

// This is only required when using Custom Services and Characteristics not support by HomeKit
import { EveHomeKitTypes } from 'homebridge-lib/EveHomeKitTypes';

// Avoid unused variable warnings
void PLATFORM_NAME;
void PLUGIN_NAME;

interface MQTTConfig extends PlatformConfig {
  broker: string;
  username?: string;
  password?: string;
  topicPrefix?: string;
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
    
    // Set up MQTT for this cached accessory immediately
    new ExamplePlatformAccessory(this, accessory);
  }

  /**
   * This method sets up listeners to automatically add MQTT support to all accessories.
   * It monitors accessory registration events from all plugins and adds MQTT control dynamically.
   */
  discoverDevices() {
    this.log.info('MQTT Control plugin ready. Monitoring for accessories...');
    
    // Listen for accessories being registered by other plugins
    // We use internal events to detect when accessories are registered
    const homebridgeAPI = this.api as unknown as {
      on: (event: string, listener: (...args: unknown[]) => void) => void;
    };
    
    // Listen for platform accessories being registered
    homebridgeAPI.on('registerPlatformAccessories', (...args: unknown[]) => {
      const accessories = args[0] as PlatformAccessory[];
      this.log.debug('Detected new platform accessories being registered:', accessories.length);
      for (const accessory of accessories) {
        // Only add MQTT support to accessories we haven't seen before
        if (!this.accessories.has(accessory.UUID)) {
          this.log.info('Adding MQTT support to:', accessory.displayName);
          this.accessories.set(accessory.UUID, accessory);
          new ExamplePlatformAccessory(this, accessory);
        }
      }
    });
    
    this.log.info('MQTT Control is now monitoring all Homebridge accessories');
  }
}
