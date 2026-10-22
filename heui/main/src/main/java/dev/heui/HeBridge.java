package dev.heui;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Exposes the native core to the JavaScript runtime.
 *
 * <p>The bridge is deliberately small: the JavaScript side owns the game loop
 * and the scene graph, and calls into the native core only for the work that
 * benefits from it (fixed-step physics, native logging, haptics).
 */
public final class HeBridge {

    private final WebView webView;

    public HeBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public String nativeVersion() {
        if (!HeNative.isAvailable()) {
            return "";
        }
        return HeNative.nativeVersion();
    }

    @JavascriptInterface
    public int nativeAbiVersion() {
        return HeNative.isAvailable() ? HeNative.nativeAbiVersion() : 0;
    }

    @JavascriptInterface
    public int nativeInit(int width, int height) {
        return HeNative.isAvailable() ? HeNative.nativeInit(width, height) : 0;
    }

    @JavascriptInterface
    public void nativeFrame(double deltaSeconds) {
        if (HeNative.isAvailable()) {
            HeNative.nativeFrame(deltaSeconds);
        }
    }

    @JavascriptInterface
    public void nativeLog(int level, String tag, String message) {
        if (HeNative.isAvailable()) {
            HeNative.nativeLog(level, tag, message);
        } else {
            android.util.Log.println(level, tag, message == null ? "" : message);
        }
    }

    @JavascriptInterface
    public void nativePostEvent(String name, String payload) {
        if (HeNative.isAvailable()) {
            HeNative.nativePostEvent(name, payload);
        }
    }

    @JavascriptInterface
    public int nativeNodeCreate(String name) {
        return HeNative.isAvailable() ? HeNative.nativeNodeCreate(name) : 0;
    }

    @JavascriptInterface
    public void nativeNodeSetPosition(int node, float x, float y) {
        if (HeNative.isAvailable()) {
            HeNative.nativeNodeSetPosition(node, x, y);
        }
    }

    @JavascriptInterface
    public void nativePhysicsStep(float dt) {
        if (HeNative.isAvailable()) {
            HeNative.nativePhysicsStep(dt);
        }
    }

    @JavascriptInterface
    public void vibrate(int milliseconds) {
        HeHaptics.vibrate(milliseconds);
    }

    /** Called by the activity when the app is backgrounded. */
    public void notifyPause() {
        evaluate("window.HEUI && window.HEUI.onHostPause && window.HEUI.onHostPause();");
    }

    /** Called by the activity when the app comes back to the foreground. */
    public void notifyResume() {
        evaluate("window.HEUI && window.HEUI.onHostResume && window.HEUI.onHostResume();");
    }

    /** Called by the activity when the GL/WebView surface is recreated. */
    public void notifySurfaceReady() {
        evaluate("window.HEUI && window.HEUI.onHostSurfaceReady && window.HEUI.onHostSurfaceReady();");
    }

    private void evaluate(String script) {
        if (webView == null) {
            return;
        }
        webView.post(() -> {
            try {
                webView.evaluateJavascript(script, null);
            } catch (Throwable ignored) {
                // The WebView may be gone; nothing to do.
            }
        });
    }
}
