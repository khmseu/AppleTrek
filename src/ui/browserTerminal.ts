import {
  APPLE_II_MEMORY,
  APPLE_II_MACHINE,
  APPLE_II_ROM_CALLS,
  SeededRng,
  setWindow,
  tabHV
} from "../compat/basicCompat";
import { defaultSoundPlayer, SoundPlayer } from "../sound/soundPlayer";
import {
  createCommandSession,
  dispatchControl,
  dispatchPrompt,
  isControlAction,
  type CommandSession,
  type ControlCommandInput
} from "./commandDispatcher";
import { renderOutputLog, renderSectorPanel, renderStatusPanel } from "./terminalRenderer";

function appendError(session: CommandSession, message: string): CommandSession {
  return {
    ...session,
    log: [...session.log, `! ${message}`]
  };
}

function numberFromInput(input: HTMLInputElement): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function playSoundForAction(action: string, soundPlayer: SoundPlayer): void {
  if (action === "phasers") {
    void soundPlayer.play("phaser");
  } else if (action === "torpedo") {
    void soundPlayer.play("torpedo");
  } else if (action === "self-destruct") {
    void soundPlayer.play("destruct");
  } else {
    void soundPlayer.play("prompt");
  }
}

function playSoundForPrompt(prompt: string, soundPlayer: SoundPlayer): void {
  const normalized = prompt.trim().toUpperCase();
  if (normalized.startsWith("PHAS") || normalized.startsWith("4")) {
    void soundPlayer.play("phaser");
  } else if (normalized.startsWith("TORP") || normalized.startsWith("5")) {
    void soundPlayer.play("torpedo");
  } else if (normalized.startsWith("SELF") || normalized.startsWith("DESTRUCT") || normalized.startsWith("9")) {
    void soundPlayer.play("destruct");
  } else {
    void soundPlayer.play("prompt");
  }
}

export interface MountTerminalOptions {
  soundPlayer?: SoundPlayer;
}

/**
 * Mounts the complete browser terminal UI into an existing application element.
 *
 * The terminal owns a deterministic command session and shared RNG, renders the
 * status/sector/log panels, and routes both prompt submissions and quick-control
 * buttons through the same dispatcher path used by tests and scripted replays.
 * Source: apple_trek.bas screen setup at lines 600-690 and 9051-9052; command loop at lines 9220-9310.
 *
 * @throws {Error} When expected DOM nodes cannot be found after template setup.
 */
