use std::io::Write;
use std::path::Path;
use std::str::FromStr;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use tauri::Manager;

fn write_log(message: &str) -> Result<(), String> {
    let file_path = std::env::temp_dir().join("weiguang-writer-startup.log");
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(file_path)
        .map_err(|error| error.to_string())?;
    writeln!(file, "{}", message).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_diagnostic_log(app: tauri::AppHandle, message: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    std::fs::write(dir.join("diagnostics.log"), &message).map_err(|error| error.to_string())?;
    write_log(&format!("frontend: {message}"))
}

fn copy_missing_tree(source: &std::path::Path, target: &std::path::Path) -> Result<(), String> {
    if !source.exists() { return Ok(()); }
    std::fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in std::fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_missing_tree(&source_path, &target_path)?;
        } else if !target_path.exists() {
            std::fs::copy(&source_path, &target_path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn database_has_projects(path: &Path) -> bool {
    if !path.exists() { return false; }
    let normalized = path.to_string_lossy().replace('\\', "/");
    let url = format!("sqlite:///{}", normalized.trim_start_matches('/'));
    let options = match SqliteConnectOptions::from_str(&url) {
        Ok(options) => options.create_if_missing(false),
        Err(_) => return false,
    };
    tauri::async_runtime::block_on(async {
        let pool = match SqlitePool::connect_with(options).await {
            Ok(pool) => pool,
            Err(_) => return false,
        };
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM projects")
            .fetch_one(&pool)
            .await
            .unwrap_or(0);
        pool.close().await;
        count > 0
    })
}

fn backup_before_legacy_migration(target_db: &Path) {
    if !target_db.exists() { return; }
    let Some(parent) = target_db.parent() else { return; };
    let backups = parent.join("backups");
    if std::fs::create_dir_all(&backups).is_err() { return; }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let backup = backups.join(format!("pre-migration-{stamp}.db"));
    let _ = std::fs::copy(target_db, backup);
}

fn migrate_legacy_app_data(app: &tauri::AppHandle) {
    let target = match app.path().app_data_dir() {
        Ok(path) => path,
        Err(_) => return,
    };
    let legacy = match std::env::current_exe().ok().and_then(|path| path.parent().map(|parent| parent.join("app-data"))) {
        Some(path) => path,
        None => return,
    };
    if legacy != target && legacy.exists() {
        let _ = copy_missing_tree(&legacy, &target);
        let target_db = target.join("changye-writer.db");
        let legacy_db = legacy.join("changye-writer.db");
        if database_has_projects(&legacy_db) && !database_has_projects(&target_db) {
            backup_before_legacy_migration(&target_db);
            let _ = std::fs::remove_file(target.join("changye-writer.db-wal"));
            let _ = std::fs::remove_file(target.join("changye-writer.db-shm"));
            if std::fs::copy(&legacy_db, &target_db).is_ok() {
                for suffix in ["-wal", "-shm"] {
                    let source = legacy.join(format!("changye-writer.db{suffix}"));
                    let destination = target.join(format!("changye-writer.db{suffix}"));
                    if source.exists() {
                        let _ = std::fs::copy(source, destination);
                    }
                }
            }
        }
    }
}

fn ai_secret_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("ai-credentials.bin"))
}

#[cfg(target_os = "windows")]
fn protect_secret(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use std::ffi::c_void;
    use std::ptr;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let ok = unsafe {
        CryptProtectData(
            &input,
            ptr::null(),
            ptr::null(),
            ptr::null::<c_void>(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 { return Err(std::io::Error::last_os_error().to_string()); }
    let result = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as *mut c_void); }
    Ok(result)
}

#[cfg(target_os = "windows")]
fn unprotect_secret(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use std::ffi::c_void;
    use std::ptr;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            ptr::null_mut(),
            ptr::null(),
            ptr::null::<c_void>(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 { return Err(std::io::Error::last_os_error().to_string()); }
    let result = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as *mut c_void); }
    Ok(result)
}

#[cfg(not(target_os = "windows"))]
fn protect_secret(_bytes: &[u8]) -> Result<Vec<u8>, String> { Err("安全存储当前仅支持 Windows".to_string()) }

#[cfg(not(target_os = "windows"))]
fn unprotect_secret(_bytes: &[u8]) -> Result<Vec<u8>, String> { Err("安全存储当前仅支持 Windows".to_string()) }

#[tauri::command]
fn save_ai_secret(app: tauri::AppHandle, secret: String) -> Result<(), String> {
    if secret.trim().is_empty() { return Err("API Key 不能为空".to_string()); }
    let encrypted = protect_secret(secret.trim().as_bytes())?;
    std::fs::write(ai_secret_path(&app)?, encrypted).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_ai_secret(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = ai_secret_path(&app)?;
    if !path.exists() { return Ok(None); }
    let encrypted = std::fs::read(path).map_err(|error| error.to_string())?;
    let bytes = unprotect_secret(&encrypted)?;
    String::from_utf8(bytes).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
fn ai_secret_status(app: tauri::AppHandle) -> Result<bool, String> { Ok(ai_secret_path(&app)?.exists()) }

#[tauri::command]
fn clear_ai_secret(app: tauri::AppHandle) -> Result<(), String> {
    let path = ai_secret_path(&app)?;
    if path.exists() { std::fs::remove_file(path).map_err(|error| error.to_string())?; }
    Ok(())
}

#[tauri::command]
fn prepare_database_backup(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?.join("backups");
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(dir.join(format!("changye-writer-{stamp}.db")).to_string_lossy().to_string())
}

#[tauri::command]
fn prune_database_backups(app: tauri::AppHandle, keep: usize) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?.join("backups");
    if !dir.exists() { return Ok(()); }
    let mut files: Vec<_> = std::fs::read_dir(&dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|value| value.to_str()) == Some("db"))
        .collect();
    files.sort_by_key(|entry| entry.metadata().and_then(|meta| meta.modified()).ok());
    files.reverse();
    for entry in files.into_iter().skip(keep) {
        let _ = std::fs::remove_file(entry.path());
    }
    Ok(())
}

#[derive(Debug, serde::Deserialize)]
struct AiHttpRequest {
    request_id: String,
    url: String,
    body: String,
    api_key: String,
    timeout_ms: u32,
}

#[derive(Clone, serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum AiHttpEvent {
    Status { status: u16 },
    Chunk { data: Vec<u8> },
    Complete,
}

