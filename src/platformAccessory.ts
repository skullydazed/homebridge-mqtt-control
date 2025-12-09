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
    this.deviceName = accessory.context.device.name;
    this.deviceType = accessory.context.device.type || 'lightbulb';
    // Sanitize device name for MQTT topics
    this.mqttTopicName = this.sanitizeMqttTopic(this.deviceName);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'MQTT Control')
      .setCharacteristic(this.platform.Characteristic.Model, this.deviceType)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.deviceName);

    // get the service based on device type
    // you can create multiple services for each accessory
    switch (this.deviceType.toLowerCase()) {
    case 'switch':
      this.service = this.accessory.getService(this.platform.Service.Switch) || 
        this.accessory.addService(this.platform.Service.Switch);
      break;
    case 'outlet':
      this.service = this.accessory.getService(this.platform.Service.Outlet) || 
        this.accessory.addService(this.platform.Service.Outlet);
      break;
    case 'lightbulb':
    default:
      this.service = this.accessory.getService(this.platform.Service.Lightbulb) || 
        this.accessory.addService(this.platform.Service.Lightbulb);
      break;
    }

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.deviceName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic (only for lightbulbs)
    if (this.deviceType.toLowerCase() === 'lightbulb') {
      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onSet(this.setBrightness.bind(this)); // SET - bind to the `setBrightness` method below
    }

    // Subscribe to MQTT commands for this device
    this.subscribeToCommands();

    // Publish initial status
    this.publishState();
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
