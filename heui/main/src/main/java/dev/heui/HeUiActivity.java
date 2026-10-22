package dev.heui;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The HeUi host activity.
 *
 * <p>It owns the WebView that runs the JavaScript runtime and the bridge to
 * the native core. Everything the game needs lives in
 * {@code assets/heui/}, so the app works completely offline.
 *
 * <p>MIUI specifics handled here:
 * <ul>
 *   <li>The screen is kept on while the game runs (MIUI otherwise dims it).</li>
 *   <li>The activity is not recreated on rotation; the runtime is asked to
 *       resize instead, so a game never loses its state.</li>
 *   <li>onPause stops the renderer and mutes audio immediately, because MIUI
 *       can freeze a backgrounded process at any moment.</li>
 * </ul>
 */
public class HeUiActivity extends Activity {

    private WebView webView;
    private HeBridge bridge;
    private boolean hostPaused;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        HeHapticsContext.install(this);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        applyImmersiveMode();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        webView.setWebViewClient(new WebViewClient());
        webView.setBackgroundColor(0xFF0D1020);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        bridge = new HeBridge(webView);
        webView.addJavascriptInterface(bridge, "HeUiHost");

        setContentView(webView);

        webView.loadUrl("file:///android_asset/heui/index.html");
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
        if (webView != null) {
            webView.removeJavascriptInterface("HeUiHost");
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
