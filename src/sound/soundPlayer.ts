import {
  APPLE_TREK_SOUND_PRESETS,
  type SoundPresetName
} from "./soundGenerator";

export type SoundEffectType = "phaser" | "torpedo" | "hit" | "prompt" | "destruct";

export const SOUND_EFFECT_FILES: Record<SoundEffectType, string> = Object.freeze({
  phaser: "/sounds/" + APPLE_TREK_SOUND_PRESETS.PHASER.filename,
  torpedo: "/sounds/" + APPLE_TREK_SOUND_PRESETS.PHOTON_TORPEDO.filename,
  hit: "/sounds/" + APPLE_TREK_SOUND_PRESETS.TORPEDO_HIT.filename,
  prompt: "/sounds/" + APPLE_TREK_SOUND_PRESETS.COMMAND_BEEP.filename,
  destruct: "/sounds/" + APPLE_TREK_SOUND_PRESETS.SELF_DESTRUCT.filename
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
}

/** Global default sound player instance for the browser UI. */
export const defaultSoundPlayer = new SoundPlayer();
