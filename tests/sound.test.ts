// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  APPLE_TREK_SOUND_PRESETS,
  encodeWav,
  simulate6502Sound,
  synthesizeSoundPcm
} from "../src/sound/soundGenerator";
import { defaultSoundPlayer, SOUND_EFFECT_FILES, SoundPlayer } from "../src/sound/soundPlayer";
import { mountBrowserTerminal } from "../src/ui/browserTerminal";

describe("6502 Sound Routine Simulation", () => {
  it("simulates phaser sound timing accurately at 1 MHz", () => {
    const result = simulate6502Sound(APPLE_TREK_SOUND_PRESETS.PHASER);
    expect(result.durationSec).toBeGreaterThan(0.35);
    expect(result.durationSec).toBeLessThan(0.40);
    expect(result.toggles.length).toBe(7 * 140);
    expect(result.toggles[0].state).toBe(-1);
    expect(result.toggles[1].state).toBe(1);
  });

  it("simulates photon torpedo sound timing accurately", () => {
    const result = simulate6502Sound(APPLE_TREK_SOUND_PRESETS.PHOTON_TORPEDO);
    expect(result.durationSec).toBeGreaterThan(0.6);
    expect(result.durationSec).toBeLessThan(0.65);
    expect(result.toggles.length).toBe(6 * 200); // 6 sweeps of 200 steps
  });

  it("simulates torpedo hit burst timing", () => {
    const result = simulate6502Sound(APPLE_TREK_SOUND_PRESETS.TORPEDO_HIT);
    expect(result.durationSec).toBeGreaterThan(0.08);
    expect(result.durationSec).toBeLessThan(0.10);
    expect(result.toggles.length).toBe(1 * 180);
  });

  it("simulates command prompt beep timing", () => {
    const result = simulate6502Sound(APPLE_TREK_SOUND_PRESETS.COMMAND_BEEP);
    expect(result.durationSec).toBeGreaterThan(0.12);
    expect(result.durationSec).toBeLessThan(0.14);
    expect(result.toggles.length).toBe(50 * 3);
  });

  it("simulates self-destruct sweep with ADC #1 opcode (p89=op_ADC)", () => {
    const result = simulate6502Sound(APPLE_TREK_SOUND_PRESETS.SELF_DESTRUCT);
    expect(result.durationSec).toBeGreaterThan(0.15);
    expect(result.durationSec).toBeLessThan(0.20);
    expect(result.toggles.length).toBe(1 * 255);
  });

  it("produces valid PCM samples and RIFF WAVE encoding", () => {
    const sampleRate = 44100;
    const pcm = synthesizeSoundPcm(APPLE_TREK_SOUND_PRESETS.COMMAND_BEEP, sampleRate);
    expect(pcm.length).toBeGreaterThan(5000);

    const wavBytes = encodeWav(pcm, sampleRate);
    expect(wavBytes.length).toBe(44 + pcm.length * 2);

    // Verify RIFF header
    const headerStr = String.fromCharCode(...wavBytes.slice(0, 4));
    expect(headerStr).toBe("RIFF");

    const waveStr = String.fromCharCode(...wavBytes.slice(8, 12));
    expect(waveStr).toBe("WAVE");

    const fmtStr = String.fromCharCode(...wavBytes.slice(12, 16));
    expect(fmtStr).toBe("fmt ");

    const dataStr = String.fromCharCode(...wavBytes.slice(36, 40));
    expect(dataStr).toBe("data");
  });
});

describe("Sound Player & Static Asset Integration", () => {
  it("maps sound effects to pre-generated static sound file paths", () => {
    expect(SOUND_EFFECT_FILES.phaser).toBe("/sounds/phaser.wav");
    expect(SOUND_EFFECT_FILES.torpedo).toBe("/sounds/torpedo.wav");
    expect(SOUND_EFFECT_FILES.hit).toBe("/sounds/hit.wav");
    expect(SOUND_EFFECT_FILES.prompt).toBe("/sounds/prompt.wav");
    expect(SOUND_EFFECT_FILES.destruct).toBe("/sounds/destruct.wav");
  });

  it("manages enabled state and toggle", () => {
    const player = new SoundPlayer({ enabled: true });
    expect(player.isEnabled()).toBe(true);

    expect(player.toggle()).toBe(false);
    expect(player.isEnabled()).toBe(false);

    expect(player.toggle()).toBe(true);
    expect(player.isEnabled()).toBe(true);

    player.setEnabled(false);
    expect(player.isEnabled()).toBe(false);
  });

  it("handles playback safely when disabled", async () => {
    const player = new SoundPlayer({ enabled: false });
    const played = await player.play("phaser");
    expect(played).toBe(false);
  });

  it("verifies that all presets generate valid non-empty WAV byte streams", () => {
    for (const preset of Object.values(APPLE_TREK_SOUND_PRESETS)) {
      const pcm = synthesizeSoundPcm(preset, 44100);
      expect(pcm.length).toBeGreaterThan(0);
      const wav = encodeWav(pcm, 44100);
      expect(wav.length).toBe(44 + pcm.length * 2);
      expect(preset.filename.endsWith(".wav")).toBe(true);
    }
  });

  it("wires sound toggle in browser terminal UI", () => {
    const root = document.createElement("div");
    document.body.append(root);

    const player = new SoundPlayer({ enabled: true });
    mountBrowserTerminal(root, { soundPlayer: player });

    const toggleBtn = root.querySelector<HTMLButtonElement>("#sound-toggle");
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn?.textContent).toBe("SOUND: ON");

    toggleBtn?.click();
    expect(player.isEnabled()).toBe(false);
    expect(toggleBtn?.textContent).toBe("SOUND: OFF");

    toggleBtn?.click();
    expect(player.isEnabled()).toBe(true);
    expect(toggleBtn?.textContent).toBe("SOUND: ON");
  });
});
