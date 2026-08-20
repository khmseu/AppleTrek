import { mountBrowserTerminal } from "./ui/browserTerminal";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  mountBrowserTerminal(app);
}
