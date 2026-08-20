import { mountBrowserTerminal } from "./ui/browserTerminal";

/** Browser entry point: mount Apple Trek into the Vite-provided app container. */
const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  mountBrowserTerminal(app);
}
