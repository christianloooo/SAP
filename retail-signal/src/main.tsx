import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@ui5/webcomponents-react/ThemeProvider";
import "@ui5/webcomponents-react/dist/Assets.js";
import "@ui5/webcomponents-icons/dist/AllIcons.js";
import App from "./App";
import "./styles.css";
async function start() {
  await setTheme("sap_horizon");
  // UI5 registers the imported controls. Waiting for unrelated custom-element
  // tags can block React forever when production tree shaking removes them.
  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}
void start().catch((error: unknown) => {
  console.error("Retail Signal could not start", error);
  const root = document.getElementById("root");
  if (root) {
    const message = document.createElement("div");
    message.setAttribute("role", "alert");
    message.className = "startup-message";
    const title = document.createElement("h1");
    title.textContent = "Retail Signal could not load";
    const detail = document.createElement("p");
    detail.textContent = "Please reload the page to try again.";
    const retry = document.createElement("button");
    retry.textContent = "Reload application";
    retry.onclick = () => window.location.reload();
    message.append(title, detail, retry);
    root.replaceChildren(message);
  }
});
