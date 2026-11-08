use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;

const API: &str = "https://generativelanguage.googleapis.com/v1beta";
// Used only if the model list cannot be read. The real model is chosen from the live list.
const FALLBACK_MODEL: &str = "gemini-flash-latest";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("Nertz", "gemini_api_key")
        .map_err(|_| "OTHER: Windows secure storage is unavailable.".to_string())
}

fn get_key() -> Result<String, String> {
    entry()?
        .get_password()
        .map_err(|_| "KEY: No Gemini API key saved. Add one in Settings.".to_string())
}

#[tauri::command]
fn save_key(key: String) -> Result<(), String> {
    let k = key.trim();
    if k.len() < 20 || k.chars().any(char::is_whitespace) {
        return Err("KEY: That does not look like a Gemini API key.".into());
    }
    entry()?
        .set_password(k)
        .map_err(|_| "OTHER: Could not store the key in Windows Credential Manager.".to_string())
}

#[tauri::command]
fn has_key() -> bool {
    get_key().is_ok()
}

#[tauri::command]
fn delete_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("OTHER: Could not remove the stored key.".to_string()),
    }
}

fn classify(status: u16, body: &str) -> String {
    let v: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let m = v["error"]["message"].as_str().unwrap_or("Unexpected response").to_string();
    let tag = match status {
        400 if m.contains("API key") => "KEY",
        401 => "KEY",
        403 => "PERM",
        404 => "MODEL",
        429 => "QUOTA",
        _ => "OTHER",
    };
    format!("{tag}: {m} (HTTP {status})")
}

// One request with bounded retries and exponential backoff for transient failures.
async fn send(url: String, key: &str, body: Option<Value>) -> Result<Value, String> {
    let c = reqwest::Client::builder()
        .timeout(Duration::from_secs(40))
        .connect_timeout(Duration::from_secs(8))
        .build()
        .map_err(|_| "OTHER: HTTP client error".to_string())?;
    let mut delay = 600u64;
    let mut last = String::new();
    for attempt in 0..3 {
        let rb = match &body {
            Some(b) => c.post(&url).json(b),
            None => c.get(&url),
        };
        let rb = rb.header("x-goog-api-key", key);
        match rb.send().await {
            Ok(r) => {
                let st = r.status().as_u16();
                let txt = r.text().await.unwrap_or_default();
                if st == 200 {
                    return serde_json::from_str(&txt)
                        .map_err(|_| "OTHER: Unreadable response from Gemini".to_string());
                }
                last = classify(st, &txt).replace(key, "[redacted]");
                if !(st == 429 || st >= 500) {
                    return Err(last);
                }
            }
            Err(e) => {
                last = if e.is_timeout() {
                    "NETWORK: Gemini timed out.".to_string()
                } else {
                    "NETWORK: Cannot reach Gemini.".to_string()
                };
            }
        }
        if attempt < 2 {
            tokio::time::sleep(Duration::from_millis(delay)).await;
            delay *= 3;
        }
    }
    Err(last)
}

async fn models_for(key: &str) -> Result<Vec<String>, String> {
    let v = send(format!("{API}/models?pageSize=200"), key, None).await?;
    let mut out: Vec<String> = v["models"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|m| {
                    m["supportedGenerationMethods"]
                        .as_array()
                        .map_or(false, |g| g.iter().any(|x| x.as_str() == Some("generateContent")))
                })
                .filter_map(|m| m["name"].as_str().map(|n| n.trim_start_matches("models/").to_string()))
                .collect()
        })
        .unwrap_or_default();
    out.retain(|n| {
        n.starts_with("gemini")
            && !["image", "tts", "live", "audio", "embedding", "robotics", "computer"]
                .iter()
                .any(|b| n.contains(b))
    });
    out.sort();
    out.reverse();
    Ok(out)
}

fn pick(models: &[String]) -> String {
    let flash: Vec<&String> = models.iter().filter(|n| n.contains("flash") && !n.contains("lite")).collect();
    flash
        .iter()
        .find(|n| !n.contains("preview") && !n.contains("exp"))
        .or(flash.first())
        .map(|s| s.to_string())
        .unwrap_or_else(|| FALLBACK_MODEL.to_string())
}

#[tauri::command]
async fn list_models() -> Result<Vec<String>, String> {
    models_for(&get_key()?).await
}

#[tauri::command]
async fn test_connection(model: Option<String>) -> Result<Value, String> {
    let key = get_key()?;
    let list = models_for(&key).await?;
    let chosen = match model.filter(|m| !m.is_empty()) {
        Some(m) => {
            if !list.contains(&m) {
                return Err(format!("MODEL: '{m}' is not available for this key."));
            }
            m
        }
        None => pick(&list),
    };
    Ok(json!({ "model": chosen, "count": list.len() }))
}

#[derive(Deserialize)]
struct Turn {
    role: String,
    text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Req {
    model: String,
    prompt: String,
    system: String,
    #[serde(default)]
    history: Vec<Turn>,
    image: Option<String>,
    image_mime: Option<String>,
    audio: Option<String>,
    #[serde(default)]
    json: bool,
}

#[tauri::command]
async fn gemini_ask(req: Req) -> Result<String, String> {
    let key = get_key()?;
    let model = if req.model.is_empty() { pick(&models_for(&key).await?) } else { req.model.clone() };
    if !model.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_') {
        return Err("MODEL: Invalid model name.".into());
    }
    let mut contents: Vec<Value> = req
        .history
        .iter()
        .map(|t| json!({ "role": if t.role == "user" { "user" } else { "model" }, "parts": [{ "text": t.text }] }))
        .collect();
    let mut parts: Vec<Value> = vec![];
    if let Some(a) = &req.audio {
        parts.push(json!({ "inlineData": { "mimeType": "audio/wav", "data": a } }));
    }
    if let Some(i) = &req.image {
        let mime = req.image_mime.clone().unwrap_or_else(|| "image/jpeg".to_string());
        parts.push(json!({ "inlineData": { "mimeType": mime, "data": i } }));
    }
    parts.push(json!({ "text": req.prompt }));
    contents.push(json!({ "role": "user", "parts": parts }));
    let mut body = json!({
        "systemInstruction": { "parts": [{ "text": req.system }] },
        "contents": contents,
        "generationConfig": { "temperature": 0.7, "maxOutputTokens": 2048 }
    });
    if req.json {
        body["generationConfig"]["responseMimeType"] = json!("application/json");
    }
    let v = send(format!("{API}/models/{model}:generateContent"), &key, Some(body)).await?;
    let text: String = v["candidates"][0]["content"]["parts"]
        .as_array()
        .map(|p| p.iter().filter_map(|x| x["text"].as_str()).collect::<Vec<_>>().join(""))
        .unwrap_or_default();
    if text.trim().is_empty() {
        return Err("OTHER: Gemini returned no answer (the request may have been blocked).".into());
    }
    Ok(text)
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn open_key_page() {
    let _ = std::process::Command::new("explorer.exe")
        .arg("https://aistudio.google.com/apikey")
        .spawn();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_key, has_key, delete_key, list_models, test_connection, gemini_ask, quit, open_key_page
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nertz");
}
