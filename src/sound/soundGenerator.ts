/**
 * 6502 cycle-accurate sound generator for Apple II speaker routine.
 *
 * Simulates the machine-code routine at R5-95 ($3B02) from sound.asm / apple_trek.bas:
 *   3B02: LDY #p94
 *   3B04: LDX #$00
 *   3B06: TXA
 *   3B07: CLC
 *   3B08: SBC #$01  (or ADC #$01 if modified via p89)
 *   3B0A: BNE L3B08
 *   3B0C: STA $C030 (toggles speaker)
 *   3B0F: INX
 *   3B10: CPX #p80
 *   3B12: BNE L3B06
 *   3B14: DEY
 *   3B15: BNE L3B04
 *   3B17: RTS
 */

export const op_ADC = 105; // ADC #1 opcode value in ($69) decimal
export const op_SBC = 233; // SBC #1 opcode value in ($E9) decimal
export interface SoundRoutineParams {
  /** Outer loop counter (Y register immediate argument at $3B03 / R5-94). */
  p94: number;
  /** Inner loop opcode at $3B08 / R5-89: 233 ($E9) for SBC #1 or 105 ($69) for ADC #1. */
  p89?: number;
  /** Frequency sweep limit (X register compare immediate at $3B11 / R5-80). */
  p80: number;
  /** CPU clock rate in Hz (standard Apple II is 1,000,000 Hz / ~1.023 MHz). Defaults to 1,000,000. */
  clockHz?: number;
}

export interface SpeakerToggle {
  cycle: number;
  state: number; // +1 or -1
}

export interface SoundSimulationResult {
  totalCycles: number;
  durationSec: number;
  toggles: SpeakerToggle[];
}

/** Standard sound effect presets used in Apple Trek. */
export const APPLE_TREK_SOUND_PRESETS = Object.freeze({
  PHASER: Object.freeze({
    p94: 7,
    p89: op_SBC,
    p80: 140,
    filename: "phaser.wav",
    description: "Phaser firing sweep (apple_trek.bas line 1175)"
  }),
  PHOTON_TORPEDO: Object.freeze({
    p94: 6,
    p89: op_SBC,
    p80: 200,
    filename: "torpedo.wav",
    description: "Photon torpedo movement chirp (apple_trek.bas line 1170)"
  }),
  TORPEDO_HIT: Object.freeze({
    p94: 1,
    p89: op_SBC,
    p80: 180,
    filename: "hit.wav",
    description: "Torpedo impact / explosion burst (apple_trek.bas line 1200)"
  }),
  COMMAND_BEEP: Object.freeze({
    p94: 50,
    p89: op_SBC,
    p80: 3,
    filename: "prompt.wav",
    description: "Command prompt alert tone (apple_trek.bas line 9225)"
  }),
  SELF_DESTRUCT: Object.freeze({
    p94: 1,
    p89: op_ADC,
    p80: 255,
    filename: "destruct.wav",
    description: "Self-destruct upward sweep pass (apple_trek.bas line 7020)"
  })
} as const);

export type SoundPresetName = keyof typeof APPLE_TREK_SOUND_PRESETS;

/**
 * Simulates the 6502 execution cycle-by-cycle and records the timestamp of each speaker click.
 */
export function simulate6502Sound(params: SoundRoutineParams): SoundSimulationResult {
  const { p94, p89 = op_SBC, p80, clockHz = 1_000_000 } = params;
  const isAdc = (p89 & 0xff) === op_ADC;

  let y = p94 & 0xff;
  let totalCycles = 2; // LDY #p94
  const toggles: SpeakerToggle[] = [];
  let speakerState = 1;

  while (y > 0) {
    let x = 0;
    totalCycles += 2; // LDX #0

    while (true) {
      let a = x;
      totalCycles += 2; // TXA
      let c = 0;
      totalCycles += 2; // CLC

      // Inner delay loop
      while (true) {
        if (isAdc) {
          const temp = a + 1 + c;
          c = temp > 255 ? 1 : 0;
          a = temp & 0xff;
        } else {
          const temp = a - 1 - (1 - c);
          c = temp >= 0 ? 1 : 0;
          a = temp & 0xff;
        }

        totalCycles += 2; // ADC #1 or SBC #1
        if (a === 0) {
          totalCycles += 2; // BNE fallthrough (not taken)
          break;
        }
        totalCycles += 3; // BNE taken
      }

      // STA $C030 (speaker toggle) takes 4 cycles; toggles on the 4th cycle
      totalCycles += 4;
      speakerState = -speakerState;
      toggles.push({ cycle: totalCycles, state: speakerState });

      x = (x + 1) & 0xff;
      totalCycles += 2; // INX
      totalCycles += 2; // CPX #p80
      if (x === (p80 & 0xff)) {
        totalCycles += 2; // BNE fallthrough (not taken)
        break;
      }
      totalCycles += 3; // BNE taken
    }

    y = (y - 1) & 0xff;
    totalCycles += 2; // DEY
    if (y === 0) {
      totalCycles += 2; // BNE fallthrough (not taken)
      break;
    }
    totalCycles += 3; // BNE taken
  }

  totalCycles += 6; // RTS

  const durationSec = totalCycles / clockHz;
  return {
    totalCycles,
    durationSec,
    toggles
  };
}

/**
 * Synthesizes 16-bit mono PCM samples at the specified sample rate from the 6502 cycle simulation.
 */
export function synthesizeSoundPcm(
  params: SoundRoutineParams,
  sampleRate: number = 44100,
  amplitude: number = 16000
): Int16Array {
  const clockHz = params.clockHz ?? 1_000_000;
  const sim = simulate6502Sound(params);
  const numSamples = Math.max(1, Math.floor(sim.durationSec * sampleRate));
  const samples = new Int16Array(numSamples);

  let toggleIdx = 0;
  let curState = 1;
  const numToggles = sim.toggles.length;

  for (let i = 0; i < numSamples; i += 1) {
    const curCycle = (i / sampleRate) * clockHz;
    while (toggleIdx < numToggles && sim.toggles[toggleIdx].cycle <= curCycle) {
      curState = sim.toggles[toggleIdx].state;
      toggleIdx += 1;
    }
    samples[i] = curState * amplitude;
  }

  return samples;
}

/**
 * Encodes 16-bit mono PCM samples into a standard RIFF/WAVE byte array.
 */
export function encodeWav(samples: Int16Array, sampleRate: number = 44100): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  // File length minus 8 bytes header
  view.setUint32(4, 36 + dataSize, true);
  // WAVE identifier
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // fmt subchunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}
