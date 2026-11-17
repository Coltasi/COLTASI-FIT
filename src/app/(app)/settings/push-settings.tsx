"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./actions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push";

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

async function currentSub() {
  const reg = await navigator.serviceWorker.ready;
  return { reg, sub: await reg.pushManager.getSubscription() };
}

function toPayload(sub: PushSubscription) {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" };
}

/** Turns phone reminders on or off for this device. Also refreshes the device time zone each visit. */
export function PushSettings() {
  const [state, setState] = useState<State>("checking");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const { sub } = await currentSub();
      if (sub && Notification.permission === "granted") {
        setState("on");
        // Keeps the saved time zone current when travelling.
        savePushSubscription(toPayload(sub), Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.userAgent);
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true); setErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const { reg, sub: existing } = await currentSub();
      const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const res = await savePushSubscription(toPayload(sub), Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.userAgent);
      if (res.error) { setErr(res.error); return; }
      await reg.showNotification("Reminders are on", { body: "You will get your sleep and weigh-in reminders here.", icon: "/icons/icon-192.png", tag: "welcome" });
      setState("on");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not turn on notifications.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setErr(null);
    try {
      const { sub } = await currentSub();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } finally { setBusy(false); }
  }

  const note =
    state === "unsupported" ? "This browser can't receive notifications. Open the installed app on your phone."
    : state === "blocked" ? "Notifications are blocked for this app. Allow them in your phone's site settings, then come back."
    : state === "on" ? "On for this device."
    : "Off for this device.";

  return (
    <div className="row" style={{ minHeight: 56, justifyContent: "space-between", gap: 12 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Phone notifications</p>
        <p className="cap">{err ?? note}</p>
      </div>
      {state === "off" && <button type="button" className="btn small" disabled={busy} onClick={enable}>Turn on</button>}
      {state === "on" && <button type="button" className="btn2" style={{ height: 36 }} disabled={busy} onClick={disable}>Turn off</button>}
    </div>
  );
}
