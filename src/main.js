import "./style.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { S, save, off, $, cl } from "./orb.js";

const VERSION = "0.1.0";
const SYSTEM = "You are Nertz, a calm, intelligent, warm personal assistant with a composed, refined British-influenced manner. Address the user as sir only occasionally. Reply in one to three short spoken sentences unless detail is requested. Plain speech only: no markdown, lists, emoji or URLs. If audio is attached, answer what the speaker said. Never invent facts; say when you are unsure.";
const REVIEW = 'You are Nertz analysing an image for the user. Return ONLY JSON: {"spoken":"1-3 sentences to say aloud","summary":"what it is","observations":[],"facts":[],"steps":[],"warnings":[],"next":[]}. Observations must be directly visible; put inferences in facts and mark them uncertain. Use empty arrays when not applicable. Never invent details.';
const clean = (e) => String(e).replace(/^[A-Z]+:\s*/, "");
const tagOf = (e) => String(e).split(":")[0];

/* ---------- history (local, clearable) ---------- */
let hist = [];
try { hist = JSON.parse(localStorage.getItem("nertz.hist") || "[]"); } catch {}
const remember = (u, m) => { hist.push({ role: "user", text: u }, { role: "model", text: m }); hist = hist.slice(-50); try { localStorage.setItem("nertz.hist", JSON.stringify(hist)); } catch {} };

/* ---------- audio helpers ---------- */
let AC; const ctx = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
function tone() { if (S.cfg.mute) return; try { const a = ctx(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = "sine"; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(330, t + 1.8); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18 * S.cfg.vol, t + .8); g.gain.exponentialRampToValueAtTime(.001, t + 2.4); o.connect(g).connect(a.destination); o.start(t); o.stop(t + 2.5); } catch {} }
let typed = "", mt;
const msg = (t, ty) => { const m = $("#msg"); m.textContent = t; m.classList.toggle("ty", !!ty); };
const flash = (t, ms = 4000) => { msg(t); clearTimeout(mt); mt = setTimeout(() => { if (!typed) msg(""); }, ms); };
const setState = (s) => { S.state = s; };
const paint = () => { $("#lab").textContent = off() ? "OFFLINE / LOCAL MODE" : "ONLINE"; };

/* ---------- speech output ---------- */
S.sid = 0;
function say(t) {
  const id = ++S.sid;
  const live = !S.cfg.mute && S.cfg.vol > 0 && "speechSynthesis" in window;
  if (!live || S.cfg.cap) flash(t, 7000);
  if (!live) { setState("speaking"); setTimeout(() => { if (id === S.sid) { S.busy = false; setState(S.mic ? "listening" : "idle"); } }, Math.min(4000, 600 + t.length * 35)); return; }
  speechSynthesis.cancel();
  const parts = (t.replace(/Nertz/g, "Nerts").match(/[^.!?\n]+[.!?]*/g) || [t]).map((x) => x.trim()).filter(Boolean);
  const vs = speechSynthesis.getVoices(), en = vs.filter((v) => /^en/i.test(v.lang));
  const voice = vs.find((v) => v.name === S.cfg.voice) || en.find((v) => /david|daniel|george|ryan|guy|male/i.test(v.name)) || en.find((v) => /GB/.test(v.lang)) || null;
  let left = parts.length;
  parts.forEach((p) => {
    const u = new SpeechSynthesisUtterance(p); u.voice = voice; u.rate = S.cfg.rate; u.pitch = .85; u.volume = S.cfg.vol;
    u.onstart = () => { if (id === S.sid) setState("speaking"); };
    u.onboundary = () => { S.sp = .9; };
    u.onend = u.onerror = () => { if (id !== S.sid) return; if (--left <= 0) { S.busy = false; setState(S.mic ? "listening" : "idle"); } };
    speechSynthesis.speak(u);
  });
}

