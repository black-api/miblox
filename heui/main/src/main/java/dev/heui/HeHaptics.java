package dev.heui;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Haptic feedback.
 *
 * <p>MIUI applies its own vibration policy (and can block it in battery saver
 * mode), so every call is best-effort and never throws.
 */
public final class HeHaptics {

    private HeHaptics() {
    }

    public static void vibrate(int milliseconds) {
        if (milliseconds <= 0) {
            return;
        }
        try {
            Vibrator vibrator = resolveVibrator();
            if (vibrator == null || !vibrator.hasVibrator()) {
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(milliseconds);
            }
        } catch (Throwable ignored) {
            // Haptics are optional.
        }
    }

    @SuppressWarnings("deprecation")
    private static Vibrator resolveVibrator() {
        Context context = HeHapticsContext.get();
        if (context == null) {
            return null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }
}
