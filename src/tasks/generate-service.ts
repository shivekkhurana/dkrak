#!/usr/bin/env bun
// Script to generate a launchd plist file with custom DCA configurations

import { writeFileSync } from "fs";
import { join } from "path";
import { createLogger } from "@src/logger";

const logger = createLogger("generate-service");

const args = process.argv.slice(2);
const configs = args;

if (configs.length === 0) {
  logger.error("No configuration files provided");
  process.exit(1);
}

// Get the current working directory
const cwd = process.cwd();

// Generate the plist content
const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kraken.dca</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/bun</string>
        <string>run</string>
        <string>src/cli.ts</string>
        <string>run</string>
${configs.map((config) => `        <string>${config}</string>`).join("\n")}
    </array>
    
    <key>WorkingDirectory</key>
    <string>${cwd}</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>${cwd}/logs/dca.log</string>
    
    <key>StandardErrorPath</key>
    <string>${cwd}/logs/dca-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>`;

// Write the plist file
const plistPath = join(cwd, "com.kraken.dca.plist");
writeFileSync(plistPath, plistContent);

logger.info({ plistPath, configs }, "Generated plist file");
