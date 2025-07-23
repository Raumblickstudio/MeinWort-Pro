import { useState, useCallback, useRef } from "react";
import { AppState, AppMode } from "../types";
import { audioService, AudioRecording } from "../services/audioService";
import { transcriptionService } from "../services/transcriptionService";
import { tauriClipboardService } from "../services/tauriClipboardService";
import { chatService, ChatService } from "../services/chatService";

export function useAppState() {
  const [state, setState] = useState<AppState>({
    isRecording: false,
    isTranscribing: false,
    lastTranscription: null,
    error: null,
    mode: 'normal',
    clipboardText: null,
    isProcessingText: false,
    lastProcessedResult: null,
    lastProcessedTimestamp: null,
    isDetecting: false,
  });

  const currentRecordingRef = useRef<AudioRecording | null>(null);
  const detectionDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const setRecording = useCallback((recording: boolean) => {
    setState(prev => ({
      ...prev,
      isRecording: recording,
      error: recording ? null : prev.error, // Clear error when starting new recording
    }));
  }, []);

  const setTranscribing = useCallback((transcribing: boolean) => {
    setState(prev => ({
      ...prev,
      isTranscribing: transcribing,
    }));
  }, []);

  const setTranscription = useCallback((text: string | null) => {
    setState(prev => ({
      ...prev,
      lastTranscription: text,
      isTranscribing: false,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isRecording: false,
      isTranscribing: false,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState({
      isRecording: false,
      isTranscribing: false,
      lastTranscription: null,
      error: null,
      mode: 'normal',
      clipboardText: null,
      isProcessingText: false,
      lastProcessedResult: null,
      lastProcessedTimestamp: null,
      isDetecting: false,
    });
  }, []);


  // Markierten Text automatisch kopieren und Modus bestimmen
  const autoDetectSelectionAndSetMode = useCallback(async (): Promise<AppMode> => {
    // 🚫 SCHUTZ: Verhindere doppelte/parallele Ausführung
    if (state.isDetecting) {
      console.log('⏸️ Text-Detection bereits aktiv, überspringe...');
      return state.mode; // Aktuellen Modus beibehalten
    }

    try {
      // Detection-Flag setzen
      setState(prev => ({ ...prev, isDetecting: true }));
      console.log('🔍 Starte Text-Detection...');
      
      // 1. Zwischenablage VOR Auto-Copy lesen (um Vergleich zu haben)
      const clipboardBefore = await tauriClipboardService.readText();
      const textBefore = clipboardBefore.success ? clipboardBefore.text?.trim() : '';
      console.log(`📋 Zwischenablage VORHER: "${textBefore?.substring(0, 30)}..."`);
      
      // 2. Auto-Copy ausführen
      console.log('🔄 Führe Auto-Copy aus...');
      const autoCopyResult = await tauriClipboardService.autoCopySelection();
      
      if (autoCopyResult.success) {
        console.log('✅ Auto-Copy erfolgreich ausgeführt');
        // Ultra-Speed: Minimal wait für AppleScript (30ms statt 200ms)
        await new Promise(resolve => setTimeout(resolve, 30));
        
        // 3. Zwischenablage NACH Auto-Copy lesen
        const clipboardAfter = await tauriClipboardService.readText();
        const textAfter = clipboardAfter.success ? clipboardAfter.text?.trim() : '';
        console.log(`📋 Zwischenablage NACHHER: "${textAfter?.substring(0, 30)}..."`);
        
        // 4. Vergleichen: Hat sich was geändert?
        if (textAfter && textAfter !== textBefore && textAfter.length > 0) {
          console.log('🎯 FRISCH markierter Text erkannt (Zwischenablage hat sich geändert)');
          return await handleTextProcessingMode(textAfter);
        } else {
          console.log('ℹ️ Keine Änderung in Zwischenablage → kein frisch markierter Text');
          return handleNormalMode();
        }
      } else {
        console.log('⚠️ Auto-Copy fehlgeschlagen:', autoCopyResult.error);
        console.log('🎤 Kein markierter Text → Normal-Modus');
        return handleNormalMode();
      }
      
    } catch (error) {
      console.warn("⚠️ Text-Detection fehlgeschlagen:", error);
      return handleNormalMode();
    } finally {
      // Detection-Flag immer zurücksetzen
      setState(prev => ({ ...prev, isDetecting: false }));
      console.log('✅ Text-Detection abgeschlossen, Flag zurückgesetzt');
    }
  }, [state.lastProcessedResult, state.isDetecting, state.mode]);

  // Debounced Version für externe Aufrufe
  const debouncedAutoDetectSelectionAndSetMode = useCallback((): Promise<AppMode> => {
    return new Promise((resolve) => {
      // Vorherigen Timer löschen
      if (detectionDebounceRef.current) {
        clearTimeout(detectionDebounceRef.current);
        console.log('⏰ Vorherige Text-Detection abgebrochen (Debounce)');
      }
      
      // Neuen Timer setzen
      detectionDebounceRef.current = setTimeout(async () => {
        console.log('⚡ Debounce-Timer abgelaufen, führe Text-Detection aus');
        const result = await autoDetectSelectionAndSetMode();
        resolve(result);
      }, 10); // 10ms Ultra-Speed Debounce - Maximum responsiveness
    });
  }, [autoDetectSelectionAndSetMode]);

  // Helper: Text-Processing Modus aktivieren
  const handleTextProcessingMode = useCallback(async (text: string): Promise<AppMode> => {
    // Filter Screenshot-Pfade heraus
    if (text.includes('/var/folders/') && text.includes('screencaptureui')) {
      console.log('⚠️ Screenshot-Pfad erkannt, ignoriere und verwende Normal-Modus');
      return handleNormalMode();
    }
    
    // 🔍 INTELLIGENTE ERKENNUNG: Ist das unser eigenes verarbeitetes Ergebnis?
    if (state.lastProcessedResult && state.lastProcessedTimestamp && text === state.lastProcessedResult) {
      const timeSinceProcessing = Date.now() - state.lastProcessedTimestamp;
      if (timeSinceProcessing < 60000) { // Nur in den ersten 60 Sekunden nach Verarbeitung
        console.log('🤖 Eigenes verarbeitetes Ergebnis erkannt → Normal-Modus (keine erneute Verarbeitung)');
        console.log(`⏱️ Zeit seit Verarbeitung: ${timeSinceProcessing}ms`);
        setState(prev => ({
          ...prev,
          mode: 'normal',
          clipboardText: null,
          error: null,
          lastProcessedResult: null, // Reset nach Erkennung
          lastProcessedTimestamp: null,
        }));
        return 'normal';
      } else {
        console.log('⏰ Verarbeitetes Ergebnis zu alt, behandle als neuen Text');
      }
    }
    
    // Text-Processing Modus aktivieren
    setState(prev => ({
      ...prev,
      mode: 'text-processing',
      clipboardText: text,
      error: null
    }));
    
    console.log(`🔄 Text-Processing Modus aktiviert - ${text.length} Zeichen erkannt (frisch markiert)`);
    
    // Andere Selections clearen für sauberen Workflow
    try {
      console.log('🧹 Cleae andere Selections für besseren Text-Processing-Workflow...');
      const clearResult = await tauriClipboardService.clearOtherSelections();
      if (clearResult.success) {
        console.log('✅ Andere Selections erfolgreich gecleart');
      } else {
        console.warn('⚠️ Selection-Clearing fehlgeschlagen:', clearResult.error);
      }
    } catch (clearError) {
      console.warn('⚠️ Selection-Clearing-Fehler (nicht kritisch):', clearError);
    }
    
    return 'text-processing';
  }, [state.lastProcessedResult, state.lastProcessedTimestamp]);

  // Helper: Normal-Modus aktivieren
  const handleNormalMode = useCallback((): AppMode => {
    setState(prev => ({
      ...prev,
      mode: 'normal',
      clipboardText: null,
      error: null
    }));
    
    console.log("🎤 Normal-Modus aktiviert");
    return 'normal';
  }, []);

  const startRecording = useCallback(async () => {
    // Strikte Prüfung um doppelte Aufrufe zu verhindern
    if (state.isTranscribing || state.isRecording || state.isProcessingText) {
      console.log(`⏸️ Aufnahme blockiert: isRecording=${state.isRecording}, isTranscribing=${state.isTranscribing}, isProcessingText=${state.isProcessingText}`);
      return;
    }
    
    try {
      setError(null);
      
      // ⚡ INSTANT FEEDBACK: Sofort Recording-State setzen (optimistic UI)
      setRecording(true);
      console.log('⚡ Instant UI Feedback: Recording-State gesetzt (0ms)');
      
      // ⚡ PARALLEL PROCESSING: Detection + Audio Permission parallel ausführen
      console.log('🚀 Starte Parallel Processing (Detection + Audio + Permissions)...');
      
      const [detectedMode, hasPermission] = await Promise.all([
        // Detection parallel ausführen
        debouncedAutoDetectSelectionAndSetMode(),
        // Audio Permission parallel prüfen
        audioService.requestPermission()
      ]);
      
      console.log(`🎤 Audio-Aufnahme in ${detectedMode}-Modus (parallel completed)...`);
      console.log(`🔍 DEBUG MODE: detectedMode='${detectedMode}', clipboardText=${state.clipboardText ? 'vorhanden' : 'null'}`);
      
      // 2. Permission check
      if (!hasPermission) {
        setRecording(false); // Rollback optimistic UI
        setError("Mikrofon-Berechtigung erforderlich");
        return;
      }
      
      // 3. Audio-Aufnahme starten (MediaRecorder bereits durch optimistic UI state bereit)
      try {
        await audioService.startRecording();
        // Recording state bereits gesetzt durch optimistic UI
        console.log("✅ Audio-Aufnahme gestartet (parallel optimized)");
      } catch (audioError) {
        if (audioError instanceof Error && audioError.message.includes('bereits')) {
          console.log('ℹ️ Audio-Service bereits aktiv, ignoriere');
          return;
        }
        setRecording(false); // Rollback optimistic UI bei Fehler
        throw audioError;
      }
      
    } catch (error) {
      console.error("❌ Fehler beim Starten der Aufnahme:", error);
      setError(error instanceof Error ? error.message : "Fehler beim Starten der Aufnahme");
      setRecording(false);
    }
  }, [state.isTranscribing, state.isRecording, state.isProcessingText, setRecording, setError, debouncedAutoDetectSelectionAndSetMode]);

  const stopRecording = useCallback(async () => {
    if (!state.isRecording || state.isTranscribing) return;
    
    try {
      console.log("⏹️ Stoppe Audio-Aufnahme...");
      
      setRecording(false);
      setTranscribing(true);
      
      // Audio-Aufnahme stoppen und erhalten
      const recording = await audioService.stopRecording();
      currentRecordingRef.current = recording;
      
      console.log("🔄 Starte Transkription...");
      
      // Transkription durchführen - mit Mode-spezifischen Optionen
      const transcriptionOptions = state.mode === 'text-processing' 
        ? {
            prompt: 'Dies ist deutsche Sprache. Transkribiere diesen kurzen Sprachbefehl präzise.',
            temperature: 0.2
          }
        : {
            prompt: 'Dies ist deutsche Sprache. Nutze MAXIMALE Empfindlichkeit um auch extrem leise Sprache zu erfassen. Erkenne Flüstern und schwache Audio-Signale aggressiv.',
            temperature: 1.0 // 🔊 MAXIMUM EMPFINDLICHKEIT: Höchste Temperatur für leiseste Sprache
          };
      
      console.log(`🔧 Whisper-Optionen für ${state.mode}-Modus:`, transcriptionOptions);
      const result = await transcriptionService.transcribeAudio(recording, transcriptionOptions);
      
      console.log(`🎧 WHISPER RAW RESULT: "${result.text}" (${result.text.length} Zeichen)`);
      
      // 🔍 VALIDATION: Wirklich Text-Processing oder doch Normal-Modus?
      const hasValidClipboardText = state.clipboardText && state.clipboardText.trim().length > 0;
      const shouldProcessText = state.mode === 'text-processing' && hasValidClipboardText;
      
      console.log(`🔍 MODE VALIDATION: mode='${state.mode}', hasClipboardText=${hasValidClipboardText}, shouldProcessText=${shouldProcessText}`);
      
      if (shouldProcessText) {
        // TEXT-PROCESSING MODUS: Sprachbefehl verarbeiten
        console.log(`🤖 TEXT-PROCESSING MODUS: Verarbeite "${result.text}" auf Text mit ${state.clipboardText!.length} Zeichen`);
        
        // ⚡ OPTIMISTIC UI: Sofort Processing-State + Vorschau anzeigen
        setState(prev => ({ ...prev, isProcessingText: true }));
        setTranscription(`Befehl: "${result.text}"\n\n⚡ Verarbeite Text...`);
        
        try {
          const normalizedCommand = ChatService.normalizeCommand(result.text);
          
          const chatResult = await chatService.processTextWithCommand({
            command: normalizedCommand,
            originalText: state.clipboardText!
          });
          
          // Verarbeitetes Ergebnis setzen
          const finalTranscription = `Befehl: "${chatResult.originalCommand}"\n\nErgebnis:\n${chatResult.processedText}`;
          console.log(`📝 TEXT-PROCESSING FINAL: "${finalTranscription.substring(0, 100)}..."`);
          setTranscription(finalTranscription);
          
          // Nur das verarbeitete Ergebnis in Zwischenablage kopieren
          const clipboardResult = await tauriClipboardService.copyText(chatResult.processedText);
          if (clipboardResult.success) {
            console.log("✅ Verarbeiteter Text automatisch in Zwischenablage kopiert!");
            
            // 🔍 TRACKING: Verarbeitetes Ergebnis merken für intelligente Erkennung
            const timestamp = Date.now();
            setState(prev => ({
              ...prev,
              lastProcessedResult: chatResult.processedText,
              lastProcessedTimestamp: timestamp
            }));
            console.log(`📝 Verarbeitetes Ergebnis getrackt für intelligente Erkennung (${timestamp})`);
          }
          
          console.log("✅ Text-Verarbeitung abgeschlossen");
          
        } catch (chatError) {
          console.error("❌ Text-Verarbeitung fehlgeschlagen:", chatError);
          setError(chatError instanceof Error ? chatError.message : "Fehler bei der Text-Verarbeitung");
          
          // Fallback: Ursprünglichen Befehl anzeigen
          setTranscription(`Befehl erkannt: "${result.text}"\n\nFehler bei der Verarbeitung. Bitte versuchen Sie es erneut.`);
        } finally {
          setState(prev => ({ ...prev, isProcessingText: false }));
        }
        
      } else {
        // NORMAL MODUS oder FALLBACK: Normale Transkription  
        if (state.mode === 'text-processing') {
          console.log(`⚠️ FALLBACK: Text-Processing ohne gültigen clipboardText → Zwangs-Normal-Modus`);
        }
        console.log(`🎤 NORMAL MODUS: Normale Transkription "${result.text}"`);
        console.log(`📝 NORMAL FINAL: "${result.text}" (unverändert von Whisper)`);
        setTranscription(result.text);
        
        // Reset des Processed-Result-Trackings bei normaler Transkription
        setState(prev => ({
          ...prev,
          lastProcessedResult: null,
          lastProcessedTimestamp: null
        }));
        console.log("🔄 Processed-Result-Tracking resettet für frische normale Transkription");
        
        // Automatisch in Zwischenablage kopieren
        console.log("📋 Kopiere automatisch in Zwischenablage...");
        try {
          const clipboardResult = await tauriClipboardService.copyText(result.text);
          if (clipboardResult.success) {
            console.log("✅ Automatisch in Zwischenablage kopiert!");
          } else {
            console.warn("⚠️ Automatisches Kopieren fehlgeschlagen:", clipboardResult.error);
          }
        } catch (clipError) {
          console.warn("⚠️ Clipboard-Fehler:", clipError);
        }
        
        console.log("✅ NORMAL MODUS Transkription abgeschlossen:", result.text);
        console.log(`🔍 DEBUG: State nach Normal-Transkription - mode=${state.mode}, clipboardText=${state.clipboardText ? 'vorhanden' : 'null'}`);
      }
      
    } catch (error) {
      console.error("❌ Fehler bei Aufnahme/Transkription:", error);
      setError(error instanceof Error ? error.message : "Fehler bei der Transkription");
    } finally {
      setTranscribing(false);
      // Nach dem Verarbeiten: Explizit auf Normal-Modus zurücksetzen
      setState(prev => ({
        ...prev,
        mode: 'normal',
        clipboardText: null,
        isProcessingText: false
        // lastProcessedResult bleibt für intelligente Erkennung
      }));
      console.log('🔄 Mode explizit auf NORMAL zurückgesetzt nach Verarbeitung');
    }
  }, [state.isRecording, state.isTranscribing, state.mode, state.clipboardText, setRecording, setTranscribing, setTranscription, setError]);

  const toggleRecording = useCallback(() => {
    // Strikte Prüfung um doppelte Aufrufe zu verhindern
    if (state.isTranscribing || state.isProcessingText) {
      console.log(`⏸️ Toggle blockiert: isTranscribing=${state.isTranscribing}, isProcessingText=${state.isProcessingText}`);
      return;
    }
    
    console.log(`🔄 Toggle: isRecording=${state.isRecording}`);
    
    if (state.isRecording) {
      console.log('⏹️ Stoppe Aufnahme...');
      stopRecording();
    } else {
      console.log('▶️ Starte Aufnahme...');
      startRecording();
    }
  }, [state.isRecording, state.isTranscribing, state.isProcessingText, startRecording, stopRecording]);

  const clearText = useCallback(() => {
    setTranscription(null);
    setError(null);
  }, [setTranscription, setError]);

  // Manuell Text in Zwischenablage kopieren über Tauri
  const copyCurrentText = useCallback(async (): Promise<boolean> => {
    if (!state.lastTranscription) return false;
    
    try {
      console.log("🖱️ Manueller Copy-Button geklickt");
      const result = await tauriClipboardService.copyText(state.lastTranscription);
      
      if (!result.success) {
        setError(result.error || "Fehler beim Kopieren");
        return false;
      }
      
      console.log("✅ Text manuell in Zwischenablage kopiert");
      return true;
      
    } catch (error) {
      console.error("❌ Clipboard-Fehler:", error);
      setError(error instanceof Error ? error.message : "Fehler beim Kopieren");
      return false;
    }
  }, [state.lastTranscription, setError]);

  // Cleanup beim Unmount
  const cleanup = useCallback(async () => {
    try {
      await audioService.cleanup();
      transcriptionService.cleanup();
      
      // URL für aktuelle Aufnahme freigeben
      if (currentRecordingRef.current?.url) {
        URL.revokeObjectURL(currentRecordingRef.current.url);
      }
      
      // Debounce-Timer cleanen
      if (detectionDebounceRef.current) {
        clearTimeout(detectionDebounceRef.current);
        detectionDebounceRef.current = null;
      }
      
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }, []);

  return {
    state,
    toggleRecording,
    startRecording,
    stopRecording,
    clearText,
    clearAll,
    copyCurrentText,
    cleanup,
    setError,
  };
}