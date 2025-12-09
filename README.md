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
      "topicPrefix": "homebridge",
      "accessories": [
        {
          "name": "Living Room Light",
          "type": "lightbulb"
        },
        {
          "name": "Kitchen Switch",
          "type": "switch"
        },
        {
          "name": "Bedroom Outlet",
          "type": "outlet"
        }
      ]
    }
  ]
}
```

### Configuration Parameters

| Parameter | Required | Description | Default |
|-----------|----------|-------------|---------|
| `platform` | Yes | Must be `MQTTControl` | - |
| `name` | Yes | Name of the platform | - |
| `broker` | Yes | MQTT broker URL (e.g., `mqtt://localhost:1883` or `mqtts://broker.example.com:8883`) | - |
| `username` | No | MQTT broker username | - |
| `password` | No | MQTT broker password | - |
| `topicPrefix` | No | Prefix for all MQTT topics | `homebridge` |
| `accessories` | No | Array of accessories to create | `[]` |

### Accessory Configuration

| Parameter | Required | Description | Options |
|-----------|----------|-------------|---------|
| `name` | Yes | Name of the accessory | - |
| `type` | Yes | Type of accessory | `lightbulb`, `switch`, `outlet` |

## MQTT Topics

The plugin uses the following MQTT topic structure:

**Note:** Accessory names are automatically sanitized for MQTT topics. Spaces and special characters are replaced with hyphens. For example, "Living Room Light" becomes "Living-Room-Light".

### Status Topics (Published by Plugin)

The plugin publishes device status to:
```
{topicPrefix}/{sanitized-accessory-name}/status
```

**Example:**
```
homebridge/Living-Room-Light/status
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
{topicPrefix}/{sanitized-accessory-name}/set
```

**Example:**
```
homebridge/Living-Room-Light/set
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

The plugin publishes its connection status to:
```
{topicPrefix}/connected
```

Payload: `true` when connected

## Usage Examples

### Turn on a light via MQTT

```bash
mosquitto_pub -h localhost -t "homebridge/Living-Room-Light/set" -m '{"on": true}'
```

### Set brightness of a light

```bash
mosquitto_pub -h localhost -t "homebridge/Living-Room-Light/set" -m '{"on": true, "brightness": 75}'
```

### Turn off a switch

```bash
mosquitto_pub -h localhost -t "homebridge/Kitchen-Switch/set" -m '{"on": false}'
```

### Monitor status changes

```bash
mosquitto_sub -h localhost -t "homebridge/#" -v
```

## Integration Examples

### Node-RED

You can easily integrate with Node-RED using MQTT nodes:

1. **Subscribe to status updates:**
   - Topic: `homebridge/+/status`
   - Parse the JSON payload to get device states

2. **Send commands:**
   - Topic: `homebridge/{device-name}/set`
   - Send JSON payload with desired state

### Home Assistant

Add MQTT switches/lights in your Home Assistant configuration:

```yaml
light:
  - platform: mqtt
    name: "Living Room Light"
    state_topic: "homebridge/Living-Room-Light/status"
    command_topic: "homebridge/Living-Room-Light/set"
    payload_on: '{"on": true}'
    payload_off: '{"on": false}'
    state_value_template: "{{ 'ON' if value_json.on else 'OFF' }}"
    brightness_state_topic: "homebridge/Living-Room-Light/status"
    brightness_command_topic: "homebridge/Living-Room-Light/set"
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
