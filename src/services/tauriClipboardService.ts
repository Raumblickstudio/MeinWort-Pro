import { invoke } from '@tauri-apps/api/core';

export class TauriClipboardService {
  /**
   * Text aus Zwischenablage lesen
   */
  async readText(): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      console.log('🔄 Lese Text aus Zwischenablage...');
      
      const text = await invoke<string>('read_clipboard');
      
      if (text && text.trim().length > 0) {
        console.log(`✅ Text aus Zwischenablage gelesen: ${text.length} Zeichen`);
        return {
          success: true,
          text: text.trim()
        };
      } else {
        return {
          success: false,
          error: 'Keine Textdaten in Zwischenablage gefunden'
        };
      }

    } catch (error) {
      console.warn('⚠️ Zwischenablage lesen fehlgeschlagen:', error);
      return {
        success: false,
        error: `Clipboard-Lesefehler: ${error}`
      };
    }
  }

  /**
   * Text direkt über Tauri-Backend in Zwischenablage kopieren
   */
  async copyText(text: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'Kein Text zum Kopieren vorhanden'
      };
    }

    try {
      console.log(`🔄 Kopiere über Tauri-Backend: "${text.substring(0, 50)}..."`);
      
      const result = await invoke<string>('copy_to_clipboard', { text: text.trim() });
      
      console.log('✅ Tauri-Backend Clipboard erfolgreich:', result);
      return {
        success: true,
        message: result
      };

    } catch (error) {
      console.error('❌ Tauri-Backend Clipboard fehlgeschlagen:', error);
      return {
        success: false,
        error: `Clipboard-Fehler: ${error}`
      };
    }
  }

  /**
   * Markierten Text automatisch kopieren (sendet Cmd+C/Ctrl+C)
   */
  async autoCopySelection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log('📋 Kopiere markierten Text automatisch...');
      
      const result = await invoke<string>('auto_copy_selection');
      
      console.log('✅ Markierter Text automatisch kopiert:', result);
      return {
        success: true,
        message: result
      };

    } catch (error) {
      console.warn('⚠️ Auto-Copy fehlgeschlagen:', error);
      return {
        success: false,
        error: `Auto-Copy-Fehler: ${error}`
      };
    }
  }

  /**
   * Alle anderen Text-Selections im System clearen
   */
  async clearOtherSelections(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log('🧹 Cleae andere Selections...');
      
      const result = await invoke<string>('clear_other_selections');
      
      console.log('✅ Selections gecleart:', result);
      return {
        success: true,
        message: result
      };

    } catch (error) {
      console.warn('⚠️ Selection-Clearing fehlgeschlagen:', error);
      return {
        success: false,
        error: `Selection-Clearing-Fehler: ${error}`
      };
    }
  }

  /**
   * Test-Funktion
   */
  async testClipboard(): Promise<void> {
    const testText = "🧪 Tauri Clipboard Test - " + new Date().toLocaleTimeString();
    console.log("🔬 Teste Tauri-Clipboard...");
    
    const result = await this.copyText(testText);
    
    if (result.success) {
      console.log("✅ Test erfolgreich! Versuchen Sie Cmd+V/Strg+V");
      console.log("📋 Kopierted:", testText);
    } else {
      console.error("❌ Test fehlgeschlagen:", result.error);
    }
  }
}

// Singleton
export const tauriClipboardService = new TauriClipboardService();

// Debug verfügbar machen
if (import.meta.env.DEV) {
  (window as any).testTauriClipboard = () => tauriClipboardService.testClipboard();
  (window as any).clearSelections = () => tauriClipboardService.clearOtherSelections();
  (window as any).autoCopySelection = () => tauriClipboardService.autoCopySelection();
  console.log("🔧 Debug: Tauri-Clipboard-Test als window.testTauriClipboard()");
  console.log("🔧 Debug: Selection-Clearing als window.clearSelections()");
  console.log("🔧 Debug: Auto-Copy-Selection als window.autoCopySelection()");
}