"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription, hasPushSubscription } from "./actions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The app's service worker, or an error if it never becomes ready (e.g. opened outside the installed app). */
async function registration() {
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("The app's background worker isn't running. Close the app fully and open it again.")), 10000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

function toPayload(sub: PushSubscription) {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" };
}

/** Always a brand-new push address: an old one may already be dead at Google's end. */
async function freshSubscription(reg: ServiceWorkerRegistration) {
  const old = await reg.pushManager.getSubscription();
  if (old) {
    await removePushSubscription(old.endpoint).catch(() => {});
    await old.unsubscribe().catch(() => {});
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
}

/**
 * Turns phone reminders on or off for this device. "On" means the server has this phone saved,
 * not just that the phone thinks it is subscribed. If the server lost it, it re-subscribes quietly.
 */
export function PushSettings() {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      if (Notification.permission !== "granted") return setState("off");
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub && (await hasPushSubscription(sub.endpoint))) {
        // Keeps the saved time zone current when travelling.
        await savePushSubscription(toPayload(sub), tz(), navigator.userAgent);
        return setState("on");
      }
      // Permission is granted but the server doesn't have this phone: fix it without asking.
      const fresh = await freshSubscription(reg);
      const res = await savePushSubscription(toPayload(fresh), tz(), navigator.userAgent);
      if (res.error) { setMsg(`Couldn't save this phone: ${res.error}`); return setState("off"); }
      setMsg("Reconnected this phone.");
      setState("on");
    })().catch((e) => { setMsg(e instanceof Error ? e.message : null); setState("off"); });
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await registration();
      const sub = await freshSubscription(reg);
      const res = await savePushSubscription(toPayload(sub), tz(), navigator.userAgent);
      if (res.error) { setMsg(`Couldn't save this phone: ${res.error}`); return; }
      setState("on");
      await sendTest();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not turn on notifications.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not turn off notifications.");
    } finally { setBusy(false); }
  }

  /** Sends a real push from the server, the same way reminders go out. */
  async function sendTest() {
    setMsg("Sending a test…");
    const { data, error } = await createClient().functions.invoke("send-reminders", { body: { test: true } });
    if (error) return setMsg("Test failed: the server couldn't be reached.");
    if (data?.delivered > 0) return setMsg("Test sent. It should appear in your notifications now.");
    setMsg(data?.devices ? `Test failed: ${data.errors?.[0] ?? "push service refused it"}. Tap Turn off, then Turn on.` : "Test failed: this phone isn't saved. Tap Turn off, then Turn on.");
  }

  const note =
    state === "unsupported" ? "This browser can't receive notifications. Open the installed app on your phone."
    : state === "blocked" ? "Notifications are blocked for this app. Allow them in your phone's app settings, then come back."
    : state === "on" ? "On for this device."
    : state === "checking" ? "Checking…"
    : "Off for this device.";

  return (
    <div className="row" style={{ minHeight: 56, justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600 }}>Phone notifications</p>
        <p className="cap">{msg ?? note}</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {state === "on" && <button type="button" className="btn2" style={{ height: 36 }} disabled={busy} onClick={() => { setBusy(true); sendTest().finally(() => setBusy(false)); }}>Send test</button>}
        {state === "off" && <button type="button" className="btn small" disabled={busy} onClick={enable}>Turn on</button>}
        {state === "on" && <button type="button" className="btn2" style={{ height: 36 }} disabled={busy} onClick={disable}>Turn off</button>}
      </div>
    </div>
  );
}
