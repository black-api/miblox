package dev.heui;

/**
 * Thin JNI wrapper around the HeUi C++ core (libhe.so).
 *
 * <p>The library is loaded once at class-initialisation time. If it is
 * missing (for example on an unsupported ABI) {@link #isAvailable()} returns
 * false and the JavaScript runtime falls back to its own renderer instead of
 * crashing the app.
 */
public final class HeNative {

    static {
        boolean loaded = false;
        try {
            System.loadLibrary("he");
            loaded = true;
        } catch (UnsatisfiedLinkError error) {
            loaded = false;
        }
        AVAILABLE = loaded;
    }

    private static final boolean AVAILABLE;

    private HeNative() {
    }

    public static boolean isAvailable() {
        return AVAILABLE;
    }

    public static native String nativeVersion();

    public static native int nativeAbiVersion();

    public static native int nativeInit(int width, int height);

    public static native void nativeShutdown();

    public static native void nativeFrame(double deltaSeconds);

    public static native void nativeLog(int level, String tag, String message);

    public static native void nativePostEvent(String name, String payload);

    public static native int nativeNodeCreate(String name);

    public static native void nativeNodeSetPosition(int node, float x, float y);

    public static native void nativePhysicsStep(float dt);

    public static native int nativePhysicsContactCount();
}