/* ---------- Gemini (via Rust backend; key lives in Windows Credential Manager) ---------- */
async function gem(prompt, o = {}) {
  return invoke("gemini_ask", { req: { model: S.rm || S.cfg.model || "", prompt, system: o.system || SYSTEM,
    history: o.review ? [] : hist.slice(-8), image: o.image?.b64 || null, imageMime: o.image?.mime || null, audio: o.audio || null, json: !!o.json } });
}
async function check() {
  try {
    if (!navigator.onLine) throw "NETWORK: No network connection.";
    if (!(await invoke("has_key"))) { S.nokey = true; throw "KEY: No Gemini API key saved."; }
    S.nokey = false;
    const r = await invoke("test_connection", { model: S.cfg.model || null });
    S.rm = r.model; S.fake = false; S.err = "";
  } catch (e) { S.fake = true; S.err = String(e); }
  paint(); return !off();
}
async function recheck() { const was = off(); await check(); const now = off(); if (S.on && was !== now) say(now ? "Nertz is offline. Local mode is active." : "Connection restored. Nertz is online."); }
function fail(e) {
  const t = tagOf(e); S.busy = false; setState(S.mic ? "listening" : "idle");
  if (t === "NETWORK") { S.fake = true; paint(); }
  say(t === "NETWORK" ? "I have lost the connection, sir." : t === "QUOTA" ? "The Gemini quota has been reached." : t === "KEY" ? "The Gemini key was rejected." : t === "MODEL" ? "That Gemini model is not available." : "I could not complete that request.");
  flash(clean(e), 8000);
}

