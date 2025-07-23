import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

export interface ClipboardOptions {
  showNotification?: boolean;
  trimText?: boolean;
  maxLength?: number;
}

export interface ClipboardResult {
  success: boolean;
  text?: string;
  error?: string;
  truncated?: boolean;
}

export class ClipboardService {
  private static readonly DEFAULT_MAX_LENGTH = 10000; // 10k Zeichen
  
  /**
   * Text in die Zwischenablage kopieren - nur bei User-Interaktion
   */
  async copyText(text: string, options: ClipboardOptions = {}, isUserInteraction: boolean = false): Promise<ClipboardResult> {
    if (!text || text.length === 0) {
      return {
        success: false,
        error: 'Kein Text zum Kopieren vorhanden'
      };
    }

    // Text optional trimmen
    let processedText = options.trimText !== false ? text.trim() : text;
    let truncated = false;

    // Maximale Länge prüfen
    const maxLength = options.maxLength || ClipboardService.DEFAULT_MAX_LENGTH;
    if (processedText.length > maxLength) {
      processedText = processedText.substring(0, maxLength) + '...';
      truncated = true;
      console.warn(`⚠️ Text wurde auf ${maxLength} Zeichen gekürzt`);
    }

    console.log(`🔄 Kopiere Text (User-Interaktion: ${isUserInteraction}): "${processedText.substring(0, 50)}..."`);

    // Methode 1: Tauri Clipboard API (sollte immer funktionieren in Tauri)
    try {
      await writeText(processedText);
      console.log('✅ Text mit Tauri API kopiert');
      
      this.showNotification(processedText, options);
      return { success: true, text: processedText, truncated };

    } catch (tauriError) {
      console.warn('⚠️ Tauri Clipboard API fehlgeschlagen:', tauriError);
    }

    // Wenn Tauri fehlschlägt, versuche Browser-Methoden nur bei User-Interaktion
    if (isUserInteraction) {
      // Methode 2: Browser Clipboard API
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(processedText);
          console.log('✅ Text mit Browser Clipboard API kopiert');
          
          this.showNotification(processedText, options);
          return { success: true, text: processedText, truncated };
        }
      } catch (browserError) {
        console.warn('⚠️ Browser Clipboard API fehlgeschlagen:', browserError);
      }

      // Methode 3: Legacy execCommand (nur bei User-Interaktion)
      try {
        const result = this.copyTextLegacy(processedText);
        if (result.success) {
          console.log('✅ Text mit Legacy-Methode kopiert');
          this.showNotification(processedText, options);
          return { success: true, text: processedText, truncated };
        }
      } catch (legacyError) {
        console.warn('⚠️ Legacy Copy fehlgeschlagen:', legacyError);
      }
    }

    // Fallback: Text für manuelles Kopieren bereitstellen
    console.error('❌ Automatisches Kopieren fehlgeschlagen - zeige Text zum manuellen Kopieren');
    return {
      success: false,
      error: 'Automatisches Kopieren nicht möglich. Bitte Copy-Button verwenden.',
      text: processedText
    };
  }

  /**
   * Notification anzeigen
   */
  private showNotification(text: string, options: ClipboardOptions) {
    if (options.showNotification && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('MeinWort Pro', {
        body: `Text kopiert: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        icon: '/icon.png',
        tag: 'clipboard-copy',
        silent: true,
      });
    }
  }


  /**
   * Legacy Fallback über temporäres Textfield
   */
  private copyTextLegacy(text: string): ClipboardResult {
    try {
      // Temporäres Textarea-Element erstellen
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // Element unsichtbar machen, aber selektierbar lassen
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');
      textArea.style.setProperty('-webkit-user-select', 'text', 'important');
      textArea.style.setProperty('-moz-user-select', 'text', 'important');
      textArea.style.setProperty('-ms-user-select', 'text', 'important');
      textArea.style.setProperty('user-select', 'text', 'important');
      
      document.body.appendChild(textArea);
      
      // iOS Safari support
      if (/iphone|ipad/i.test(navigator.userAgent)) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.select();
        textArea.setSelectionRange(0, 999999);
      }
      
      // Copy-Command ausführen
      let successful = false;
      try {
        successful = document.execCommand('copy');
      } catch (execError) {
        console.warn('execCommand copy error:', execError);
        successful = false;
      }
      
      // Cleanup
      document.body.removeChild(textArea);

      if (successful) {
        return {
          success: true,
          text
        };
      } else {
        throw new Error('execCommand copy returned false');
      }

    } catch (error) {
      console.error('❌ Legacy clipboard fallback failed:', error);
      return {
        success: false,
        error: 'Legacy-Kopiermethode fehlgeschlagen'
      };
    }
  }

  /**
   * Text aus Zwischenablage lesen (optional für erweiterte Features)
   */
  async readText(): Promise<ClipboardResult> {
    try {
      // Tauri API zuerst versuchen
      const text = await readText();
      
      return {
        success: true,
        text: text || ''
      };

    } catch (error) {
      console.error('❌ Clipboard read failed:', error);
      
      // Browser fallback
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          return {
            success: true,
            text
          };
        }
      } catch (fallbackError) {
        console.error('❌ Browser clipboard read fallback failed:', fallbackError);
      }

      return {
        success: false,
        error: 'Konnte Zwischenablage nicht lesen'
      };
    }
  }

  /**
   * Clipboard Berechtigung prüfen/anfordern
   */
  async requestPermission(): Promise<boolean> {
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
        return result.state === 'granted' || result.state === 'prompt';
      }
      return true; // Assume permission if not available
    } catch (error) {
      console.warn('⚠️ Permission check not supported:', error);
      return true;
    }
  }

  /**
   * Notification-Berechtigung prüfen/anfordern
   */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          return true;
        } else if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        }
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Notification permission request failed:', error);
      return false;
    }
  }

  /**
   * Text für Zwischenablage optimieren
   */
  static optimizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')      // Multiple whitespace zu single space
      .replace(/\n\s+/g, '\n')   // Leading whitespace nach newlines entfernen
      .replace(/\n{3,}/g, '\n\n'); // Multiple newlines reduzieren
  }

  /**
   * Statistiken für kopierten Text
   */
  static getTextStats(text: string): { 
    characters: number; 
    words: number; 
    lines: number; 
    sentences: number;
  } {
    const trimmed = text.trim();
    return {
      characters: trimmed.length,
      words: trimmed.split(/\s+/).filter(w => w.length > 0).length,
      lines: trimmed.split('\n').length,
      sentences: trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
    };
  }

  /**
   * Debug-Funktion zum Testen der Clipboard-Funktionalität
   */
  async testClipboard(): Promise<void> {
    const testText = "🧪 MeinWort Pro Clipboard Test - " + new Date().toISOString();
    console.log("🔬 Starte Clipboard-Test (als User-Interaktion)...");
    
    const result = await this.copyText(testText, { showNotification: true }, true);
    
    if (result.success) {
      console.log("✅ Clipboard-Test erfolgreich!");
      console.log("👉 Versuchen Sie jetzt Cmd+V/Strg+V zum Einfügen");
    } else {
      console.error("❌ Clipboard-Test fehlgeschlagen:", result.error);
      console.log("📋 Text zum manuellen Kopieren:", result.text);
    }
  }
}

// Singleton Instance
export const clipboardService = new ClipboardService();

// Debug: Clipboard-Test im Dev-Mode verfügbar machen
if (import.meta.env.DEV) {
  (window as any).testClipboard = () => clipboardService.testClipboard();
  console.log("🔧 Debug: Clipboard-Test verfügbar als window.testClipboard()");
}