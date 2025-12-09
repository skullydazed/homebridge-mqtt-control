<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge MQTT Control

</span>

A Homebridge plugin that advertises device status to MQTT and can receive instructions to change state on those devices via MQTT. This enables bidirectional communication between HomeKit and MQTT-based home automation systems.

## Features

- 🔄 **Bidirectional Communication**: Control HomeKit accessories via MQTT and publish status changes back to MQTT
- 🏠 **Multiple Accessory Types**: Support for lightbulbs, switches, and outlets
- 📡 **Real-time Updates**: Instant state synchronization between HomeKit and MQTT
- 🔒 **Secure Connection**: Support for MQTT authentication with username/password
- 🎛️ **Configurable Topics**: Customizable MQTT topic prefixes

## Installation

Install the plugin via npm:

```bash
npm install -g homebridge-mqtt-control
```

Or install via the Homebridge UI by searching for "MQTT Control".

## Configuration

Add the platform to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "MQTTControl",
      "name": "MQTT Control",
      "broker": "mqtt://localhost:1883",
      "username": "your_username",
      "password": "your_password",
      "topicPrefix": "homebridge"
    }
  ]
}
```

**That's it!** The plugin will automatically detect and add MQTT control to all accessories registered in your Homebridge instance, regardless of which plugin created them.

### Configuration Parameters

| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `platform` | Yes | Must be `MQTTControl` | - |
| `name` | Yes | Name of the platform | - |
| `broker` | Yes | MQTT broker URL (e.g., `mqtt://localhost:1883` or `mqtts://broker.example.com:8883`) | - |
| `username` | No | MQTT broker username | - |
| `password` | No | MQTT broker password | - |
| `topicPrefix` | No | Prefix for all MQTT topics | `homebridge` |

## How It Works

The plugin automatically discovers all accessories in your Homebridge setup:

1. **Cached Accessories**: When Homebridge starts, all previously registered accessories are loaded from cache
2. **Automatic Detection**: The plugin receives all cached accessories through Homebridge's standard platform mechanism
3. **MQTT Integration**: For each discovered accessory, the plugin:
   - Detects the accessory type (lightbulb, switch, outlet, fan, thermostat, etc.)
   - Creates MQTT topics for status and control
   - Publishes state changes to MQTT
   - Subscribes to commands from MQTT

No manual configuration needed - just connect your MQTT broker and all your cached accessories become MQTT-enabled!

**Note:** When you first install the plugin or add new accessories from other plugins, you may need to restart Homebridge for the MQTT Control plugin to detect them. After the initial restart, all accessories will be cached and automatically available.

## MQTT Topics

The plugin uses the following MQTT topic structure:

**Note:** 
- Topics automatically include the Homebridge instance hostname to support multiple instances
- Accessory names are automatically sanitized for MQTT topics: spaces and special characters are replaced with hyphens, and names are converted to lowercase
- For example, "Living Room Light" on hostname "myserver" becomes "homebridge/myserver/living-room-light"

### Status Topics (Published by Plugin)

The plugin publishes device status to:
```
{topicPrefix}/{hostname}/{sanitized-accessory-name}/status
```

**Example:**
```
homebridge/raspberrypi/living-room-light/status
```

**Payload format:**
```json
{
  "on": true,
  "brightness": 80
}
```

For switches and outlets, the `brightness` property is omitted.

### Command Topics (Subscribed by Plugin)

The plugin listens for commands on:
```
{topicPrefix}/{hostname}/{sanitized-accessory-name}/set
```

**Example:**
```
homebridge/raspberrypi/living-room-light/set
```

**Payload format:**
```json
{
  "on": true,
  "brightness": 80
}
```

You can send partial updates. For example, to only change the brightness:
```json
{
  "brightness": 50
}
```

### Connection Status

### Connection Status

The plugin publishes its connection status to:
```
{topicPrefix}/{hostname}/connected
```

**Example:**
```
homebridge/raspberrypi/connected
```

Payload: `true` when connected

## Usage Examples

**Note:** Replace `raspberrypi` with your actual hostname in the examples below.

### Turn on a light via MQTT

```bash
mosquitto_pub -h localhost -t "homebridge/raspberrypi/living-room-light/set" -m '{"on": true}'
```

### Set brightness of a light

```bash
mosquitto_pub -h localhost -t "homebridge/raspberrypi/living-room-light/set" -m '{"on": true, "brightness": 75}'
```

### Turn off a switch

```bash
mosquitto_pub -h localhost -t "homebridge/raspberrypi/kitchen-switch/set" -m '{"on": false}'
```

### Monitor status changes

```bash
mosquitto_sub -h localhost -t "homebridge/#" -v
```

## Integration Examples

### Node-RED

You can easily integrate with Node-RED using MQTT nodes:

1. **Subscribe to status updates:**
   - Topic: `homebridge/+/+/status` (where first `+` is hostname, second `+` is device name)
   - Parse the JSON payload to get device states

2. **Send commands:**
   - Topic: `homebridge/{hostname}/{device-name}/set`
   - Send JSON payload with desired state

### Home Assistant

Add MQTT switches/lights in your Home Assistant configuration. Replace `raspberrypi` with your hostname:

```yaml
light:
  - platform: mqtt
    name: "Living Room Light"
    state_topic: "homebridge/raspberrypi/living-room-light/status"
    command_topic: "homebridge/raspberrypi/living-room-light/set"
    payload_on: '{"on": true}'
    payload_off: '{"on": false}'
    state_value_template: "{{ 'ON' if value_json.on else 'OFF' }}"
    brightness_state_topic: "homebridge/raspberrypi/living-room-light/status"
    brightness_command_topic: "homebridge/raspberrypi/living-room-light/set"
    brightness_value_template: "{{ value_json.brightness }}"
    brightness_scale: 100
```

## Development

### Setup Development Environment

1. Clone the repository:
```bash
git clone https://github.com/skullydazed/homebridge-mqtt-control.git
cd homebridge-mqtt-control
```

2. Install dependencies:
```bash
npm install
```

3. Build the plugin:
```bash
npm run build
```

4. Link the plugin for local testing:
```bash
npm link
```

### Watch Mode

To automatically rebuild and restart Homebridge when you make changes:

```bash
npm run watch
```

This will use the configuration in `test/hbConfig/config.json`.

### Linting

Run the linter:
```bash
npm run lint
```

## Troubleshooting

### Plugin doesn't connect to MQTT broker

- Verify the broker URL is correct
- Check if the broker is running and accessible
- Verify username/password if authentication is required
- Check Homebridge logs for connection errors

### Accessories don't appear in HomeKit

- Ensure accessories are properly configured in `config.json`
- Check Homebridge logs for any errors during startup
- Try removing and re-adding the Homebridge bridge in the Home app

### MQTT commands don't control accessories

- Verify the topic format matches: `{topicPrefix}/{accessoryName}/set`
- Ensure the JSON payload is properly formatted
- Check Homebridge logs to see if messages are being received

## Support

For issues, questions, or contributions, please visit:
- [GitHub Issues](https://github.com/skullydazed/homebridge-mqtt-control/issues)

## License

Apache-2.0 License. See [LICENSE](LICENSE) file for details.

## Credits

This plugin is built on the [Homebridge Plugin Template](https://github.com/homebridge/homebridge-plugin-template).
