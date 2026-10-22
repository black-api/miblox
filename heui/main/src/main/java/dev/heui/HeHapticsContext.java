package dev.heui;

import android.content.Context;

/** Holds the application context so haptics can be triggered from anywhere. */
public final class HeHapticsContext {

    private static Context applicationContext;

    private HeHapticsContext() {
    }

    public static void install(Context context) {
        applicationContext = context == null ? null : context.getApplicationContext();
    }

    public static Context get() {
        return applicationContext;
    }
}
