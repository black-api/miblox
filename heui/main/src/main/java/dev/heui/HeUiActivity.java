package dev.heui;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The HeUi host activity.
 *
 * <p>It owns the WebView that runs the JavaScript runtime, the bridge to the
 * native core and a loopback server that hands the game to the WebView.
 *
 * <p>MIUI specifics handled here:
 * <ul>
 *   <li>The game is served from {@code http://127.0.0.1} instead of
 *       {@code file:///android_asset}: several ROMs (MIUI among them) fail to
 *       render {@code file://} pages and show a blank grey error screen
 *       instead. A real origin also lets the game fetch its own assets.</li>
 *   <li>The screen is kept on while the game runs (MIUI otherwise dims it).</li>
 *   <li>The activity is not recreated on rotation; the runtime is asked to
 *       resize instead, so a game never loses its state.</li>
 *   <li>onPause stops the renderer and mutes audio immediately, because MIUI
 *       can freeze a backgrounded process at any moment.</li>
 *   <li>A load failure shows a readable error instead of a blank screen.</li>
 * </ul>
 */
public class HeUiActivity extends Activity {

    private static final String ASSET_ROOT = "heui";

    private WebView webView;
    private HeBridge bridge;
    private HeAssetServer server;
    private boolean hostPaused;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        HeHapticsContext.install(this);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#0d1020"));
        getWindow().setNavigationBarColor(Color.parseColor("#0d1020"));
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        applyImmersiveMode();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // The game is served over http://127.0.0.1, so file access is not
        // needed — and leaving it off avoids the ROMs that block it.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        webView.setBackgroundColor(Color.parseColor("#0d1020"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    showError("Could not load " + request.getUrl()
                            + "\n\n" + (error == null ? "unknown error" : error.getDescription()));
                }
            }
        });
        if (Build.VERSION.SDK_INT >= 19) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        bridge = new HeBridge(webView);
        webView.addJavascriptInterface(bridge, "HeUiHost");

        setContentView(webView);

        startServer();
    }

    /** Starts the loopback asset server and loads the game from it. */
    private void startServer() {
        try {
            server = new HeAssetServer(getAssets(), ASSET_ROOT);
            int port = server.start();
            webView.loadUrl("http://127.0.0.1:" + port + "/index.html");
        } catch (Exception error) {
            // Fall back to the asset manager, and show the reason if that
            // fails too — a blank screen is never acceptable.
            android.util.Log.e("HeUiActivity", "asset server failed", error);
            showError("The local asset server could not start:\n" + error);
        }
    }

    /** Replaces the WebView with a readable error message. */
    private void showError(String message) {
        if (isFinishing()) {
            return;
        }
        runOnUiThread(() -> {
            try {
                android.widget.TextView view = new android.widget.TextView(this);
                view.setText(message);
                view.setTextColor(Color.WHITE);
                view.setTextSize(14);
                view.setPadding(48, 120, 48, 48);
                view.setBackgroundColor(Color.parseColor("#0d1020"));
                setContentView(view);
            } catch (Throwable ignored) {
                // Nothing else we can do here.
            }
        });
    }

    private void applyImmersiveMode() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveMode();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
        if (hostPaused && bridge != null) {
            bridge.notifyResume();
        }
        hostPaused = false;
    }

    @Override
    protected void onPause() {
        // MIUI may kill the process at any time after this point: stop drawing
        // and mute the audio right away.
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        if (bridge != null) {
            bridge.notifyPause();
        }
        hostPaused = true;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (server != null) {
            server.stop();
            server = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("HeUiHost");
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // The game decides what a back press means; ask it first.
            if (webView != null) {
                webView.evaluateJavascript(
                        "(window.HEUI && window.HEUI.onBackPressed && window.HEUI.onBackPressed()) ? true : false",
                        value -> {
                            if (!"true".equals(value)) {
                                finish();
                            }
                        });
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }
}
