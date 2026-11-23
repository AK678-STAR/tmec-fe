// Custom-code configuration follows https://documentation.onesignal.com/docs/en/web-sdk-reference
interface OneSignalSdk {
  init(options: Record<string, unknown>): Promise<void>;
}
declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: OneSignalSdk) => Promise<void>>;
  }
}
export function mountWebPush() {
  const appId = String(import.meta.env.VITE_ONESIGNAL_APP_ID ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      appId,
    ) ||
    !window.isSecureContext ||
    document.getElementById("tmec-onesignal")
  )
    return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (sdk) => {
    try {
      await sdk.init({
        appId,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: true },
        promptOptions: {
          slidedown: { prompts: [{ type: "push", autoPrompt: false }] },
        },
        welcomeNotification: { disable: true },
        autoResubscribe: false,
      });
    } catch (error) {
      console.warn("Web push initialization failed", error);
    }
  });
  const script = document.createElement("script");
  script.id = "tmec-onesignal";
  script.defer = true;
  script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  document.head.appendChild(script);
}
