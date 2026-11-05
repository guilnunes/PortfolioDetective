/**
 * A tiny stand-in for Claude's MCP Apps host, used only in tests.
 * It loads the darkroom view in a sandboxed iframe (like Claude does) and forwards
 * the view's tool calls to the real PHP server through functions Playwright exposes.
 */
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

declare global {
  interface Window {
    pdCallTool: (name: string, args: unknown) => Promise<unknown>;
    pdMessage: (params: unknown) => Promise<void>;
    pdStart: (html: string, toolArgs: Record<string, unknown>, toolResult: unknown) => Promise<void>;
  }
}

window.pdStart = async (html, toolArgs, toolResult) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.style.width = "720px";
  iframe.style.height = "600px";
  document.body.append(iframe);

  const bridge = new AppBridge(null, { name: "pd-test-host", version: "0.0.0" }, { serverTools: {}, logging: {}, openLinks: {} }, {
    hostContext: { theme: "dark", displayMode: "inline", locale: "pt-BR", platform: "web" },
  });
  bridge.oncalltool = async (params) => (await window.pdCallTool(params.name, params.arguments ?? {})) as never;
  bridge.onmessage = async (params) => {
    await window.pdMessage(params);
    return {};
  };
  bridge.oninitialized = () => {
    void bridge.sendToolInput({ arguments: toolArgs });
    void bridge.sendToolResult(toolResult as never);
  };

  // Listen before the view boots: it sends ui/initialize as soon as its script runs.
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  iframe.srcdoc = html;
};
