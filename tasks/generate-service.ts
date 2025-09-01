#!/usr/bin/env bun
// Script to generate a launchd plist file with custom DCA configurations

import { writeFileSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const configs = args;

if (configs.length === 0) {
  console.error("Usage: bun run tasks/generate-service.ts <config1> <config2> ...");
  console.error("");
  console.error("Examples:");
  console.error("  bun run tasks/generate-service.ts configs/bitcoin-weekly.json");
  console.error("  bun run tasks/generate-service.ts configs/bitcoin-weekly.json configs/ethereum-daily.json");
  console.error("  bun run tasks/generate-service.ts configs/*.json");
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
${configs.map(config => `        <string>${config}</string>`).join('\n')}
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

console.log("✅ Generated plist file:", plistPath);
console.log("📋 Configurations included:");
configs.forEach(config => console.log(`   - ${config}`));
console.log("");
console.log("🚀 To install and start the service:");
console.log("   bun run service:install");
console.log("   bun run service:start");
console.log("");
console.log("📊 To check service status:");
console.log("   bun run service:status");
console.log("");
console.log("📝 To view logs:");
console.log("   bun run service:logs");
