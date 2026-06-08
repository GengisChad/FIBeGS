package com.ibna.app;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/**
 * Helper class to enable full immersive mode on Android.
 * Hides both the status bar and the navigation bar (buttons or gesture bar).
 *
 * Usage in MainActivity.java:
 *
 *   import com.ibna.app.ImmersiveModeHelper;
 *
 *   @Override
 *   public void onCreate(Bundle savedInstanceState) {
 *       super.onCreate(savedInstanceState);
 *       ImmersiveModeHelper.enable(this);
 *   }
 *
 *   @Override
 *   public void onWindowFocusChanged(boolean hasFocus) {
 *       super.onWindowFocusChanged(hasFocus);
 *       if (hasFocus) {
 *           ImmersiveModeHelper.enable(this);
 *       }
 *   }
 */
public class ImmersiveModeHelper {

    public static void enable(Activity activity) {
        Window window = activity.getWindow();

        // Extend content behind system bars
        window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // API 30+ (Android 11+): Use WindowInsetsController
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                // Hide both status bar and navigation bar
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                // Allow temporary reveal with swipe, then auto-hide again
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            }
        } else {
            // API < 30: Use legacy system UI flags
            View decorView = window.getDecorView();
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }
}
