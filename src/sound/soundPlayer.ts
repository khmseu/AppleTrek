import {
  APPLE_TREK_SOUND_PRESETS,
  op_SBC,
  type SoundPresetName,
  type SoundRoutineParams
} from "./soundGenerator";

export type SoundEffectType = "phaser" | "torpedo" | "hit" | "prompt" | "destruct";

export const SOUND_EFFECT_FILES: Record<SoundEffectType, string> = Object.freeze({
  phaser: "/sounds/" + APPLE_TREK_SOUND_PRESETS.PHASER.filename,
  torpedo: "/sounds/" + APPLE_TREK_SOUND_PRESETS.PHOTON_TORPEDO.filename,
  hit: "/sounds/" + APPLE_TREK_SOUND_PRESETS.TORPEDO_HIT.filename,
  prompt: "/sounds/" + APPLE_TREK_SOUND_PRESETS.COMMAND_BEEP.filename,
  destruct: "/sounds/" + APPLE_TREK_SOUND_PRESETS.SELF_DESTRUCT.filename
});

/** Maps each pregenerated preset to the effect name its .wav file is registered under. */
const PRESET_EFFECTS: Record<SoundPresetName, SoundEffectType> = Object.freeze({
  PHASER: "phaser",
  PHOTON_TORPEDO: "torpedo",
  TORPEDO_HIT: "hit",
  COMMAND_BEEP: "prompt",
  SELF_DESTRUCT: "destruct"
});

export interface SoundPlayerOptions {
  basePath?: string;
  enabled?: boolean;
}

export class SoundPlayer {
  private enabled: boolean;
  private basePath: string;
  private audioCache: Map<SoundEffectType, HTMLAudioElement | null> = new Map();

  constructor(options: SoundPlayerOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.basePath = options.basePath ?? "/sounds/";
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public async play(effect: SoundEffectType): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    if (typeof window === "undefined" || typeof Audio === "undefined") {
      return false;
    }

    try {
      let audio = this.audioCache.get(effect);
      if (!audio) {
        const filename = this.getFilename(effect);
        audio = new Audio(`${this.basePath}${filename}`);
        this.audioCache.set(effect, audio);
      }

      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      // Audio playback might be restricted by browser autoplay policy before gesture
      return false;
    }
  }

  public getFilename(effect: SoundEffectType): string {
    switch (effect) {
      case "phaser":
        return APPLE_TREK_SOUND_PRESETS.PHASER.filename;
      case "torpedo":
        return APPLE_TREK_SOUND_PRESETS.PHOTON_TORPEDO.filename;
      case "hit":
        return APPLE_TREK_SOUND_PRESETS.TORPEDO_HIT.filename;
      case "prompt":
        return APPLE_TREK_SOUND_PRESETS.COMMAND_BEEP.filename;
      case "destruct":
        return APPLE_TREK_SOUND_PRESETS.SELF_DESTRUCT.filename;
    }
  }

  /**
   * Plays the pregenerated .wav file whose R5-95 parameters match p94/p89/p80,
   * standing in for the original `POKE`+`CALL R5-95` sequence.
   *
   * @throws {Error} When no pregenerated preset matches the given parameters.
   */
  public playRoutine(params: SoundRoutineParams): Promise<boolean> {
    const p89 = params.p89 ?? op_SBC;
    const presetName = (Object.keys(APPLE_TREK_SOUND_PRESETS) as SoundPresetName[]).find((name) => {
      const preset = APPLE_TREK_SOUND_PRESETS[name];
      return preset.p94 === params.p94 && preset.p80 === params.p80 && preset.p89 === p89;
    });

    if (!presetName) {
      throw new Error(
        `No pregenerated sound file for p94=${params.p94}, p89=${p89}, p80=${params.p80}`
      );
    }

    return this.play(PRESET_EFFECTS[presetName]);
  }
}

/** Global default sound player instance for the browser UI. */
export const defaultSoundPlayer = new SoundPlayer();