export function mountBrowserTerminal(app: HTMLElement, options?: MountTerminalOptions): void {
  const soundPlayer = options?.soundPlayer ?? defaultSoundPlayer;

  // TEXT
  setWindow(0, 40, 0, 24);
  tabHV(1,13);
  APPLE_II_MACHINE.call(APPLE_II_ROM_CALLS.MON_HOME);

  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.ZP_WNDLFT, 0x00);
  APPLE_II_MACHINE.poke(APPLE_II_MEMORY.ZP_WNDWDTH, 0x28);

  const rng = new SeededRng(1701);
  let session = createCommandSession();
  const styleElementId = "apple-trek-terminal-style";

  app.innerHTML = `
    <section class="terminal-shell" aria-label="Apple Trek terminal">
      <header class="terminal-header">
        <div class="terminal-title-row">
          <h1>APPLE TREK</h1>
          <button type="button" id="sound-toggle" class="sound-toggle" aria-label="Toggle sound">SOUND: ${soundPlayer.isEnabled() ? "ON" : "OFF"}</button>
        </div>
        <p>Retro command deck</p>
      </header>
      <div class="terminal-grid">
        <pre class="panel status-panel" aria-live="polite"></pre>
        <pre class="panel sector-panel" aria-live="polite"></pre>
      </div>
      <pre class="panel log-panel" aria-live="polite"></pre>
      <form class="prompt-form" aria-label="Command prompt">
        <label for="command-input">Command</label>
        <input id="command-input" name="command" autocomplete="off" spellcheck="false" placeholder="ION 90 2" />
        <button type="submit">Execute</button>
      </form>
      <section class="controls" aria-label="Quick controls">
        <div class="control-row">
          <label>Course <input id="course-input" type="number" value="90" min="0" max="359" /></label>
          <label>Value <input id="value-input" type="number" value="2" min="0" /></label>
          <button type="button" data-action="ion">ION</button>
          <button type="button" data-action="warp">WARP</button>
          <button type="button" data-action="torpedo">TORPEDO</button>
        </div>
        <div class="control-row">
          <label>Shields % <input id="shields-input" type="number" value="50" min="0" max="100" /></label>
          <label>Phaser Energy <input id="phasers-input" type="number" value="500" min="0" /></label>
          <button type="button" data-action="shields">SHIELDS</button>
          <button type="button" data-action="phasers">PHASERS</button>
        </div>
      </section>
    </section>
  `;

  if (!document.getElementById(styleElementId)) {
    const style = document.createElement("style");
    style.id = styleElementId;
    style.textContent = `
      :root {
        color: #98ff98;
        background: radial-gradient(circle at top, #122516 0%, #071108 55%, #030704 100%);
        font-family: "Courier New", Courier, monospace;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 20% 15%, #17331e 0%, #08110a 40%, #020502 100%);
        color: #98ff98;
      }

      #app {
        max-width: 1100px;
        margin: 0 auto;
        padding: 1rem;
      }

      .terminal-shell {
        border: 1px solid #3da054;
        box-shadow: 0 0 30px rgba(72, 199, 104, 0.25);
        background: rgba(3, 10, 5, 0.9);
        padding: 1rem;
      }

      .terminal-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sound-toggle {
        font-size: 0.8rem;
        padding: 0.2rem 0.5rem;
      }

      .terminal-header h1 {
        margin: 0;
        letter-spacing: 0.18em;
        font-size: 1.4rem;
      }

      .terminal-header p {
        margin: 0.2rem 0 0.8rem;
        color: #b5ffb5;
      }

      .terminal-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.8rem;
      }

      .panel {
        margin: 0;
        border: 1px solid #2b703a;
        background: rgba(0, 0, 0, 0.45);
        padding: 0.6rem;
        min-height: 13rem;
        overflow: auto;
      }

      .log-panel {
        margin-top: 0.8rem;
        min-height: 10rem;
      }

      .prompt-form {
        margin-top: 0.8rem;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem;
        align-items: center;
      }

      .controls {
        margin-top: 0.8rem;
        display: grid;
        gap: 0.5rem;
      }

      .control-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }

      input,
      button {
        font: inherit;
        border: 1px solid #3da054;
        background: #071108;
        color: #b8ffb8;
        padding: 0.35rem 0.45rem;
      }

      button {
        cursor: pointer;
      }

      button:hover,
      button:focus-visible {
        background: #13311a;
        outline: none;
      }

      @media (max-width: 820px) {
        .terminal-grid {
          grid-template-columns: 1fr;
        }

        .prompt-form {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  const statusPanel = app.querySelector<HTMLPreElement>(".status-panel");
  const sectorPanel = app.querySelector<HTMLPreElement>(".sector-panel");
  const logPanel = app.querySelector<HTMLPreElement>(".log-panel");
  const form = app.querySelector<HTMLFormElement>(".prompt-form");
  const commandInput = app.querySelector<HTMLInputElement>("#command-input");
  const courseInput = app.querySelector<HTMLInputElement>("#course-input");
  const valueInput = app.querySelector<HTMLInputElement>("#value-input");
  const shieldsInput = app.querySelector<HTMLInputElement>("#shields-input");
  const phasersInput = app.querySelector<HTMLInputElement>("#phasers-input");

  if (
    !statusPanel ||
    !sectorPanel ||
    !logPanel ||
    !form ||
    !commandInput ||
    !courseInput ||
    !valueInput ||
    !shieldsInput ||
    !phasersInput
  ) {
    throw new Error("Terminal UI failed to initialize");
  }

  /**
   * Renders the current session state into the three terminal panels.
   *
   * The status panel shows stardate, energy, shields, torpedoes, Klingons, bases,
   * and current quadrant/sector. The sector panel shows the current sector grid.
  * The log panel shows the command history and any errors.
  * Source: apple_trek.bas lines 1000-1080 and command output flow at 9220-9275.
   */
  const render = (): void => {
    statusPanel.textContent = renderStatusPanel(session.state);
    sectorPanel.textContent = renderSectorPanel(session.state);
    logPanel.textContent = renderOutputLog(session.log);
  };

  const soundToggle = app.querySelector<HTMLButtonElement>("#sound-toggle");

  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      const enabled = soundPlayer.toggle();
      soundToggle.textContent = `SOUND: ${enabled ? "ON" : "OFF"}`;
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    APPLE_II_MACHINE.peek(APPLE_II_MEMORY.IO_KBD);
    APPLE_II_MACHINE.poke(APPLE_II_MEMORY.IO_KBDSTRB, 0x00);

    const prompt = commandInput.value.trim();
    if (prompt.length === 0) {
      return;
    }

    playSoundForPrompt(prompt, soundPlayer);

    try {
      session = dispatchPrompt(session, prompt, rng);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      session = appendError(session, message);
    }

    commandInput.value = "";
    render();
  });

  app.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      APPLE_II_MACHINE.peek(APPLE_II_MEMORY.IO_KBD);
      APPLE_II_MACHINE.poke(APPLE_II_MEMORY.IO_KBDSTRB, 0x00);

      const action = button.dataset.action;
      if (!action) {
        return;
      }

      if (!isControlAction(action)) {
        session = appendError(session, `Unknown control action: ${action}`);
        render();
        return;
      }

      playSoundForAction(action, soundPlayer);

      let control: ControlCommandInput;

      if (action === "ion" || action === "warp") {
        control = {
          action,
          course: numberFromInput(courseInput),
          value: numberFromInput(valueInput)
        };
      } else if (action === "torpedo") {
        control = {
          action,
          course: numberFromInput(courseInput)
        };
      } else if (action === "shields") {
        control = {
          action,
          value: numberFromInput(shieldsInput)
        };
      } else if (action === "phasers") {
        control = {
          action,
          value: numberFromInput(phasersInput)
        };
      } else {
        control = {
          action: "self-destruct"
        };
      }

      try {
        session = dispatchControl(session, control, rng);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Command failed";
        session = appendError(session, message);
      }

      render();
    });
  });

  render();
}
