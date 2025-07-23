import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

export function useWindowConfig() {
  useEffect(() => {
    const configureWindow = async () => {
      const window = getCurrentWindow();

      try {
        // Ensure the window is always on top
        await window.setAlwaysOnTop(true);
        
        // Set window to be non-resizable
        await window.setResizable(false);
        
        // Configure window decorations (no title bar)
        await window.setDecorations(false);
        
        // Set window to skip taskbar on Windows/Linux
        await window.setSkipTaskbar(true);
        
        console.log("Window configured successfully");
      } catch (error) {
        console.error("Failed to configure window:", error);
      }
    };

    configureWindow();
  }, []);

  const repositionWindow = async (x: number, y: number) => {
    try {
      const window = getCurrentWindow();
      await window.setPosition(new LogicalPosition(x, y));
    } catch (error) {
      console.error("Failed to reposition window:", error);
    }
  };

  const setWindowSize = async (width: number, height: number) => {
    try {
      const window = getCurrentWindow();
      await window.setSize(new LogicalSize(width, height));
    } catch (error) {
      console.error("Failed to resize window:", error);
    }
  };

  return {
    repositionWindow,
    setWindowSize,
  };
}