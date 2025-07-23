// Tauri command für direktes Clipboard-Schreiben
#[tauri::command]
fn copy_to_clipboard(text: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    
    match app_handle.clipboard().write_text(text.clone()) {
        Ok(_) => {
            println!("✅ Text erfolgreich in Zwischenablage kopiert: {} Zeichen", text.len());
            Ok(format!("Text kopiert: {} Zeichen", text.len()))
        }
        Err(e) => {
            println!("❌ Fehler beim Kopieren: {:?}", e);
            Err(format!("Fehler beim Kopieren: {}", e))
        }
    }
}

// Tauri command für Clipboard-Lesen
#[tauri::command]
fn read_clipboard(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    
    match app_handle.clipboard().read_text() {
        Ok(text) => {
            if text.trim().is_empty() {
                println!("ℹ️ Keine Textdaten in Zwischenablage");
                Err("Keine Textdaten in Zwischenablage".to_string())
            } else {
                println!("✅ Text aus Zwischenablage gelesen: {} Zeichen", text.len());
                Ok(text)
            }
        }
        Err(e) => {
            println!("❌ Fehler beim Lesen der Zwischenablage: {:?}", e);
            Err(format!("Fehler beim Lesen: {}", e))
        }
    }
}

// Tauri command um markierten Text automatisch zu kopieren
#[tauri::command]
fn auto_copy_selection() -> Result<String, String> {
    println!("📋 Auto-copying currently selected text...");
    
    #[cfg(target_os = "macos")]
    {
        // macOS: Erweiterte Lösung mit Delay für bessere Erkennung
        let script = r#"
            tell application "System Events"
                -- Ultra-Speed: Minimal delays für maximale Responsiveness  
                delay 0.01
                -- Cmd+C senden
                keystroke "c" using {command down}
                -- Ultra-Speed: Minimal wait für Copy
                delay 0.02
                -- Erfolg zurückgeben
                return "success"
            end tell
        "#;
        
        println!("🔄 Sende Cmd+C via AppleScript...");
        
        match std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                println!("📤 AppleScript stdout: {}", stdout);
                if !stderr.is_empty() {
                    println!("⚠️ AppleScript stderr: {}", stderr);
                }
                
                if output.status.success() {
                    println!("✅ Successfully sent Cmd+C on macOS");
                    Ok("Markierter Text automatisch kopiert".to_string())
                } else {
                    println!("⚠️ AppleScript failed with exit code: {:?}", output.status.code());
                    Err("AppleScript Fehler beim automatischen Kopieren".to_string())
                }
            }
            Err(e) => {
                println!("❌ AppleScript command failed: {:?}", e);
                Err(format!("Fehler beim automatischen Kopieren: {}", e))
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows: Ctrl+C senden
        let script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait("^c")
        "#;
        
        match std::process::Command::new("powershell")
            .arg("-Command")
            .arg(script)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ Successfully sent Ctrl+C on Windows");
                    Ok("Markierter Text automatisch kopiert".to_string())
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    println!("⚠️ PowerShell warning: {}", error);
                    Err("Fehler beim automatischen Kopieren".to_string())
                }
            }
            Err(e) => {
                println!("❌ PowerShell failed: {:?}", e);
                Err(format!("Fehler beim automatischen Kopieren: {}", e))
            }
        }
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        println!("ℹ️ Auto-copy not implemented for this platform");
        Err("Auto-copy nicht verfügbar auf diesem System".to_string())
    }
}

// Tauri command zum Clearen aller anderen Text-Selections
#[tauri::command]
fn clear_other_selections() -> Result<String, String> {
    println!("🧹 Clearing other text selections...");
    
    #[cfg(target_os = "macos")]
    {
        // macOS: AppleScript um ESC an alle Apps zu senden
        let script = r#"
            tell application "System Events"
                set allApps to every application process whose visible is true
                repeat with anApp in allApps
                    try
                        tell anApp
                            if (count of windows) > 0 then
                                keystroke (ASCII character 27) -- ESC key
                            end if
                        end tell
                    on error
                        -- Ignore errors for apps that don't accept keystroke
                    end try
                end repeat
            end tell
        "#;
        
        match std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ Successfully cleared selections on macOS");
                    Ok("Selections in anderen Apps gecleart".to_string())
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    println!("⚠️ AppleScript warning: {}", error);
                    Ok("Selections teilweise gecleart".to_string())
                }
            }
            Err(e) => {
                println!("❌ AppleScript failed: {:?}", e);
                Err(format!("Fehler beim Clearen der Selections: {}", e))
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows: SendInput API um ESC an alle Fenster zu senden
        use std::process::Command;
        
        // PowerShell script um ESC an alle Fenster zu senden
        let script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
        "#;
        
        match Command::new("powershell")
            .arg("-Command")
            .arg(script)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ Successfully cleared selections on Windows");
                    Ok("Selections in anderen Apps gecleart".to_string())
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);  
                    println!("⚠️ PowerShell warning: {}", error);
                    Ok("Selections teilweise gecleart".to_string())
                }
            }
            Err(e) => {
                println!("❌ PowerShell failed: {:?}", e);
                Err(format!("Fehler beim Clearen der Selections: {}", e))
            }
        }
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // Linux/andere: Einfacher Fallback
        println!("ℹ️ Selection clearing not implemented for this platform");
        Ok("Selection clearing nicht verfügbar auf diesem System".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_clipboard_manager::init())
    .invoke_handler(tauri::generate_handler![copy_to_clipboard, read_clipboard, auto_copy_selection, clear_other_selections])
    .setup(|app| {
      // Initialize global shortcut plugin (desktop only)
      #[cfg(desktop)]
      app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
      
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
