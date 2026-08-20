import { mountBrowserTerminal } from "./ui/browserTerminal";

/** Browser entry point: mount Apple Trek into the Vite-provided app container.
 * Source: apple_trek.bas startup at lines 9005-9052 and 19000.
 */
const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  mountBrowserTerminal(app);
}