#[derive(serde::Serialize)]
struct AiHttpResult {
    status: u16,
    body: String,
}

static AI_HTTP_CANCELLATIONS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>>> = std::sync::OnceLock::new();

fn ai_http_cancellations() -> &'static std::sync::Mutex<std::collections::HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>> {
    AI_HTTP_CANCELLATIONS.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

#[tauri::command]
fn cancel_ai_http(request_id: String) -> Result<(), String> {
    let flags = ai_http_cancellations().lock().map_err(|_| "取消请求时发生内部错误".to_string())?;
    if let Some(flag) = flags.get(&request_id) {
        flag.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    Ok(())
}


#[cfg(target_os = "windows")]
fn parse_http_url(url: &str) -> Result<(bool, String, u16, String), String> {
    if url.contains('\r') || url.contains('\n') {
        return Err("模型接口地址包含非法换行符".to_string());
    }
    let (scheme, remainder) = url.split_once("://").ok_or_else(|| "模型接口地址必须以 http:// 或 https:// 开头".to_string())?;
    let secure = match scheme.to_ascii_lowercase().as_str() {
        "https" => true,
        "http" => false,
        _ => return Err("模型接口地址只支持 HTTP 或 HTTPS".to_string()),
    };
    let (authority, path) = match remainder.find(['/', '?']) {
        Some(index) => (&remainder[..index], &remainder[index..]),
        None => (remainder, "/"),
    };
    if authority.is_empty() || authority.contains('@') {
        return Err("模型接口地址格式不正确".to_string());
    }
    let (host, port) = if let Some(rest) = authority.strip_prefix('[') {
        let end = rest.find(']').ok_or_else(|| "IPv6 地址格式不正确".to_string())?;
        let host = &rest[..end];
        let port = rest[end + 1..].strip_prefix(':').map(|value| value.parse::<u16>()).transpose().map_err(|_| "端口格式不正确".to_string())?;
        (host.to_string(), port)
    } else if let Some((host, port)) = authority.rsplit_once(':') {
        if port.chars().all(|character| character.is_ascii_digit()) {
            (host.to_string(), Some(port.parse::<u16>().map_err(|_| "端口格式不正确".to_string())?))
        } else {
            (authority.to_string(), None)
        }
    } else {
        (authority.to_string(), None)
    };
    if host.is_empty() {
        return Err("模型接口地址缺少主机名".to_string());
    }
    let request_path = if path.starts_with('/') { path.to_string() } else { format!("/{path}") };
    Ok((secure, host, port.unwrap_or(if secure { 443 } else { 80 }), request_path))
}


#[cfg(target_os = "windows")]
fn perform_ai_http(request: AiHttpRequest, channel: tauri::ipc::Channel<AiHttpEvent>, cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<AiHttpResult, String> {
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;
    use windows_sys::Win32::Networking::WinHttp::{
        WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryHeaders,
        WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest, WinHttpSetTimeouts,
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_FLAG_SECURE, WINHTTP_QUERY_FLAG_NUMBER,
        WINHTTP_QUERY_STATUS_CODE,
    };

    struct WinHandle(*mut c_void);
    impl Drop for WinHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe { WinHttpCloseHandle(self.0); }
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
    }

    if request.api_key.contains('\r') || request.api_key.contains('\n') {
        return Err("API Key 包含非法换行符".to_string());
    }
    let (secure, host, port, path) = parse_http_url(&request.url)?;
    let agent = wide("WeiguangWriter/0.2");
    let session_raw = unsafe {
        WinHttpOpen(agent.as_ptr(), WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, ptr::null(), ptr::null(), 0)
    };
    if session_raw.is_null() { return Err(format!("初始化网络请求失败：{}", std::io::Error::last_os_error())); }
    let session = WinHandle(session_raw);
    let timeout = request.timeout_ms.clamp(10_000, 300_000) as i32;
    unsafe { WinHttpSetTimeouts(session.0, timeout, timeout, timeout, timeout); }

    let host_wide = wide(&host);
    let connect_raw = unsafe { WinHttpConnect(session.0, host_wide.as_ptr(), port, 0) };
    if connect_raw.is_null() { return Err(format!("连接模型服务失败：{}", std::io::Error::last_os_error())); }
    let connect = WinHandle(connect_raw);
    let verb = wide("POST");
    let path_wide = wide(&path);
    let request_raw = unsafe {
        WinHttpOpenRequest(
            connect.0,
            verb.as_ptr(),
            path_wide.as_ptr(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            if secure { WINHTTP_FLAG_SECURE } else { 0 },
        )
    };
    if request_raw.is_null() { return Err(format!("创建网络请求失败：{}", std::io::Error::last_os_error())); }
    let request_handle = WinHandle(request_raw);

    let authorization = if request.api_key.is_empty() { String::new() } else { format!("Authorization: Bearer {}\r\n", request.api_key) };
    let headers = wide(&format!("Content-Type: application/json; charset=utf-8\r\nAccept: text/event-stream, application/json\r\n{authorization}"));
    let body = request.body.as_bytes();
    let sent = unsafe {
        WinHttpSendRequest(
            request_handle.0,
            headers.as_ptr(),
            u32::MAX,
            body.as_ptr() as *const c_void,
            body.len() as u32,
            body.len() as u32,
            0,
        )
    };
    if sent == 0 { return Err(format!("发送模型请求失败：{}", std::io::Error::last_os_error())); }


    if cancelled.load(std::sync::atomic::Ordering::SeqCst) { return Err("请求已取消".to_string()); }
    let received = unsafe { WinHttpReceiveResponse(request_handle.0, ptr::null_mut()) };
    if received == 0 {
        if cancelled.load(std::sync::atomic::Ordering::SeqCst) { return Err("请求已取消".to_string()); }
        return Err(format!("等待模型响应失败：{}", std::io::Error::last_os_error()));
    }
    let mut status: u32 = 0;
    let mut status_size = std::mem::size_of::<u32>() as u32;
    let mut header_index: u32 = 0;
    let status_ok = unsafe {
        WinHttpQueryHeaders(
            request_handle.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            ptr::null(),
            &mut status as *mut u32 as *mut c_void,
            &mut status_size,
            &mut header_index,
        )
    };
    if status_ok == 0 { return Err(format!("读取模型响应状态失败：{}", std::io::Error::last_os_error())); }
    channel.send(AiHttpEvent::Status { status: status as u16 }).map_err(|error| error.to_string())?;

    let mut body_bytes = Vec::with_capacity(4096);
    let mut buffer = [0u8; 8192];
    loop {
        if cancelled.load(std::sync::atomic::Ordering::SeqCst) { return Err("请求已取消".to_string()); }
        let mut read: u32 = 0;
        let ok = unsafe {
            WinHttpReadData(request_handle.0, buffer.as_mut_ptr() as *mut c_void, buffer.len() as u32, &mut read)
        };
        if ok == 0 {
            if cancelled.load(std::sync::atomic::Ordering::SeqCst) { return Err("请求已取消".to_string()); }
            return Err(format!("读取模型响应失败：{}", std::io::Error::last_os_error()));
        }
        if read == 0 { break; }
        if body_bytes.len() + read as usize > 64 * 1024 * 1024 {
            return Err("模型响应超过 64 MB 限制".to_string());
        }
        let chunk = buffer[..read as usize].to_vec();
        body_bytes.extend_from_slice(&chunk);
        channel.send(AiHttpEvent::Chunk { data: chunk }).map_err(|error| error.to_string())?;
    }
    channel.send(AiHttpEvent::Complete).map_err(|error| error.to_string())?;
    Ok(AiHttpResult { status: status as u16, body: String::from_utf8_lossy(&body_bytes).to_string() })
}

#[cfg(not(target_os = "windows"))]
fn perform_ai_http(_request: AiHttpRequest, _channel: tauri::ipc::Channel<AiHttpEvent>, _cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<AiHttpResult, String> {
    Err("模型网络桥当前仅支持 Windows".to_string())
}

#[tauri::command]
async fn ai_http_request(request: AiHttpRequest, on_event: tauri::ipc::Channel<AiHttpEvent>) -> Result<AiHttpResult, String> {
    let request_id = request.request_id.clone();
    let cancelled = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    ai_http_cancellations()
        .lock()
        .map_err(|_| "初始化网络请求时发生内部错误".to_string())?
        .insert(request_id.clone(), cancelled.clone());
    let task = tauri::async_runtime::spawn_blocking(move || perform_ai_http(request, on_event, cancelled)).await;
    if let Ok(mut flags) = ai_http_cancellations().lock() {
        flags.remove(&request_id);
    }
    task.map_err(|error| error.to_string())?
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = write_log("run: entered");
    std::panic::set_hook(Box::new(|info| {
        let _ = write_log(&format!("panic: {info}"));
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            migrate_legacy_app_data(app.handle());
            let app_data = app.path().app_data_dir().map(|path| path.display().to_string()).unwrap_or_else(|_| "unavailable".to_string());
            let _ = write_log(&format!("setup: app_data={app_data}"));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![write_diagnostic_log, save_ai_secret, load_ai_secret, ai_secret_status, clear_ai_secret, prepare_database_backup, prune_database_backups, ai_http_request, cancel_ai_http])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[cfg(test)]
mod path_tests {
    use std::str::FromStr;

    #[cfg(target_os = "windows")]
    #[test]
    fn native_http_url_parser_handles_https_and_local_ports() {
        let (secure, host, port, path) = super::parse_http_url("https://api.example.com/v1/chat/completions?q=1").unwrap();
        assert!(secure);
        assert_eq!(host, "api.example.com");
        assert_eq!(port, 443);
        assert_eq!(path, "/v1/chat/completions?q=1");

        let (secure, host, port, path) = super::parse_http_url("http://127.0.0.1:11434/v1").unwrap();
        assert!(!secure);
        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 11434);
        assert_eq!(path, "/v1");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn native_http_bridge_posts_to_local_openai_compatible_endpoint() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 8192];
            let _ = stream.read(&mut request);
            let body = r#"{"id":"mock-1","choices":[{"message":{"content":"连接成功"}}]}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(), body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });
        let channel = tauri::ipc::Channel::<super::AiHttpEvent>::new(|_| Ok(()));
        let result = super::perform_ai_http(
            super::AiHttpRequest {
                request_id: "native-bridge-test".to_string(),
                url: format!("http://127.0.0.1:{port}/v1/chat/completions"),
                body: "{}".to_string(),
                api_key: "test-key".to_string(),
                timeout_ms: 10_000,
            },
            channel,
            std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        ).unwrap();
        server.join().unwrap();
        assert_eq!(result.status, 200);
        assert!(result.body.contains("连接成功"));
    }

    #[test]
    fn database_has_projects_handles_empty_and_seeded_databases() {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
        use std::str::FromStr;

        let directory = std::env::temp_dir().join(format!("weiguang-migration-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let database_path = directory.join("migration.db");
        let url = format!("sqlite:///{}", database_path.to_string_lossy().replace('\\', "/").trim_start_matches('/'));
        let options = SqliteConnectOptions::from_str(&url).unwrap().create_if_missing(true);
        tauri::async_runtime::block_on(async {
            let pool = SqlitePool::connect_with(options).await.unwrap();
            sqlx::query("CREATE TABLE projects (id TEXT PRIMARY KEY)").execute(&pool).await.unwrap();
            pool.close().await;
        });
        assert!(!super::database_has_projects(&database_path));

        let options = SqliteConnectOptions::from_str(&url).unwrap().create_if_missing(false);
        tauri::async_runtime::block_on(async {
            let pool = SqlitePool::connect_with(options).await.unwrap();
            sqlx::query("INSERT INTO projects (id) VALUES ('p1')").execute(&pool).await.unwrap();
            pool.close().await;
        });
        assert!(super::database_has_projects(&database_path));
        let _ = std::fs::remove_dir_all(directory);
    }
    #[test]
    fn plugin_path_mapper_creates_connectable_windows_url() {
        let directory = std::env::temp_dir().join(format!("changye-plugin-path-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let candidate = tauri_plugin_sql::path_mapper(directory.clone(), "sqlite:native-check.db");
        assert!(candidate.starts_with("sqlite:///"), "{candidate}");
        let options = sqlx::sqlite::SqliteConnectOptions::from_str(&candidate).unwrap();
        let filename = options.get_filename().to_string_lossy().replace('\\', "/");
        assert!(filename.ends_with("native-check.db"), "{filename}");
        tauri::async_runtime::block_on(async {
            let pool = sqlx::SqlitePool::connect_with(options.create_if_missing(true)).await.unwrap();
            pool.close().await;
        });
        let _ = std::fs::remove_dir_all(directory);
    }
}