/* ---------- local commands (work offline) ---------- */
function calc(s) {
  let i = 0; const ws = () => { while (s[i] === " ") i++; };
  const num = () => { ws(); if (s[i] === "(") { i++; const v = add(); ws(); i++; return v; } if (s[i] === "-") { i++; return -num(); } const m = /^\d*\.?\d+/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return +m[0]; };
  const pow = () => { let v = num(); ws(); if (s[i] === "^") { i++; v = v ** pow(); } return v; };
  const mul = () => { let v = pow(); for (;;) { ws(); const c = s[i]; if (c === "*" || c === "/" || c === "%") { i++; const r = pow(); v = c === "*" ? v * r : c === "/" ? v / r : v % r; } else return v; } };
  const add = () => { let v = mul(); for (;;) { ws(); const c = s[i]; if (c === "+" || c === "-") { i++; const r = mul(); v = c === "+" ? v + r : v - r; } else return v; } };
  const r = add(); ws(); if (i < s.length) throw 0; return r;
}
function local(q) {
  const l = q.toLowerCase().trim();
  if (/\bwhat('?s| is) (the )?time\b|\bwhat time\b/.test(l)) return "It is " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ", sir.";
  if (/\bwhat('?s| is) (the |today'?s )?(date|day)\b|\btoday'?s date\b/.test(l)) return "Today is " + new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) + ".";
  const ex = l.replace(/^(what is|what's|calculate|compute)\s*/, "").replace(/\bx\b|×/g, "*").replace(/÷/g, "/").replace(/\bplus\b/g, "+").replace(/\bminus\b/g, "-").replace(/\btimes\b/g, "*").replace(/\bdivided by\b/g, "/").replace(/\?$/, "");
  if (/^[\d\s+\-*/().%^]+$/.test(ex) && /\d/.test(ex)) { try { const r = calc(ex); if (isFinite(r)) return "That comes to " + Math.round(r * 1e6) / 1e6 + "."; } catch {} }
  if (/\b(open|start) (a |the )?(review|photo|image)|review (a |this )?(photo|image)/.test(l)) { setTimeout(() => $("#fi").click(), 300); return "Select an image and I will open the review workspace."; }
  if (/\bsettings?\b/.test(l)) { setSet(true); return "Settings are open."; }
  if (/\btransform\b/.test(l)) { toggleT(); return "Transforming."; }
  return null;
}
async function ask(q, audio) {
  S.busy = true; setState("thinking");
  if (!audio) { const r = local(q); if (r) { setTimeout(() => say(r), 400); return; } }
  if (off()) { say(audio ? "Voice questions need the Gemini connection, sir." : "I am offline. I can manage the time, date, calculations, review and settings."); return; }
  try {
    const o = IMG ? { image: IMG, json: true, system: REVIEW, review: true } : {};
    const txt = await gem(audio ? "Respond to what the user just said." : q, { ...o, audio });
    if (IMG) { let j = null; try { j = JSON.parse(txt); } catch {} if (j) { panel(j); remember(q || "(voice)", j.spoken || j.summary || ""); say(j.spoken || j.summary || "Analysis complete."); return; } }
    remember(q || "(voice)", txt); say(txt);
  } catch (e) { fail(e); }
}

/* ---------- microphone: real capture, VAD, barge-in, no transcript ---------- */
const fresh = () => ({ voiced: false, last: 0, pre: [], chunks: [], t0: 0, idle: performance.now() });
let vs = fresh();
function wavB64(ch, sr) {
  let n = 0; ch.forEach((c) => (n += c.length)); const f = new Float32Array(n); let o = 0; ch.forEach((c) => { f.set(c, o); o += c.length; });
  const r = sr / 16000, m = Math.floor(n / r), b = new DataView(new ArrayBuffer(44 + m * 2)), w = (p, s) => [...s].forEach((c, i) => b.setUint8(p + i, c.charCodeAt(0)));
  w(0, "RIFF"); b.setUint32(4, 36 + m * 2, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, "data"); b.setUint32(40, m * 2, true);
  for (let i = 0; i < m; i++) { const s = cl(f[Math.floor(i * r)], -1, 1); b.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); }
  const u = new Uint8Array(b.buffer); let s = ""; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s);
}
function proc(e) {
  const sp = S.state === "speaking";
  if (S.state === "thinking" || (sp && !S.cfg.barge)) { vs.idle = performance.now(); return; }
  const d = e.inputBuffer.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  const rms = Math.sqrt(s / d.length), thr = S.cfg.vad * (sp ? 3 : 1), now = performance.now(), c = new Float32Array(d);
  if (rms > thr) {
    if (sp) { speechSynthesis.cancel(); S.sid++; S.busy = false; setState("listening"); }
    if (!vs.voiced) { vs.voiced = true; vs.chunks = vs.pre.slice(); vs.t0 = now; } vs.last = now;
  }
  if (vs.voiced) {
    vs.chunks.push(c);
    if (now - vs.last > 1100) { const dur = vs.last - vs.t0, ch = vs.chunks; vs = fresh(); if (dur > 250) ask("", wavB64(ch, ctx().sampleRate)); }
  } else {
    vs.pre.push(c); if (vs.pre.length > 3) vs.pre.shift();
    if (sp) vs.idle = now; else if (now - vs.idle > S.cfg.timeout * 1000) { stopMic(); flash("Listening timed out.", 2500); }
  }
}
async function mic() {
  if (!S.on) return; if (S.mic) { stopMic(); return; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: S.cfg.micId ? { exact: S.cfg.micId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const a = ctx(); await a.resume(); const an = a.createAnalyser(); an.fftSize = 256; const src = a.createMediaStreamSource(st); src.connect(an);
    const pr = a.createScriptProcessor(4096, 1, 1); pr.onaudioprocess = proc; src.connect(pr); pr.connect(a.destination);
    speechSynthesis.cancel(); S.sid++; vs = fresh(); S.mic = { st, an, pr, src, d: new Uint8Array(128) }; setState("listening"); $("#bm").classList.add("on"); flash("Microphone active", 1800); devices();
  } catch (e) { flash("Microphone unavailable: " + (e.name || "error") + ". Check Windows microphone privacy settings."); }
}
function stopMic() {
  if (!S.mic) return; S.mic.pr.onaudioprocess = null; S.mic.pr.disconnect(); S.mic.src.disconnect(); S.mic.st.getTracks().forEach((t) => t.stop()); S.mic = null; $("#bm").classList.remove("on");
  if (S.state === "listening") setState("idle");
}

/* ---------- window, keys ---------- */
const win = getCurrentWindow();
const setFs = (v) => { S.cfg.fs = v; save(); win.setFullscreen(v).catch(() => {}); };
let qc = false;
async function quit() { stopMic(); speechSynthesis.cancel(); await invoke("quit"); }
addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "q") { e.preventDefault(); const busy = ["thinking", "speaking"].includes(S.state); if (busy && !qc) { qc = true; flash("A task is running. Press Ctrl+Q again to quit.", 2500); setTimeout(() => (qc = false), 2500); return; } quit(); return; }
  if (e.key === "F11") { e.preventDefault(); setFs(!S.cfg.fs); return; }
  if (!S.on || e.target.matches("input,textarea,select")) return;
  if (e.key === "Escape") { if ($("#set").classList.contains("o")) setSet(false); else if (typed) { typed = ""; msg(""); } else if (S.reviewing) closeRv(); return; }
  if (e.key === "Enter" && typed) { const q = typed; typed = ""; msg(""); ask(q); return; }
  if (e.key === "Backspace" && typed) { typed = typed.slice(0, -1); msg(typed, 1); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  if (!typed && e.key === " ") { e.preventDefault(); mic(); return; }
  if (!typed && /[trs]/i.test(e.key)) { const k = e.key.toLowerCase(); if (k === "t") toggleT(); if (k === "r") $("#fi").click(); if (k === "s") setSet(!$("#set").classList.contains("o")); return; }
  typed += e.key; msg(typed, 1);
});
function toggleT(replay) { if (replay) { S.p = 0; S.tt = 1; } else S.tt = S.tt ? 0 : 1; setSet(false); }

/* ---------- settings bubble ---------- */
const el = (t, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); e.append(...k); return e; };
const st = $("#set");
const H = (t) => st.append(el("h3", { textContent: t }));
const Pp = (t) => st.append(el("p", { textContent: t }));
const Bt = (t, f) => el("button", { textContent: t, onclick: f });
const Cb = (k, t, cb) => { const i = el("input", { type: "checkbox", checked: !!S.cfg[k], onchange: () => { S.cfg[k] = i.checked; save(); cb && cb(i.checked); } }); st.append(el("label", {}, el("span", { textContent: t }), i)); };
const Rg = (k, t, a, b, s) => { const i = el("input", { type: "range", min: a, max: b, step: s, value: S.cfg[k], oninput: () => { S.cfg[k] = +i.value; save(); } }); st.append(el("label", {}, el("span", { textContent: t }), i)); };
const Sel = (t, sel) => st.append(el("label", {}, el("span", { textContent: t }), sel));

H("GENERAL");
Cb("greet", "Startup greeting"); Cb("fs", "Fullscreen (F11)", setFs); Cb("cap", "Show written answers");
st.append(el("div", { className: "row" }, Bt("Replay transformation", () => toggleT(true))));

H("GEMINI");
const kin = el("input", { type: "password", placeholder: "Paste Gemini API key", autocomplete: "off", spellcheck: false });
const kst = el("p", { textContent: "" });
const show = Bt("Show", () => { kin.type = kin.type === "password" ? "text" : "password"; show.textContent = kin.type === "password" ? "Show" : "Hide"; });
const msel = el("select", { onchange: () => { S.cfg.model = msel.value; save(); recheck(); } });
async function models() { try { const l = await invoke("list_models"); msel.replaceChildren(el("option", { value: "", textContent: "Auto (latest Flash)" }), ...l.map((m) => el("option", { value: m, textContent: m }))); msel.value = S.cfg.model || ""; } catch {} }
const sv = Bt("Save & test", async () => {
  kst.textContent = "Testing…";
  try { if (kin.value.trim()) await invoke("save_key", { key: kin.value }); kin.value = ""; await check(); kst.textContent = off() ? clean(S.err) : "Connected. Model: " + S.rm; if (!off()) models(); }
  catch (e) { kst.textContent = clean(e); }
});
const rm = Bt("Remove key", async () => { try { await invoke("delete_key"); } catch {} S.fake = true; S.rm = ""; S.err = "KEY: No Gemini API key saved."; paint(); kst.textContent = "Key removed."; });
st.append(kin, el("div", { className: "row" }, show, sv, rm), kst);
Sel("Model", msel);
st.append(el("div", { className: "row" }, Bt("Get a key (Google AI Studio)", () => invoke("open_key_page"))));

H("VOICE");
const vsel = el("select", { onchange: () => { S.cfg.voice = vsel.value; save(); } });
const fillVoices = () => { const v = speechSynthesis.getVoices(); vsel.replaceChildren(el("option", { value: "", textContent: "Auto (male English)" }), ...v.map((x) => el("option", { value: x.name, textContent: x.name }))); vsel.value = S.cfg.voice || ""; };
if ("speechSynthesis" in window) { fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; }
Sel("Voice", vsel); Rg("vol", "Volume", 0, 1, .05); Rg("rate", "Speech rate", .6, 1.4, .05); Cb("mute", "Mute", (m) => { if (m) { speechSynthesis.cancel(); S.sid++; } });
Cb("barge", "Allow interruption (use headphones)");
st.append(el("div", { className: "row" }, Bt("Stop speaking", () => { speechSynthesis.cancel(); S.sid++; S.busy = false; setState(S.mic ? "listening" : "idle"); })));

H("MICROPHONE");
const dsel = el("select", { onchange: () => { S.cfg.micId = dsel.value; save(); if (S.mic) { stopMic(); mic(); } } });
async function devices() { try { const d = (await navigator.mediaDevices.enumerateDevices()).filter((x) => x.kind === "audioinput"); dsel.replaceChildren(el("option", { value: "", textContent: "System default" }), ...d.map((x) => el("option", { value: x.deviceId, textContent: x.label || "Microphone" }))); dsel.value = S.cfg.micId || ""; } catch {} }
Sel("Input device", dsel); Rg("vad", "Voice sensitivity (threshold)", .01, .15, .005); Rg("timeout", "Listening timeout (s)", 10, 120, 5);
Pp("Audio output follows the Windows default device.");

H("APPEARANCE");
Rg("bright", "Orb brightness", .3, 1.4, .05); Rg("anim", "Animation intensity", .3, 2, .05); Rg("glow", "Core glow", .4, 2, .05);

H("OFFLINE");
{ const i = el("input", { type: "checkbox", onchange: () => { const was = off(); S.sim = i.checked; paint(); if (was !== off()) say(off() ? "Nertz is offline. Local mode is active." : "Connection restored. Nertz is online."); } }); st.append(el("label", {}, el("span", { textContent: "Simulate offline (test)" }), i)); }
Pp("Works offline: time and date, calculations, image review workspace, settings. Gemini answers and voice questions need a connection. No local model is configured.");

H("PRIVACY");
Pp("Your key is stored in Windows Credential Manager. Audio is only captured while the microphone indicator is on, and sent to Gemini one finished turn at a time.");
st.append(el("div", { className: "row" }, Bt("Clear history", () => { hist = []; localStorage.removeItem("nertz.hist"); flash("History cleared."); }), Bt("Clear all local data", async () => { try { await invoke("delete_key"); } catch {} localStorage.clear(); location.reload(); })));

H("SHORTCUTS");
Pp("Space listen · T transform · R review · S settings · F11 fullscreen · Esc close/clear · Ctrl+Q quit. Shortcuts are fixed in this version.");

H("ABOUT");
Pp("Nertz " + VERSION);
st.append(el("div", { className: "row" }, Bt("Copy diagnostics", () => navigator.clipboard.writeText(["Nertz " + VERSION, "online=" + !off(), "model=" + (S.rm || "none"), "lastError=" + clean(S.err || "none"), navigator.userAgent].join("\n")))));
st.append(el("button", { id: "x", textContent: "✕", "aria-label": "Close", onclick: () => setSet(false) }));
function setSet(o) { st.classList.toggle("o", o); $("#bs").classList.toggle("on", o); if (o) devices(); }
$("#bs").onclick = () => setSet(!st.classList.contains("o")); $("#bm").onclick = mic; $("#bt").onclick = () => toggleT(); $("#br").onclick = () => $("#fi").click();
document.addEventListener("pointerdown", (e) => { if (st.classList.contains("o") && !st.contains(e.target) && !$("#dock").contains(e.target)) setSet(false); });

/* ---------- review mode ---------- */
const im = $("#im"), mk = $("#mk"), fi = $("#fi"); let IMG = null, meta = {}, zoom = 1;
function prep(f) { return new Promise((res, rej) => { const u = URL.createObjectURL(f), i = new Image(); i.onerror = rej; i.onload = () => { const k = Math.min(1, 1600 / Math.max(i.naturalWidth, i.naturalHeight)), c = document.createElement("canvas"); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); const x = c.getContext("2d"); x.drawImage(i, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, 8, 8).data; res({ url: u, b64: c.toDataURL("image/jpeg", .85).split(",")[1], mime: "image/jpeg", w: i.naturalWidth, h: i.naturalHeight }); }; i.src = u; }); }
function section(t, items, ol) { const i = $("#info"); if (!items || !items.length) return; i.append(el("h4", { textContent: t })); const l = el(ol ? "ol" : "div"); items.forEach((x) => l.append(el(ol ? "li" : "p", { textContent: String(x) }))); i.append(l); }
function info(reg) { $("#info").replaceChildren(); section("WHAT IT IS", ["Image file: " + meta.name]); section("MEASURED LOCALLY", [meta.w + " × " + meta.h + " px, " + meta.kb + " KB"]); if (reg) section("SELECTED REGION", ["Centre at " + reg.x + "% across, " + reg.y + "% down"]); if (off()) section("LIMITS", ["Offline: identifying content needs Gemini."]); }
function panel(j) { $("#info").replaceChildren(); section("WHAT IT IS", [j.summary]); section("OBSERVATIONS", j.observations); section("FACTS AND CONTEXT", j.facts); section("STEPS", j.steps, true); section("WARNINGS", j.warnings); section("NEXT", j.next); }
async function openFile(f) {
  if (!f || !/^image\//.test(f.type)) { flash("Review accepts image files in this version."); return; }
  try { const p = await prep(f); IMG = p; meta = { name: f.name, kb: Math.round(f.size / 1024), w: p.w, h: p.h }; } catch { flash("That image could not be read."); return; }
  im.src = IMG.url; zoom = 1; $("#wrap").style.transform = ""; mk.style.display = "none"; S.reviewing = true; $("#rv").classList.add("o"); setSet(false); info();
  if (off()) say("Image loaded. Detailed analysis needs the Gemini connection."); else ask("Identify what this is and explain the important details.");
}
fi.onchange = () => { openFile(fi.files[0]); fi.value = ""; };
im.onclick = (e) => { const b = im.getBoundingClientRect(), x = Math.round(((e.clientX - b.left) / b.width) * 100), y = Math.round(((e.clientY - b.top) / b.height) * 100); mk.style.cssText = "display:block;left:" + x + "%;top:" + y + "%"; info({ x, y }); if (!off()) ask("Explain the part of the image centred about " + x + "% from the left and " + y + "% from the top. Say what it is and any steps if relevant."); };
$("#stage").addEventListener("wheel", (e) => { e.preventDefault(); zoom = cl(zoom * (e.deltaY < 0 ? 1.1 : .91), 1, 6); $("#wrap").style.transform = "scale(" + zoom + ")"; }, { passive: false });
function closeRv() { S.reviewing = false; IMG = null; $("#rv").classList.remove("o"); speechSynthesis.cancel(); S.sid++; S.busy = false; setState(S.mic ? "listening" : "idle"); }
$("#back").onclick = closeRv;
addEventListener("dragover", (e) => e.preventDefault()); addEventListener("drop", (e) => { e.preventDefault(); if (S.on) openFile(e.dataTransfer.files[0]); });
addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])][0]; if (S.on && f) openFile(f); });

/* ---------- connectivity + power-on ---------- */
setInterval(() => { if (S.on && !S.busy && !S.sim) recheck(); }, 20000);
addEventListener("online", () => S.on && recheck()); addEventListener("offline", () => S.on && recheck());
paint();
if (!S.cfg.fs) win.setFullscreen(false).catch(() => {});
$("#pw").onclick = async () => {
  $("#pw").remove(); $("#pwt").remove(); await ctx().resume(); S.on = true; tone();
  await Promise.all([check(), new Promise((r) => setTimeout(r, 3000))]);
  $("#dock").hidden = false; models();
  if (S.cfg.greet) say(off() ? "Hello, sir. Nertz is offline. Local mode is active." : "Hello, sir. Nertz is online.");
  if (S.nokey) setTimeout(() => flash("Add your Gemini API key in Settings to go online.", 9000), 2500);
};
$("#dock").hidden = true;
