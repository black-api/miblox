package dev.heui;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serves the bundled game from {@code assets/heui} over {@code http://127.0.0.1}.
 *
 * <p>Why not {@code file:///android_asset/...}? On several ROMs (MIUI among
 * them) the system WebView refuses or fails to render {@code file://} URLs
 * from the asset manager, and the user gets a blank grey error page instead
 * of the game. A loopback HTTP server gives the page a real origin, which
 * also makes {@code fetch()} of the game's own assets work (a {@code file://}
 * page has a null origin and every fetch is blocked by CORS).
 *
 * <p>The server binds to the loopback interface only and is stopped with the
 * activity.
 */
public class HeAssetServer {

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8");
        MIME.put("js", "application/javascript; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("ogg", "audio/ogg");
        MIME.put("wav", "audio/wav");
        MIME.put("txt", "text/plain; charset=utf-8");
    }

    private final AssetManager assets;
    private final String root;
    private ServerSocket server;
    private ExecutorService pool;
    private Thread thread;
    private volatile boolean running;

    public HeAssetServer(AssetManager assets, String root) {
        this.assets = assets;
        this.root = root.endsWith("/") ? root.substring(0, root.length() - 1) : root;
    }

    public int start() throws IOException {
        server = new ServerSocket(0, 24, InetAddress.getByName("127.0.0.1"));
        pool = Executors.newFixedThreadPool(4);
        running = true;
        thread = new Thread(() -> {
            while (running) {
                try {
                    final Socket client = server.accept();
                    pool.execute(() -> handle(client));
                } catch (IOException e) {
                    if (running) {
                        android.util.Log.w("HeAssetServer", "accept failed", e);
                    }
                }
            }
        }, "heui-assets");
        thread.setDaemon(true);
        thread.start();
        return server.getLocalPort();
    }

    public int getPort() {
        return server == null ? 0 : server.getLocalPort();
    }

    public void stop() {
        running = false;
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
        if (pool != null) pool.shutdownNow();
    }

    private void handle(Socket client) {
        try {
            client.setSoTimeout(8000);
            InputStream in = client.getInputStream();
            String requestLine = readLine(in);
            if (requestLine == null || requestLine.isEmpty()) {
                client.close();
                return;
            }
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                // No request body is used.
            }

            String[] parts = requestLine.split(" ");
            String path = parts.length > 1 ? parts[1] : "/";
            int query = path.indexOf('?');
            if (query >= 0) path = path.substring(0, query);
            if (path.equals("/") || path.isEmpty()) path = "/index.html";
            if (path.contains("..")) {
                respond(client, 403, "text/plain", "Forbidden".getBytes("UTF-8"));
                return;
            }

            byte[] body;
            try {
                body = readAsset(root + path);
            } catch (IOException notFound) {
                respond(client, 404, "text/plain", ("Not found: " + path).getBytes("UTF-8"));
                return;
            }

            String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
            String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
            respond(client, 200, mime, body);
        } catch (Exception e) {
            try {
                client.close();
            } catch (IOException ignored) {
            }
        }
    }

    private byte[] readAsset(String path) throws IOException {
        InputStream is = assets.open(path);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(4096, is.available()));
            byte[] buffer = new byte[16384];
            int n;
            while ((n = is.read(buffer)) > 0) {
                out.write(buffer, 0, n);
            }
            return out.toByteArray();
        } finally {
            is.close();
        }
    }

    private void respond(Socket client, int code, String mime, byte[] body) throws IOException {
        OutputStream out = client.getOutputStream();
        String head = "HTTP/1.1 " + code + (code == 200 ? " OK" : " ERROR") + "\r\n"
                + "Content-Type: " + mime + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n";
        out.write(head.getBytes("UTF-8"));
        out.write(body);
        out.flush();
        client.close();
    }

    private String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') sb.append((char) c);
            if (sb.length() > 8192) break;
        }
        if (c == -1 && sb.length() == 0) return null;
        return sb.toString();
    }
}
