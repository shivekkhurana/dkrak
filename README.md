# Kraken DCA Bot

A Bun + TypeScript script for automated Dollar Cost Averaging (DCA) on Kraken with configurable strategies and ntfy.sh notifications.

## Why ?

DCA requires discipline. And Kraken integrated DCA charges a percentage of the purchase as fee.
This script achieves the same effect, but without the fee.

## Features

- 🔄 **Automated DCA**: Buy cryptocurrency at regular intervals
- 📱 **Mobile Notifications**: Real-time alerts via ntfy.sh
- ⚙️ **Multiple Strategies**: Run different DCA strategies with separate configs
- 🛡️ **Safety Checks**: Low balance warnings and error handling
- 🌍 **Timezone Support**: Run on your local schedule
- 🚀 **CLI Interface**: Easy management of multiple strategies

## Configuration

### Required Environment Variables

```bash
# Kraken API credentials
KRAKEN_API_KEY=your_kraken_api_key
KRAKEN_API_SECRET=your_kraken_api_secret

NTFY_TOPIC=topic_to_send_status_updates_on
```

### Strategy Configuration Files

Each DCA strategy is defined in a JSON configuration file. Example:

```json
{
  "name": "bitcoin-weekly-dca",
  "description": "Weekly Bitcoin DCA strategy",
  "dca": {
    "pair": "XBTUSD",
    "amount_usd": 1000,
    "low_balance_threshold_usd": 1000
  },
  "schedule": {
    "cron": "0 10 * * 1",
    "timezone": "Asia/Kolkata"
  },
  "notifications": {
    "ntfy_topic": "my-kraken-dca"
  }
}
```

## Setup Instructions

1. **Install Dependencies**

   ```bash
   bun install
   ```

2. **Set up ntfy.sh**

   - Go to [ntfy.sh](https://ntfy.sh)
   - Create a new topic
   - Subscribe to the topic on your mobile device

3. **Configure Environment Variables**

   ```bash
   # Create .env file
   cp env.example .env

   # Edit with your values
   vim .env

   # Note: .env file is automatically loaded when using the CLI
   ```

4. **Create Strategy Configurations**

   ```bash
   # Copy example config
   cp config.example.json configs/my-strategy.json

   # Edit the configuration
   vim configs/my-strategy.json
   ```

5. **Run the Bot**

   ```bash
   # Or use the CLI
   bun run cli run configs/my-strategy.json
   ```

6. **Set up as a Service (Optional)**

   ```bash
   # Generate service file with your configs
   bun service:generate configs/bitcoin-weekly.json configs/ethereum-daily.json

   # Install and start the service
   bun service:install
   bun service:start

   # Check service status
   bun service:status

   # View logs
   bun service:logs
   ```

## CLI Usage

The bot includes a powerful CLI interface built with Commander.js for managing multiple strategies:

### CLI Features

- **Unified Run Command**: Single command for running any number of strategies
- **Smart Defaults**: Run all available strategies when no configs specified
- **Argument Validation**: Automatic validation of configuration files
- **Verbose Mode**: Detailed output with `--verbose` flag
- **Parallel/Sequential Execution**: Choose how to run multiple strategies
- **Configuration Validation**: Validate configs without running them
- **Help System**: Comprehensive help for all commands and options

```bash
# Get help
bun cli --help

# Run strategies sequentially
bun dca configs/bitcoin-weekly.json configs/ethereum-daily.json --sequential

# Validate a configuration file
bun cli validate configs/bitcoin-weekly.json

# Convenience scripts (same as above)
bun cli list
bun dca configs/bitcoin-weekly.json

# DCA can take multiple configs
bun dca configs/bitcoin-weekly.json configs/ethereum-daily.json

## Validate config files
bun cli validate configs/bitcoin-weekly.json
```

## Service Management

The bot can be run as a background service using launchd (macOS) and lunchy:

### Service Commands

```bash
# Generate service file with specific configs
bun run service:generate configs/bitcoin-weekly.json configs/ethereum-daily.json

# Install the service
bun run service:install

# Start the service
bun run service:start

# Stop the service
bun run service:stop

# Restart the service
bun run service:restart

# Check service status
bun run service:status

# Uninstall the service
bun run service:uninstall

# View service logs
bun run service:logs

# View error logs
bun run service:logs:error
```

### Service Features

- **Auto-start**: Service starts automatically on system boot
- **Keep-alive**: Automatically restarts if the process crashes
- **Logging**: All output is logged to `logs/dca.log` and `logs/dca-error.log`
- **Background**: Runs in the background without blocking your terminal
- **Flexible**: Can run any combination of DCA strategies

## Example Configurations

### Bitcoin Weekly DCA

```json
{
  "name": "bitcoin-weekly-dca",
  "description": "Weekly Bitcoin DCA strategy",
  "dca": {
    "pair": "XBTUSD",
    "amount_usd": 1000,
    "low_balance_threshold_usd": 1000
  },
  "schedule": {
    "cron": "0 10 * * 1",
    "timezone": "Asia/Kolkata"
  },
  "notifications": {
    "ntfy_topic": "my-kraken-dca"
  }
}
```

## Notifications

The bot sends notifications using https://ntfy.sh. You can install the app and configure a channel in .env.

A channel is required.

## Troubleshooting

### Common Issues

1. **"Missing required env var"**

   - Ensure all required environment variables are set
   - Check your `.env` file exists and is properly formatted

2. **"Invalid cron expression"**

   - Verify your cron expression has 5 parts: `minute hour day month weekday`
   - Use a cron validator to check your expression

3. **"Invalid DCA_USD"**

   - DCA amount must be a positive number
   - Minimum value is $1

4. **ntfy.sh notifications not working**
   - Verify your topic name is correct
   - Check that you're subscribed to the topic
   - Ensure your topic is public or you have proper access

### Logs

The bot provides detailed logging:

- Configuration summary on startup
- Balance checks and order status
- Notification delivery confirmations
