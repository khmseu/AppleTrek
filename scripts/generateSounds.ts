import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPLE_TREK_SOUND_PRESETS,
  encodeWav,
  synthesizeSoundPcm
} from "../src/sound/soundGenerator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "../public/sounds");

fs.mkdirSync(outputDir, { recursive: true });

console.log(`Generating pre-rendered 6502 Apple Trek sound assets into ${outputDir}...`);

for (const [key, preset] of Object.entries(APPLE_TREK_SOUND_PRESETS)) {
  const pcm = synthesizeSoundPcm(preset, 44100);
  const wavBytes = encodeWav(pcm, 44100);
  const targetPath = path.join(outputDir, preset.filename);
  fs.writeFileSync(targetPath, wavBytes);
  console.log(` - Generated ${preset.filename} (${key}): ${pcm.length} samples, ${(pcm.length / 44100).toFixed(4)}s [${preset.description}]`);
}

console.log("All sound assets generated successfully.");
