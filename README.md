# NERTZ — Windows x64 desktop assistant (Tauri 2)

Orb-first, voice-first assistant. Frontend: Three.js (procedural 3D orb). Backend: Rust. AI: Gemini.

## Build the installer on GitHub (no local setup)
1. Create a new GitHub repository and upload everything in this folder (keep `.github/workflows`).
2. Open the **Actions** tab, choose **Build Nertz (Windows x64)**, click **Run workflow**.
3. When it finishes (about 10–15 minutes the first time), open the run and download the **Nertz-Windows-x64** artifact.
4. Unzip it: `Nertz_0.1.0_x64-setup.exe` is the installer; `nertz.exe` is the portable build.
5. For a public release, push a tag such as `v0.1.0`; the installer is attached to the GitHub Release.

## Build locally (optional)
Requirements: Windows 10/11 x64, Node 20+, Rust stable (MSVC toolchain), Visual Studio Build Tools (C++), WebView2 runtime.
```
npm install
npm run tauri -- build --target x86_64-pc-windows-msvc
```
Dev mode: `npm run tauri dev`.

## First run
1. Click the glowing point. Open Settings (gear) → Gemini, paste your key from https://aistudio.google.com/apikey, then **Save & test**.
2. The key is stored in Windows Credential Manager, never in files or logs. There is no base-URL field.
3. Press Space to listen (microphone indicator on), or just start typing.

## Implemented
- Power-on sequence, 3D orb with a mechanical transformation into a tilted, layered holographic disc (dotted orbit, fine arc web, node filaments, faint floor grid), states (idle/listening/thinking/speaking/offline).
- Real microphone capture with level-driven ring pattern, silence detection, barge-in, no visible transcript.
  Each finished turn is sent to Gemini as audio (16 kHz WAV) and the reply is spoken.
- Gemini via official REST endpoint with timeouts, 3 attempts with backoff, classified errors (key / quota / model / permission / network).
  The model is chosen from the live model list (latest Flash); you can override it in Settings.
- Offline mode with truthful connection checks every 20 s; local time, date and calculations.
- Review mode for images (drop, paste or pick): orb moves bottom-left, structured facts/steps from Gemini, region click.
- Floating settings bubble; settings persist; fullscreen/windowed (F11); Ctrl+Q quits.

## Not implemented yet (be aware)
- Gemini **Live API** (bidirectional streaming audio) and streamed text responses. Current flow is turn-based.
- Gemini-generated voice; speech uses Windows voices (Web Speech). Output-device selection follows the Windows default.
- PDF/document review, screen capture, web search, file search, app launching, timers, tools bubble, M.E.L. equalizer, editable shortcuts, global hotkey, local model.
- Code signing: Windows SmartScreen will warn on unsigned installers ("More info" → "Run anyway").

## Troubleshooting
- No sound / odd voice: Windows Settings → Time & language → Speech → add voices; then pick one in Settings → Voice.
- Microphone blocked: Windows Settings → Privacy → Microphone → allow desktop apps.
- Echo or self-interruption: use headphones or turn off "Allow interruption".
- "Model not available": set Model back to Auto and press Save & test.
