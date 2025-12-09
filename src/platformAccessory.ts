import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { ExampleHomebridgePlatform } from './platform.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ExamplePlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
  };

  private readonly deviceName: string;
  private readonly deviceType: string;
  private readonly mqttTopicName: string;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.deviceName = accessory.displayName;
    // Sanitize device name for MQTT topics
    this.mqttTopicName = this.sanitizeMqttTopic(this.deviceName);
    
    // Detect the accessory type by checking existing services
    this.deviceType = this.detectAccessoryType();
    this.service = this.getOrCreatePrimaryService();

    // Skip MQTT setup if no valid service was found
    if (this.service.UUID === this.platform.Service.AccessoryInformation.UUID) {
      this.platform.log.warn('Skipping MQTT setup for:', this.deviceName, '(no controllable service found)');
      return;
    }

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.deviceName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // Try to register handlers for the On/Off Characteristic if it exists
    try {
      const onCharacteristic = this.service.getCharacteristic(this.platform.Characteristic.On);
      if (onCharacteristic) {
        onCharacteristic
          .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
          .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below
      }
    } catch (error) {
      this.platform.log.debug('On characteristic not found for:', this.deviceName);
    }

    // register handlers for the Brightness Characteristic (only for lightbulbs)
    if (this.deviceType.toLowerCase() === 'lightbulb') {
      try {
        const brightnessCharacteristic = this.service.getCharacteristic(this.platform.Characteristic.Brightness);
        if (brightnessCharacteristic) {
          brightnessCharacteristic.onSet(this.setBrightness.bind(this)); // SET - bind to the `setBrightness` method below
        }
      } catch (error) {
        this.platform.log.debug('Brightness characteristic not found for:', this.deviceName);
      }
    }

    // Subscribe to MQTT commands for this device
    this.subscribeToCommands();

    // Publish initial status
    this.publishState();
  }

  /**
   * Detect the accessory type by checking existing services
   */
  detectAccessoryType(): string {
    // Check for existing service types
    if (this.accessory.getService(this.platform.Service.Lightbulb)) {
      return 'lightbulb';
    } else if (this.accessory.getService(this.platform.Service.Switch)) {
      return 'switch';
    } else if (this.accessory.getService(this.platform.Service.Outlet)) {
      return 'outlet';
    } else if (this.accessory.getService(this.platform.Service.Fan)) {
      return 'fan';
    } else if (this.accessory.getService(this.platform.Service.Thermostat)) {
      return 'thermostat';
    } else if (this.accessory.getService(this.platform.Service.WindowCovering)) {
      return 'windowcovering';
    } else if (this.accessory.getService(this.platform.Service.Door)) {
      return 'door';
    } else if (this.accessory.getService(this.platform.Service.LockMechanism)) {
      return 'lock';
    }
    // Default to switch for unknown types
    return 'switch';
  }

  /**
   * Get or create the primary controllable service for this accessory
   */
  getOrCreatePrimaryService(): Service {
    // Try to get existing service first
    const service = this.accessory.getService(this.platform.Service.Lightbulb) ||
                  this.accessory.getService(this.platform.Service.Switch) ||
                  this.accessory.getService(this.platform.Service.Outlet) ||
                  this.accessory.getService(this.platform.Service.Fan) ||
                  this.accessory.getService(this.platform.Service.Thermostat) ||
                  this.accessory.getService(this.platform.Service.WindowCovering) ||
                  this.accessory.getService(this.platform.Service.Door) ||
                  this.accessory.getService(this.platform.Service.LockMechanism);
    
    // If no recognized service exists, don't create a new one - just log a warning
    if (!service) {
      this.platform.log.warn('No recognized controllable service found for:', this.deviceName);
      // Return a placeholder - we'll skip MQTT setup for this accessory
      return this.accessory.getService(this.platform.Service.AccessoryInformation)!;
    }
    
    return service;
  }

  /**
   * Sanitize device name for use in MQTT topics
   */
  sanitizeMqttTopic(name: string): string {
    // Replace spaces and special characters with hyphens
    return name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * Subscribe to MQTT commands for this device
   */
  subscribeToCommands() {
    if (!this.platform.mqttClient) {
      return;
    }

    const commandTopic = `${this.platform.topicPrefix}/${this.mqttTopicName}/set`;
    this.platform.mqttClient.subscribe(commandTopic, (error) => {
      if (error) {
        this.platform.log.error('Error subscribing to command topic:', error.message);
      } else {
        this.platform.log.info('Subscribed to command topic:', commandTopic);
      }
    });

    // Handle incoming MQTT messages
    this.platform.mqttClient.on('message', (topic, message) => {
      if (topic === commandTopic) {
        this.handleCommand(message.toString());
      }
    });
  }

  /**
   * Handle incoming MQTT command
   */
  handleCommand(message: string) {
    try {
      const command = JSON.parse(message);
      this.platform.log.debug('Received command for', this.deviceName, ':', command);

      if (command.on !== undefined) {
        this.exampleStates.On = command.on;
        this.service.updateCharacteristic(this.platform.Characteristic.On, command.on);
      }

      if (command.brightness !== undefined && this.deviceType.toLowerCase() === 'lightbulb') {
        this.exampleStates.Brightness = command.brightness;
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, command.brightness);
      }

      // Publish updated state
      this.publishState();
    } catch (error) {
      this.platform.log.error('Error parsing command:', error);
    }
  }

  /**
   * Publish current state to MQTT
   */
  publishState() {
    const state: { on: boolean; brightness?: number } = {
      on: this.exampleStates.On,
    };

    if (this.deviceType.toLowerCase() === 'lightbulb') {
      state.brightness = this.exampleStates.Brightness;
    }

    this.platform.publishStatus(`${this.mqttTopicName}/status`, JSON.stringify(state));
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.exampleStates.On = value as boolean;

    this.platform.log.debug('Set Characteristic On ->', value, 'for', this.deviceName);

    // Publish the state change to MQTT
    this.publishState();
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.
   * In this case, you may decide not to implement `onGet` handlers, which may speed up
   * the responsiveness of your device in the Home app.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.exampleStates.On;

    this.platform.log.debug('Get Characteristic On ->', isOn, 'for', this.deviceName);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.exampleStates.Brightness = value as number;

    this.platform.log.debug('Set Characteristic Brightness -> ', value, 'for', this.deviceName);

    // Publish the state change to MQTT
    this.publishState();
  }
}
