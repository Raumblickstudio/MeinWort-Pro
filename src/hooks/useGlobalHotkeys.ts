import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { DEFAULT_HOTKEYS } from "../utils/constants";

interface UseGlobalHotkeysProps {
  onToggleRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
}

export function useGlobalHotkeys({
  onToggleRecording,
  onStopRecording,
  isRecording,
  isTranscribing,
}: UseGlobalHotkeysProps) {
  
  useEffect(() => {
    const registerHotkeys = async () => {
      try {
        // Register F9 for recording only
        await register(DEFAULT_HOTKEYS.toggleRecording, () => {
          console.log("🔥 F9 HOTKEY PRESSED!");
          if (!isTranscribing) {
            onToggleRecording();
          }
        });

        // Register Escape for stop recording (only when recording)
        if (isRecording) {
          await register(DEFAULT_HOTKEYS.stopRecording, () => {
            console.log("🔥 ESC HOTKEY PRESSED!");
            onStopRecording();
          });
        }

        console.log("Global hotkeys registered successfully");
      } catch (error) {
        console.error("Failed to register global hotkeys:", error);
      }
    };

    const cleanup = async () => {
      try {
        // Unregister all hotkeys
        await unregister(DEFAULT_HOTKEYS.toggleRecording);
        if (isRecording) {
          await unregister(DEFAULT_HOTKEYS.stopRecording);
        }
        console.log("Global hotkeys unregistered");
      } catch (error) {
        console.error("Failed to unregister hotkeys:", error);
      }
    };

    registerHotkeys();

    // Cleanup on unmount or dependency change
    return () => {
      cleanup();
    };
  }, [onToggleRecording, onStopRecording, isRecording, isTranscribing]);

  // Also cleanup on window beforeunload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        await unregister(DEFAULT_HOTKEYS.toggleRecording);
        await unregister(DEFAULT_HOTKEYS.stopRecording);
      } catch (error) {
        // Ignore cleanup errors during shutdown
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload();
    };
  }, []);

  return {
    // Return hotkey status or helper functions if needed
    registeredHotkeys: [DEFAULT_HOTKEYS.toggleRecording, DEFAULT_HOTKEYS.stopRecording],
  };
}