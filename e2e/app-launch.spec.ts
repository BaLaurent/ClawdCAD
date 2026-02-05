import { test, expect, _electron as electron } from "@playwright/test";
import path from "path";

test.describe("ClawdCAD Electron App", () => {
  test("should launch and display main window", async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, "..", "dist", "main", "main", "index.js")],
      env: {
        ...process.env,
        CI: "true",
        NODE_ENV: "production", // Force production mode to load from built files
      },
    });

    // Get the first window
    const window = await electronApp.firstWindow();

    // Wait for the app to be ready
    await window.waitForLoadState("domcontentloaded");

    // Verify window title contains ClawdCAD
    const title = await window.title();
    expect(title).toContain("ClawdCAD");

    // Verify the main layout renders
    await expect(window.locator("body")).toBeVisible();

    // Close the app
    await electronApp.close();
  });

  test("should have correct security settings", async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, "..", "dist", "main", "main", "index.js")],
      env: {
        ...process.env,
        CI: "true",
        NODE_ENV: "production", // Force production mode to load from built files
      },
    });

    // Evaluate in the main process to check security config
    const contextIsolation = await electronApp.evaluate(
      async ({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) return null;
        return windows[0].webContents.getLastWebPreferences()?.contextIsolation;
      },
    );

    expect(contextIsolation).toBe(true);

    await electronApp.close();
  });

  test("should expose electronAPI via preload", async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, "..", "dist", "main", "main", "index.js")],
      env: {
        ...process.env,
        CI: "true",
        NODE_ENV: "production", // Force production mode to load from built files
      },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    // Check that electronAPI is available in the renderer
    const hasElectronAPI = await window.evaluate(() => {
      return typeof (window as unknown as { electronAPI?: unknown }).electronAPI !== "undefined";
    });
    expect(hasElectronAPI).toBe(true);

    // Check platform is exposed
    const platform = await window.evaluate(() => {
      return (window as unknown as { electronAPI: { platform: string } }).electronAPI.platform;
    });
    expect(["win32", "darwin", "linux"]).toContain(platform);

    await electronApp.close();
  });
});
