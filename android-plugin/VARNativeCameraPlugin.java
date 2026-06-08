package com.ibna.app;

import android.Manifest;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Rect;
import android.graphics.SurfaceTexture;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CameraMetadata;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.camera2.params.MeteringRectangle;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.Log;
import android.graphics.Matrix;
import android.util.Range;
import android.util.Size;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(
    name = "VARNativeCamera",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class VARNativeCameraPlugin extends Plugin {

    private static final String TAG = "VARNativeCamera";

    private CameraDevice cameraDevice;
    private CameraCaptureSession captureSession;
    private CaptureRequest.Builder activeBuilder;
    private MediaRecorder mediaRecorder;
    private TextureView textureView;
    private FrameLayout previewContainer;
    private HandlerThread backgroundThread;
    private Handler backgroundHandler;

    private String currentCameraId;
    private String forcedCameraId = null;
    private boolean isFrontCamera = false;
    private boolean isRecording = false;
    private String currentVideoPath;

    // Settings
    private int targetWidth = 1920;
    private int targetHeight = 1080;
    private int targetFps = 60;

    // Advanced controls
    private float currentZoom = 1.0f;
    private float maxZoom = 1.0f;
    private boolean torchOn = false;
    private int exposureCompensation = 0;
    private Rect sensorArraySize;

    // Frame config
    private int frameX = 0;
    private int frameY = 0;
    private int frameWidth = 300;
    private int frameHeight = 225;
    private int frameBorderRadius = 8;

    private PluginCall pendingInitCall;
    private PluginCall pendingCameraOpenCall;  // Track call until preview is actually ready
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable cameraOpenTimeoutRunnable;

    // Tap-to-focus
    private GestureDetector gestureDetector;
    private Handler focusResetHandler;

    // ─── Lifecycle ───

    @PluginMethod
    public void initialize(PluginCall call) {
        String camera = call.getString("camera", "back");
        isFrontCamera = "front".equals(camera);
        forcedCameraId = call.getString("cameraId", null);

        JSObject frame = call.getObject("frame");
        if (frame != null) {
            frameX = frame.optInt("x", 0);
            frameY = frame.optInt("y", 0);
            frameWidth = frame.optInt("width", 300);
            frameHeight = frame.optInt("height", 225);
            frameBorderRadius = frame.optInt("borderRadius", 8);
        }

        targetWidth = call.getInt("width", 1920);
        targetHeight = call.getInt("height", 1080);
        targetFps = call.getInt("fps", 60);

        currentZoom = 1.0f;
        torchOn = false;
        exposureCompensation = 0;

        if (!hasCameraPermission()) {
            pendingInitCall = call;
            requestPermissionForAlias("camera", call, "handleCameraPermissionResult");
            return;
        }

        doInitialize(call);
    }

    private boolean hasCameraPermission() {
        return getPermissionState("camera") == PermissionState.GRANTED;
    }

    private boolean hasMicrophonePermission() {
        return getPermissionState("microphone") == PermissionState.GRANTED;
    }

    @PermissionCallback
    private void handleCameraPermissionResult(PluginCall call) {
        if (hasCameraPermission()) {
            doInitialize(call);
        } else {
            call.reject("Permesso fotocamera necessario per il VAR");
        }
    }

    @PermissionCallback
    private void handleMicrophonePermissionResult(PluginCall call) {
        if (hasMicrophonePermission()) {
            startRecording(call);
        } else {
            call.reject("Permesso microfono necessario per registrare il VAR");
        }
    }

    private void clearCameraOpenTimeout() {
        if (cameraOpenTimeoutRunnable != null) {
            mainHandler.removeCallbacks(cameraOpenTimeoutRunnable);
            cameraOpenTimeoutRunnable = null;
        }
    }

    private void scheduleCameraOpenTimeout() {
        clearCameraOpenTimeout();
        cameraOpenTimeoutRunnable = () -> {
            if (pendingCameraOpenCall == null) return;
            Log.e(TAG, "Camera open timed out before preview became ready");
            rejectPendingCameraOpenCall("Camera open timeout: preview non pronta");
            closeCamera();
            stopBackgroundThread();
            removePreview();
        };
        mainHandler.postDelayed(cameraOpenTimeoutRunnable, 10000);
    }

    private void resolvePendingCameraOpenCall() {
        clearCameraOpenTimeout();
        if (pendingCameraOpenCall != null) {
            pendingCameraOpenCall.resolve();
            pendingCameraOpenCall = null;
        }
    }

    private void rejectPendingCameraOpenCall(String message) {
        clearCameraOpenTimeout();
        if (pendingCameraOpenCall != null) {
            pendingCameraOpenCall.reject(message);
            pendingCameraOpenCall = null;
        }
    }

    private void doInitialize(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                setupPreview();
                startBackgroundThread();
                pendingCameraOpenCall = call;
                scheduleCameraOpenTimeout();
                openCamera();
            } catch (Exception e) {
                Log.e(TAG, "Initialize failed", e);
                rejectPendingCameraOpenCall("Initialize failed: " + e.getMessage());
                call.reject("Initialize failed: " + e.getMessage());
            }
        });
    }

    // ─── Recording ───

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (isRecording) {
            call.reject("Already recording");
            return;
        }
        if (!hasMicrophonePermission()) {
            requestPermissionForAlias("microphone", call, "handleMicrophonePermissionResult");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                setupMediaRecorder();
                createRecordingSession();
                mediaRecorder.start();
                isRecording = true;
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Start recording failed", e);
                call.reject("Start recording failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (!isRecording) {
            call.reject("Not recording");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                mediaRecorder.stop();
                mediaRecorder.reset();
                isRecording = false;
                startPreviewSession();
                JSObject result = new JSObject();
                result.put("videoUrl", currentVideoPath);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Stop recording failed", e);
                isRecording = false;
                call.reject("Stop recording failed: " + e.getMessage());
            }
        });
    }

    // ─── Camera selection ───

    @PluginMethod
    public void listCameras(PluginCall call) {
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            String[] ids = manager.getCameraIdList();
            JSArray cameras = new JSArray();
            Set<String> processedIds = new HashSet<>();

            Log.d(TAG, "Total camera IDs from system: " + ids.length);

            // Collect all camera IDs: logical + physical sub-cameras
            List<String> allCameraIds = new ArrayList<>();
            for (String id : ids) {
                allCameraIds.add(id);
            }

            // Enumerate physical sub-cameras from logical multi-camera devices (API 28+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                for (String id : ids) {
                    try {
                        CameraCharacteristics chars = manager.getCameraCharacteristics(id);
                        int[] capabilities = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
                        if (capabilities != null) {
                            for (int cap : capabilities) {
                                if (cap == CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA) {
                                    Set<String> physicalIds = chars.getPhysicalCameraIds();
                                    Log.d(TAG, "Logical camera " + id + " has " + physicalIds.size() + " physical sub-cameras: " + physicalIds);
                                    for (String physId : physicalIds) {
                                        if (!allCameraIds.contains(physId)) {
                                            allCameraIds.add(physId);
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to enumerate physical cameras for " + id, e);
                    }
                }
            }

            Log.d(TAG, "Total cameras (logical + physical): " + allCameraIds.size());

            for (String id : allCameraIds) {
                if (processedIds.contains(id)) continue;
                processedIds.add(id);

                try {
                    CameraCharacteristics chars = manager.getCameraCharacteristics(id);

                    // Include ALL cameras — don't filter by BACKWARD_COMPATIBLE
                    // Some devices report cameras without this flag but they still work
                    int[] capabilities = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
                    boolean hasBackwardCompat = false;
                    boolean isPhysicalSubCamera = !Arrays.asList(ids).contains(id);
                    if (capabilities != null) {
                        for (int cap : capabilities) {
                            if (cap == CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BACKWARD_COMPATIBLE) {
                                hasBackwardCompat = true;
                                break;
                            }
                        }
                    }
                    // Log but don't skip — include all cameras
                    if (!hasBackwardCompat) {
                        Log.d(TAG, "Camera " + id + " has no BACKWARD_COMPATIBLE but including anyway");
                    }

                    Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                    float[] focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
                    Float maxDigitalZoom = chars.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM);
                    Boolean flashAvailable = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                    Integer sensorOrientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION);
                    StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);

                    String facingStr = "unknown";
                    if (facing != null) {
                        switch (facing) {
                            case CameraCharacteristics.LENS_FACING_FRONT: facingStr = "front"; break;
                            case CameraCharacteristics.LENS_FACING_BACK: facingStr = "back"; break;
                            case CameraCharacteristics.LENS_FACING_EXTERNAL: facingStr = "external"; break;
                        }
                    }

                    // Classify lens type by focal length
                    String lensType = "standard";
                    float primaryFocal = 0;
                    if (focalLengths != null && focalLengths.length > 0) {
                        primaryFocal = focalLengths[0];
                        if ("back".equals(facingStr)) {
                            if (primaryFocal < 2.0f) lensType = "ultra-wide";
                            else if (primaryFocal < 3.5f) lensType = "wide";
                            else if (primaryFocal < 6.0f) lensType = "standard";
                            else if (primaryFocal < 10f) lensType = "telephoto";
                            else lensType = "super-telephoto";
                        }
                    }

                    // Check for physical camera capabilities (multi-camera)
                    boolean isLogical = false;
                    if (capabilities != null) {
                        for (int cap : capabilities) {
                            if (cap == CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA) {
                                isLogical = true;
                                break;
                            }
                        }
                    }

                    // Build friendly label
                    String label;
                    if ("front".equals(facingStr)) {
                        label = "Frontale" + (isLogical ? " (Multi)" : "") + (isPhysicalSubCamera ? " [Fisico]" : "") + " (ID " + id + ")";
                    } else if ("external".equals(facingStr)) {
                        label = "Esterna (ID " + id + ")";
                    } else {
                        switch (lensType) {
                            case "ultra-wide": label = "Ultra-grandangolare"; break;
                            case "wide": label = "Principale"; break;
                            case "standard": label = "Standard"; break;
                            case "telephoto": label = "Teleobiettivo"; break;
                            case "super-telephoto": label = "Super Teleobiettivo"; break;
                            default: label = "Camera"; break;
                        }
                        label += " (ID " + id + ")";
                        if (isLogical) label += " [Logica]";
                        if (isPhysicalSubCamera) label += " [Fisico]";
                    }

                    // Get max resolution
                    int maxResW = 0, maxResH = 0;
                    if (map != null) {
                        Size[] recSizes = map.getOutputSizes(MediaRecorder.class);
                        Size[] texSizes = map.getOutputSizes(SurfaceTexture.class);
                        Size[][] allSizes = { recSizes, texSizes };
                        for (Size[] sizes : allSizes) {
                            if (sizes != null) {
                                for (Size s : sizes) {
                                    if (s.getWidth() * s.getHeight() > maxResW * maxResH) {
                                        maxResW = s.getWidth();
                                        maxResH = s.getHeight();
                                    }
                                }
                            }
                        }
                    }

                    // Get max FPS
                    int maxFps = 30;
                    Range<Integer>[] fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);
                    if (fpsRanges != null) {
                        for (Range<Integer> r : fpsRanges) {
                            if (r.getUpper() > maxFps) maxFps = r.getUpper();
                        }
                    }
                    if (map != null) {
                        try {
                            Range<Integer>[] hsRanges = map.getHighSpeedVideoFpsRanges();
                            if (hsRanges != null) {
                                for (Range<Integer> r : hsRanges) {
                                    if (r.getUpper() > maxFps) maxFps = r.getUpper();
                                }
                            }
                        } catch (Exception ignored) {}
                    }

                    // Get AF modes
                    int[] afModes = chars.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES);
                    boolean supportsTapFocus = false;
                    if (afModes != null) {
                        for (int mode : afModes) {
                            if (mode == CameraCharacteristics.CONTROL_AF_MODE_AUTO ||
                                mode == CameraCharacteristics.CONTROL_AF_MODE_MACRO) {
                                supportsTapFocus = true;
                                break;
                            }
                        }
                    }

                    JSObject cam = new JSObject();
                    cam.put("id", id);
                    cam.put("facing", facingStr);
                    cam.put("lensType", lensType);
                    cam.put("label", label);
                    cam.put("focalLength", primaryFocal);
                    cam.put("maxDigitalZoom", maxDigitalZoom != null ? maxDigitalZoom : 1.0f);
                    cam.put("hasFlash", flashAvailable != null && flashAvailable);
                    cam.put("sensorOrientation", sensorOrientation != null ? sensorOrientation : 0);
                    cam.put("maxResolution", maxResW + "x" + maxResH);
                    cam.put("maxFps", maxFps);
                    cam.put("isLogical", isLogical);
                    cam.put("isPhysicalSubCamera", isPhysicalSubCamera);
                    cam.put("supportsTapFocus", supportsTapFocus);
                    cameras.put(cam);

                    Log.d(TAG, "Camera " + id + ": " + facingStr + " " + lensType
                        + " focal=" + primaryFocal + "mm maxZoom=" + maxDigitalZoom
                        + " flash=" + flashAvailable + " maxRes=" + maxResW + "x" + maxResH
                        + " maxFps=" + maxFps + " logical=" + isLogical
                        + " physicalSub=" + isPhysicalSubCamera + " tapFocus=" + supportsTapFocus);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to read camera " + id + ": " + e.getMessage());
                }
            }

            JSObject result = new JSObject();
            result.put("cameras", cameras);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "listCameras failed", e);
            call.reject("listCameras failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void selectCamera(PluginCall call) {
        String cameraId = call.getString("cameraId");
        if (cameraId == null || cameraId.isEmpty()) {
            call.reject("cameraId is required");
            return;
        }

        forcedCameraId = cameraId;

        // Determine facing from characteristics
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            CameraCharacteristics chars = manager.getCameraCharacteristics(cameraId);
            Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
            isFrontCamera = facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT;
        } catch (CameraAccessException e) {
            Log.w(TAG, "Could not read characteristics for " + cameraId);
        }

        // Reset zoom for new camera
        currentZoom = 1.0f;
        torchOn = false;
        exposureCompensation = 0;

        getActivity().runOnUiThread(() -> {
            try {
                closeCamera();
                pendingCameraOpenCall = call;
                openCamera();
                // Don't resolve here — wait for stateCallback.onOpened()
            } catch (Exception e) {
                pendingCameraOpenCall = null;
                Log.e(TAG, "selectCamera failed", e);
                call.reject("selectCamera failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void flipCamera(PluginCall call) {
        isFrontCamera = !isFrontCamera;
        forcedCameraId = null;
        currentZoom = 1.0f;
        torchOn = false;
        getActivity().runOnUiThread(() -> {
            try {
                closeCamera();
                openCamera();
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Flip camera failed", e);
                call.reject("Flip camera failed: " + e.getMessage());
            }
        });
    }

    // ─── Tap to focus ───

    @PluginMethod
    public void tapToFocus(PluginCall call) {
        float x = call.getFloat("x", 0.5f);
        float y = call.getFloat("y", 0.5f);
        performTapToFocus(x, y);
        call.resolve();
    }

    private void performTapToFocus(float normX, float normY) {
        if (activeBuilder == null || captureSession == null || sensorArraySize == null) return;

        getActivity().runOnUiThread(() -> {
            try {
                // Convert normalized coordinates to sensor coordinates
                int sensorW = sensorArraySize.width();
                int sensorH = sensorArraySize.height();

                // Account for sensor orientation
                int sensorOri = getSensorOrientation();
                float focusX, focusY;
                switch (sensorOri) {
                    case 90:
                        focusX = normY;
                        focusY = 1f - normX;
                        break;
                    case 270:
                        focusX = 1f - normY;
                        focusY = normX;
                        break;
                    case 180:
                        focusX = 1f - normX;
                        focusY = 1f - normY;
                        break;
                    default:
                        focusX = normX;
                        focusY = normY;
                        break;
                }

                if (isFrontCamera) {
                    focusX = 1f - focusX;
                }

                // Create metering rectangle (10% of sensor area)
                int meteringW = (int) (sensorW * 0.1f);
                int meteringH = (int) (sensorH * 0.1f);
                int centerX = (int) (focusX * sensorW);
                int centerY = (int) (focusY * sensorH);

                int left = Math.max(0, centerX - meteringW / 2);
                int top = Math.max(0, centerY - meteringH / 2);
                int right = Math.min(sensorW, left + meteringW);
                int bottom = Math.min(sensorH, top + meteringH);

                MeteringRectangle focusRect = new MeteringRectangle(
                    new Rect(left, top, right, bottom),
                    MeteringRectangle.METERING_WEIGHT_MAX
                );
                MeteringRectangle[] focusAreas = { focusRect };

                // Apply AF trigger
                activeBuilder.set(CaptureRequest.CONTROL_AF_REGIONS, focusAreas);
                activeBuilder.set(CaptureRequest.CONTROL_AE_REGIONS, focusAreas);
                activeBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_AUTO);
                activeBuilder.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_START);

                captureSession.setRepeatingRequest(activeBuilder.build(), new CameraCaptureSession.CaptureCallback() {
                    @Override
                    public void onCaptureCompleted(@NonNull CameraCaptureSession session,
                                                   @NonNull CaptureRequest request,
                                                   @NonNull TotalCaptureResult result) {
                        Integer afState = result.get(CaptureResult.CONTROL_AF_STATE);
                        if (afState != null && (
                            afState == CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED ||
                            afState == CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED)) {
                            // Reset to continuous AF after focus lock
                            if (focusResetHandler != null) {
                                focusResetHandler.removeCallbacksAndMessages(null);
                            }
                            if (focusResetHandler == null) {
                                focusResetHandler = new Handler(getActivity().getMainLooper());
                            }
                            focusResetHandler.postDelayed(() -> {
                                resetToContinuousAF();
                            }, 3000);
                        }
                    }
                }, backgroundHandler);

                // Cancel trigger on next frame
                activeBuilder.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);

                Log.d(TAG, "Tap to focus at (" + normX + ", " + normY + ") -> sensor (" + centerX + ", " + centerY + ")");
            } catch (Exception e) {
                Log.e(TAG, "tapToFocus failed", e);
            }
        });
    }

    private void resetToContinuousAF() {
        if (activeBuilder == null || captureSession == null) return;
        try {
            activeBuilder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
            activeBuilder.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_CANCEL);
            captureSession.setRepeatingRequest(activeBuilder.build(), null, backgroundHandler);

            // Clear the cancel trigger
            activeBuilder.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);
            Log.d(TAG, "Reset to continuous AF");
        } catch (Exception e) {
            Log.w(TAG, "resetToContinuousAF failed", e);
        }
    }

    // ─── Advanced controls ───

    @PluginMethod
    public void setZoom(PluginCall call) {
        float zoom = call.getFloat("zoom", 1.0f);
        currentZoom = Math.max(1.0f, Math.min(zoom, maxZoom));
        applyZoomToActiveSession();
        JSObject result = new JSObject();
        result.put("zoom", currentZoom);
        call.resolve(result);
    }

    @PluginMethod
    public void setTorch(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        torchOn = enabled;
        applyTorchToActiveSession();
        call.resolve();
    }

    @PluginMethod
    public void setExposureCompensation(PluginCall call) {
        int value = call.getInt("value", 0);
        exposureCompensation = value;
        applyExposureToActiveSession();
        call.resolve();
    }

    // ─── Frame & settings ───

    @PluginMethod
    public void updateFrame(PluginCall call) {
        frameX = call.getInt("x", frameX);
        frameY = call.getInt("y", frameY);
        frameWidth = call.getInt("width", frameWidth);
        frameHeight = call.getInt("height", frameHeight);
        frameBorderRadius = call.getInt("borderRadius", frameBorderRadius);

        getActivity().runOnUiThread(() -> {
            if (previewContainer != null) {
                float density = getActivity().getResources().getDisplayMetrics().density;
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) previewContainer.getLayoutParams();
                params.leftMargin = Math.round(frameX * density);
                params.topMargin = Math.round(frameY * density);
                params.width = Math.round(frameWidth * density);
                params.height = Math.round(frameHeight * density);
                previewContainer.setLayoutParams(params);
                previewContainer.requestLayout();
                applyBorderRadius();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void updateSettings(PluginCall call) {
        int newWidth = call.getInt("width", targetWidth);
        int newHeight = call.getInt("height", targetHeight);
        int newFps = call.getInt("fps", targetFps);

        boolean changed = (newWidth != targetWidth || newHeight != targetHeight || newFps != targetFps);
        targetWidth = newWidth;
        targetHeight = newHeight;
        targetFps = newFps;

        if (changed && cameraDevice != null && !isRecording) {
            getActivity().runOnUiThread(() -> {
                try {
                    startPreviewSession();
                } catch (Exception e) {
                    Log.e(TAG, "Update settings failed", e);
                }
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            String cameraId = currentCameraId != null ? currentCameraId : getCameraId(manager);
            CameraCharacteristics chars = manager.getCameraCharacteristics(cameraId);
            StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            Range<Integer>[] fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);

            JSObject result = new JSObject();

            // Resolutions - include ALL available sizes from both MediaRecorder and SurfaceTexture
            JSArray resolutions = new JSArray();
            if (map != null) {
                Size[] recSizes = map.getOutputSizes(MediaRecorder.class);
                Size[] texSizes = map.getOutputSizes(SurfaceTexture.class);
                
                // Merge all unique sizes
                Set<String> addedKeys = new HashSet<>();
                List<Size> allSizes = new ArrayList<>();
                for (Size[] sizes : new Size[][] { recSizes, texSizes }) {
                    if (sizes != null) {
                        for (Size s : sizes) {
                            String key = s.getWidth() + "x" + s.getHeight();
                            if (!addedKeys.contains(key)) {
                                addedKeys.add(key);
                                allSizes.add(s);
                            }
                        }
                    }
                }

                // Standard resolutions that we recognize
                int[][] standard = {
                    {7680, 4320}, {3840, 2160}, {2560, 1440}, {1920, 1080}, {1280, 720}, {640, 480}, {640, 360},
                };
                String[] labels = {"8K", "4K", "1440p", "1080p", "720p", "480p", "360p"};

                // First add standard recognized resolutions
                for (int i = 0; i < standard.length; i++) {
                    String key = standard[i][0] + "x" + standard[i][1];
                    if (addedKeys.contains(key)) {
                        JSObject res = new JSObject();
                        res.put("width", standard[i][0]);
                        res.put("height", standard[i][1]);
                        res.put("label", labels[i]);
                        resolutions.put(res);
                    }
                }

                // Then add any extra sizes not in the standard list (sorted by pixel count desc)
                allSizes.sort((a, b) -> (b.getWidth() * b.getHeight()) - (a.getWidth() * a.getHeight()));
                Set<String> standardKeys = new HashSet<>();
                for (int[] s : standard) standardKeys.add(s[0] + "x" + s[1]);
                
                for (Size s : allSizes) {
                    String key = s.getWidth() + "x" + s.getHeight();
                    if (!standardKeys.contains(key) && s.getWidth() >= 320) {
                        JSObject res = new JSObject();
                        res.put("width", s.getWidth());
                        res.put("height", s.getHeight());
                        res.put("label", s.getWidth() + "x" + s.getHeight());
                        resolutions.put(res);
                    }
                }
            }
            result.put("resolutions", resolutions);

            // FPS
            int maxHwFps = 0;
            if (fpsRanges != null) {
                for (Range<Integer> range : fpsRanges) {
                    if (range.getUpper() > maxHwFps) maxHwFps = range.getUpper();
                }
            }
            if (map != null) {
                try {
                    Range<Integer>[] hsRanges = map.getHighSpeedVideoFpsRanges();
                    if (hsRanges != null) {
                        for (Range<Integer> r : hsRanges) {
                            if (r.getUpper() > maxHwFps) maxHwFps = r.getUpper();
                        }
                    }
                } catch (Exception ignored) {}
            }

            int maxNormalFps = 0;
            if (fpsRanges != null) {
                for (Range<Integer> r : fpsRanges) {
                    if (r.getUpper() > maxNormalFps) maxNormalFps = r.getUpper();
                }
            }

            int[] standardFps = {240, 120, 60, 30, 24, 15};
            JSArray fpsArr = new JSArray();
            JSArray supportedFps = new JSArray();
            for (int fps : standardFps) {
                if (fps <= maxHwFps) {
                    supportedFps.put(fps);
                    JSObject fpsObj = new JSObject();
                    fpsObj.put("min", fps);
                    fpsObj.put("max", fps);
                    fpsArr.put(fpsObj);
                }
            }
            result.put("fpsRanges", fpsArr);
            result.put("supportedFps", supportedFps);
            result.put("maxNormalFps", maxNormalFps);
            result.put("maxHighSpeedFps", maxHwFps);

            // Zoom info
            Float maxDigitalZoom = chars.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM);
            result.put("maxZoom", maxDigitalZoom != null ? maxDigitalZoom : 1.0f);
            result.put("currentZoom", currentZoom);

            // Flash
            Boolean flashAvail = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
            result.put("hasFlash", flashAvail != null && flashAvail);
            result.put("torchOn", torchOn);

            // Exposure compensation
            Range<Integer> aeRange = chars.get(CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE);
            if (aeRange != null) {
                result.put("exposureCompensationMin", aeRange.getLower());
                result.put("exposureCompensationMax", aeRange.getUpper());
            } else {
                result.put("exposureCompensationMin", 0);
                result.put("exposureCompensationMax", 0);
            }
            result.put("exposureCompensation", exposureCompensation);

            // Current camera info
            result.put("currentCameraId", cameraId);

            // AF capabilities
            int[] afModes = chars.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES);
            boolean supportsTapFocus = false;
            if (afModes != null) {
                for (int mode : afModes) {
                    if (mode == CameraCharacteristics.CONTROL_AF_MODE_AUTO) {
                        supportsTapFocus = true;
                        break;
                    }
                }
            }
            result.put("supportsTapFocus", supportsTapFocus);

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "getCapabilities failed", e);
            call.reject("getCapabilities failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setPreviewVisible(PluginCall call) {
        boolean visible = call.getBoolean("visible", true);
        getActivity().runOnUiThread(() -> {
            if (previewContainer != null) {
                previewContainer.setVisibility(visible ? View.VISIBLE : View.GONE);
                Log.d(TAG, "Preview visibility set to: " + (visible ? "VISIBLE" : "GONE"));
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (isRecording) {
                    try { mediaRecorder.stop(); } catch (Exception ignored) {}
                    isRecording = false;
                }
                closeCamera();
                stopBackgroundThread();
                removePreview();
                activeBuilder = null;
                if (focusResetHandler != null) {
                    focusResetHandler.removeCallbacksAndMessages(null);
                    focusResetHandler = null;
                }
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Destroy failed", e);
                call.resolve();
            }
        });
    }

    // ─── Private helpers ───

    private void setupPreview() {
        float density = getActivity().getResources().getDisplayMetrics().density;

        previewContainer = new FrameLayout(getContext());
        previewContainer.setBackgroundColor(Color.BLACK);

        textureView = new TextureView(getContext());
        textureView.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // Setup tap-to-focus gesture
        gestureDetector = new GestureDetector(getContext(), new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onSingleTapUp(MotionEvent e) {
                if (textureView == null || previewContainer == null) return false;
                float normX = e.getX() / textureView.getWidth();
                float normY = e.getY() / textureView.getHeight();
                performTapToFocus(normX, normY);

                // Notify JS side about the tap
                JSObject data = new JSObject();
                data.put("x", normX);
                data.put("y", normY);
                notifyListeners("focusTap", data);
                return true;
            }
        });

        textureView.setOnTouchListener((v, event) -> {
            gestureDetector.onTouchEvent(event);
            return true;
        });

        previewContainer.addView(textureView);
        applyBorderRadius();

        // Add to WebView's parent — the proven approach for Capacitor plugins
        // This ensures the native view renders on top of the WebView
        ViewGroup webViewParent = (ViewGroup) getBridge().getWebView().getParent();

        ViewGroup.MarginLayoutParams containerParams = new ViewGroup.MarginLayoutParams(
            Math.round(frameWidth * density),
            Math.round(frameHeight * density)
        );
        containerParams.leftMargin = Math.round(frameX * density);
        containerParams.topMargin = Math.round(frameY * density);

        webViewParent.addView(previewContainer, containerParams);
        previewContainer.bringToFront();
        previewContainer.setElevation(100f);

        Log.d(TAG, "Preview added to WebView parent: " + frameWidth + "x" + frameHeight
            + " at (" + frameX + "," + frameY + ") density=" + density
            + " parent=" + webViewParent.getClass().getSimpleName()
            + " native px=" + containerParams.width + "x" + containerParams.height);
    }

    private void applyBorderRadius() {
        if (previewContainer == null) return;
        float density = getActivity().getResources().getDisplayMetrics().density;
        final float radius = frameBorderRadius * density;

        previewContainer.setOutlineProvider(new ViewOutlineProvider() {
            @Override
            public void getOutline(View view, Outline outline) {
                outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), radius);
            }
        });
        previewContainer.setClipToOutline(true);
    }

    private void removePreview() {
        if (previewContainer != null && previewContainer.getParent() != null) {
            ((ViewGroup) previewContainer.getParent()).removeView(previewContainer);
        }
        previewContainer = null;
        textureView = null;
        gestureDetector = null;
    }

    private void startBackgroundThread() {
        backgroundThread = new HandlerThread("VARCameraBackground");
        backgroundThread.start();
        backgroundHandler = new Handler(backgroundThread.getLooper());
    }

    private void stopBackgroundThread() {
        if (backgroundThread != null) {
            backgroundThread.quitSafely();
            try { backgroundThread.join(); } catch (InterruptedException ignored) {}
            backgroundThread = null;
            backgroundHandler = null;
        }
    }

    private String getCameraId(CameraManager manager) throws CameraAccessException {
        // If a specific camera was requested, use it directly
        if (forcedCameraId != null) {
            for (String id : manager.getCameraIdList()) {
                if (id.equals(forcedCameraId)) {
                    Log.d(TAG, "Using forced cameraId: " + forcedCameraId);
                    return id;
                }
            }
            Log.w(TAG, "Forced cameraId " + forcedCameraId + " not found, falling back");
        }

        // Fallback: find first camera matching requested facing
        for (String id : manager.getCameraIdList()) {
            CameraCharacteristics chars = manager.getCameraCharacteristics(id);
            Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
            if (facing != null) {
                if (isFrontCamera && facing == CameraCharacteristics.LENS_FACING_FRONT) return id;
                if (!isFrontCamera && facing == CameraCharacteristics.LENS_FACING_BACK) return id;
            }
        }
        return manager.getCameraIdList()[0];
    }

    @SuppressWarnings("MissingPermission")
    private void openCamera() {
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            currentCameraId = getCameraId(manager);

            // Cache sensor info for zoom and tap-to-focus
            CameraCharacteristics chars = manager.getCameraCharacteristics(currentCameraId);
            sensorArraySize = chars.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
            Float maxDZ = chars.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM);
            maxZoom = maxDZ != null ? maxDZ : 1.0f;
            currentZoom = Math.min(currentZoom, maxZoom);

            Log.d(TAG, "Opening camera " + currentCameraId + " maxZoom=" + maxZoom
                + " sensorArray=" + (sensorArraySize != null ? sensorArraySize.toString() : "null"));

            if (textureView == null) {
                rejectPendingCameraOpenCall("TextureView non inizializzata");
                return;
            }

            if (textureView.isAvailable()) {
                manager.openCamera(currentCameraId, stateCallback, backgroundHandler);
            } else {
                textureView.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
                    @Override
                    public void onSurfaceTextureAvailable(@NonNull SurfaceTexture surface, int w, int h) {
                        try {
                            manager.openCamera(currentCameraId, stateCallback, backgroundHandler);
                        } catch (Exception e) {
                            Log.e(TAG, "openCamera in listener failed", e);
                            rejectPendingCameraOpenCall("Open camera failed: " + e.getMessage());
                        }
                    }
                    @Override public void onSurfaceTextureSizeChanged(@NonNull SurfaceTexture surface, int w, int h) {}
                    @Override public boolean onSurfaceTextureDestroyed(@NonNull SurfaceTexture surface) { return true; }
                    @Override public void onSurfaceTextureUpdated(@NonNull SurfaceTexture surface) {}
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "openCamera failed", e);
            rejectPendingCameraOpenCall("Open camera failed: " + e.getMessage());
        }
    }

    private final CameraDevice.StateCallback stateCallback = new CameraDevice.StateCallback() {
        @Override
        public void onOpened(@NonNull CameraDevice camera) {
            cameraDevice = camera;
            Log.d(TAG, "Camera opened successfully: " + camera.getId());
            startPreviewSession();
        }
        @Override
        public void onDisconnected(@NonNull CameraDevice camera) {
            camera.close();
            cameraDevice = null;
            Log.w(TAG, "Camera disconnected");
            rejectPendingCameraOpenCall("Camera disconnected during open");
        }
        @Override
        public void onError(@NonNull CameraDevice camera, int error) {
            camera.close();
            cameraDevice = null;
            Log.e(TAG, "Camera error: " + error);
            // Notify JS about the error
            JSObject errData = new JSObject();
            errData.put("error", "Camera error code: " + error);
            notifyListeners("cameraError", errData);
            rejectPendingCameraOpenCall("Camera open failed with error: " + error);
        }
    };

    private void startPreviewSession() {
        if (cameraDevice == null || textureView == null || !textureView.isAvailable()) return;

        try {
            if (captureSession != null) {
                captureSession.close();
                captureSession = null;
            }

            SurfaceTexture surfaceTexture = textureView.getSurfaceTexture();
            Size previewSize = chooseOptimalSize(false);
            surfaceTexture.setDefaultBufferSize(previewSize.getWidth(), previewSize.getHeight());
            Surface previewSurface = new Surface(surfaceTexture);

            CaptureRequest.Builder builder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
            builder.addTarget(previewSurface);

            // FPS
            Range<Integer> fpsRange = chooseFpsRange();
            if (fpsRange != null) {
                builder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange);
            }

            // Stabilization
            if (targetFps > 30) {
                builder.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
                    CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF);
                builder.set(CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
                    CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF);
            } else {
                builder.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
                    CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_ON);
            }

            // AF, AE
            builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
            builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);

            // Sensor frame duration
            if (targetFps > 0) {
                long frameDurationNs = 1_000_000_000L / targetFps;
                builder.set(CaptureRequest.SENSOR_FRAME_DURATION, frameDurationNs);
            }

            // Low latency processing
            builder.set(CaptureRequest.NOISE_REDUCTION_MODE, CaptureRequest.NOISE_REDUCTION_MODE_FAST);
            builder.set(CaptureRequest.EDGE_MODE, CaptureRequest.EDGE_MODE_FAST);
            builder.set(CaptureRequest.TONEMAP_MODE, CaptureRequest.TONEMAP_MODE_FAST);
            builder.set(CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE,
                CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE_FAST);
            builder.set(CaptureRequest.CONTROL_AE_ANTIBANDING_MODE,
                CaptureRequest.CONTROL_AE_ANTIBANDING_MODE_AUTO);

            // Apply advanced controls
            applyZoomToBuilder(builder);
            applyTorchToBuilder(builder);
            applyExposureToBuilder(builder);

            // Store active builder for live adjustments
            activeBuilder = builder;
            final CaptureRequest.Builder captureBuilder = builder;

            cameraDevice.createCaptureSession(
                Collections.singletonList(previewSurface),
                new CameraCaptureSession.StateCallback() {
                    @Override
                    public void onConfigured(@NonNull CameraCaptureSession session) {
                        captureSession = session;
                        try {
                            session.setRepeatingRequest(captureBuilder.build(), null, backgroundHandler);
                            Log.d(TAG, "Preview started: " + previewSize + " @" + targetFps + "fps zoom=" + currentZoom);
                            applyCenterCropTransform(previewSize);
                            resolvePendingCameraOpenCall();
                        } catch (CameraAccessException e) {
                            Log.e(TAG, "Set repeating request failed", e);
                            rejectPendingCameraOpenCall("Preview request failed: " + e.getMessage());
                        }
                    }
                    @Override
                    public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                        Log.e(TAG, "Preview configuration failed");
                        rejectPendingCameraOpenCall("Preview configuration failed");
                    }
                },
                backgroundHandler
            );
        } catch (CameraAccessException e) {
            Log.e(TAG, "startPreviewSession failed", e);
        }
    }

    private void setupMediaRecorder() throws IOException {
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
        File videoDir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES), "VAR");
        if (!videoDir.exists()) videoDir.mkdirs();
        currentVideoPath = new File(videoDir, "VAR_" + timestamp + ".mp4").getAbsolutePath();

        Size recordSize = chooseOptimalSize(true);
        int bitrate = computeBitrate(recordSize.getWidth(), recordSize.getHeight(), targetFps);

        mediaRecorder = new MediaRecorder();
        mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        mediaRecorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        mediaRecorder.setOutputFile(currentVideoPath);

        mediaRecorder.setVideoEncodingBitRate(bitrate);
        mediaRecorder.setVideoFrameRate(targetFps);
        // Tell the encoder to actually capture at the target fps (some devices
        // ignore setVideoFrameRate without this hint, capping internally to 30).
        try { mediaRecorder.setCaptureRate(targetFps); } catch (Exception ignored) {}
        mediaRecorder.setVideoSize(recordSize.getWidth(), recordSize.getHeight());

        // Prefer HEVC (H.265) when available — half the bitrate for same quality;
        // fall back to H.264. We lock the H.264 profile/level via MediaFormat
        // after prepare() if HEVC isn't usable.
        boolean useHevc = false;
        try {
            mediaRecorder.setVideoEncoder(MediaRecorder.VideoEncoder.HEVC);
            useHevc = true;
        } catch (Exception e) {
            mediaRecorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        }

        // Encoder profile/level — High Profile @ L5.1 supports up to 4K60.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                if (useHevc) {
                    mediaRecorder.setVideoEncodingProfileLevel(
                        android.media.MediaCodecInfo.CodecProfileLevel.HEVCProfileMain,
                        android.media.MediaCodecInfo.CodecProfileLevel.HEVCMainTierLevel51);
                } else {
                    mediaRecorder.setVideoEncodingProfileLevel(
                        android.media.MediaCodecInfo.CodecProfileLevel.AVCProfileHigh,
                        android.media.MediaCodecInfo.CodecProfileLevel.AVCLevel51);
                }
            } catch (Exception ignored) {}
        }

        mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
        mediaRecorder.setAudioEncodingBitRate(192_000);
        mediaRecorder.setAudioSamplingRate(48_000);
        mediaRecorder.setAudioChannels(2);

        int rotation = getActivity().getWindowManager().getDefaultDisplay().getRotation();
        int sensorOrientation = getSensorOrientation();
        int hint = computeRecordingOrientation(rotation, sensorOrientation);
        mediaRecorder.setOrientationHint(hint);

        mediaRecorder.prepare();
        Log.d(TAG, "MediaRecorder prepared: " + recordSize + "@" + targetFps + "fps bitrate=" + bitrate
            + " codec=" + (useHevc ? "HEVC" : "H264"));
    }

    private void createRecordingSession() throws CameraAccessException {
        if (cameraDevice == null || textureView == null) return;

        if (captureSession != null) {
            captureSession.close();
            captureSession = null;
        }

        SurfaceTexture surfaceTexture = textureView.getSurfaceTexture();
        Size previewSize = chooseOptimalSize(false);
        surfaceTexture.setDefaultBufferSize(previewSize.getWidth(), previewSize.getHeight());
        Surface previewSurface = new Surface(surfaceTexture);
        Surface recorderSurface = mediaRecorder.getSurface();

        CaptureRequest.Builder builder = cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
        builder.addTarget(previewSurface);
        builder.addTarget(recorderSurface);

        Range<Integer> fpsRange = chooseFpsRange();
        if (fpsRange != null) {
            builder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, fpsRange);
        }

        builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO);
        builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);

        if (targetFps > 30) {
            builder.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
                CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_OFF);
            builder.set(CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
                CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_OFF);
        } else {
            builder.set(CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
                CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_ON);
        }

        if (targetFps > 0) {
            long frameDurationNs = 1_000_000_000L / targetFps;
            builder.set(CaptureRequest.SENSOR_FRAME_DURATION, frameDurationNs);
        }

        builder.set(CaptureRequest.NOISE_REDUCTION_MODE, CaptureRequest.NOISE_REDUCTION_MODE_FAST);
        builder.set(CaptureRequest.EDGE_MODE, CaptureRequest.EDGE_MODE_FAST);
        builder.set(CaptureRequest.TONEMAP_MODE, CaptureRequest.TONEMAP_MODE_FAST);
        builder.set(CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE,
            CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE_FAST);
        builder.set(CaptureRequest.CONTROL_AE_ANTIBANDING_MODE,
            CaptureRequest.CONTROL_AE_ANTIBANDING_MODE_AUTO);

        // Apply advanced controls to recording too
        applyZoomToBuilder(builder);
        applyTorchToBuilder(builder);
        applyExposureToBuilder(builder);

        activeBuilder = builder;
        final CaptureRequest.Builder captureBuilder = builder;

        cameraDevice.createCaptureSession(
            Arrays.asList(previewSurface, recorderSurface),
            new CameraCaptureSession.StateCallback() {
                @Override
                public void onConfigured(@NonNull CameraCaptureSession session) {
                    captureSession = session;
                    try {
                        session.setRepeatingRequest(captureBuilder.build(), null, backgroundHandler);
                        Log.d(TAG, "Recording session started @" + targetFps + "fps zoom=" + currentZoom);
                    } catch (CameraAccessException e) {
                        Log.e(TAG, "Recording session request failed", e);
                    }
                }
                @Override
                public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                    Log.e(TAG, "Recording session configuration failed");
                }
            },
            backgroundHandler
        );
    }

    // ─── Live parameter adjustments ───

    private void applyZoomToBuilder(CaptureRequest.Builder builder) {
        if (builder == null || sensorArraySize == null || currentZoom <= 1.0f) return;

        int cropW = (int) (sensorArraySize.width() / currentZoom);
        int cropH = (int) (sensorArraySize.height() / currentZoom);
        int cropX = (sensorArraySize.width() - cropW) / 2;
        int cropY = (sensorArraySize.height() - cropH) / 2;

        Rect cropRegion = new Rect(cropX, cropY, cropX + cropW, cropY + cropH);
        builder.set(CaptureRequest.SCALER_CROP_REGION, cropRegion);
    }

    private void applyZoomToActiveSession() {
        getActivity().runOnUiThread(() -> {
            if (activeBuilder != null && captureSession != null) {
                applyZoomToBuilder(activeBuilder);
                try {
                    captureSession.setRepeatingRequest(activeBuilder.build(), null, backgroundHandler);
                } catch (CameraAccessException e) {
                    Log.e(TAG, "applyZoom failed", e);
                }
            }
        });
    }

    private void applyTorchToBuilder(CaptureRequest.Builder builder) {
        if (builder == null) return;
        builder.set(CaptureRequest.FLASH_MODE,
            torchOn ? CaptureRequest.FLASH_MODE_TORCH : CaptureRequest.FLASH_MODE_OFF);
    }

    private void applyTorchToActiveSession() {
        getActivity().runOnUiThread(() -> {
            if (activeBuilder != null && captureSession != null) {
                applyTorchToBuilder(activeBuilder);
                try {
                    captureSession.setRepeatingRequest(activeBuilder.build(), null, backgroundHandler);
                } catch (CameraAccessException e) {
                    Log.e(TAG, "applyTorch failed", e);
                }
            }
        });
    }

    private void applyExposureToBuilder(CaptureRequest.Builder builder) {
        if (builder == null) return;
        builder.set(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, exposureCompensation);
    }

    private void applyExposureToActiveSession() {
        getActivity().runOnUiThread(() -> {
            if (activeBuilder != null && captureSession != null) {
                applyExposureToBuilder(activeBuilder);
                try {
                    captureSession.setRepeatingRequest(activeBuilder.build(), null, backgroundHandler);
                } catch (CameraAccessException e) {
                    Log.e(TAG, "applyExposure failed", e);
                }
            }
        });
    }

    // ─── Utility ───

    private void closeCamera() {
        if (captureSession != null) {
            captureSession.close();
            captureSession = null;
        }
        if (cameraDevice != null) {
            cameraDevice.close();
            cameraDevice = null;
        }
        if (mediaRecorder != null) {
            mediaRecorder.release();
            mediaRecorder = null;
        }
        activeBuilder = null;
    }

    private Size chooseOptimalSize(boolean forRecording) {
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            CameraCharacteristics chars = manager.getCameraCharacteristics(currentCameraId);
            StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            if (map == null) return new Size(targetWidth, targetHeight);

            Class<?> klass = forRecording ? MediaRecorder.class : SurfaceTexture.class;
            Size[] sizes = map.getOutputSizes(klass);
            if (sizes == null || sizes.length == 0) return new Size(targetWidth, targetHeight);

            // Filter sizes that can actually sustain targetFps. The sensor's
            // min frame duration (in ns) must be <= 1e9/fps, otherwise that
            // size will be silently capped (this is THE reason 1080p60 often
            // becomes 1080p30 on phones).
            long maxFrameDurationNs = targetFps > 0 ? (1_000_000_000L / targetFps) + 1_000_000L : Long.MAX_VALUE;
            List<Size> capableSizes = new ArrayList<>();
            for (Size size : sizes) {
                try {
                    long minDurNs = map.getOutputMinFrameDuration(klass, size);
                    if (minDurNs == 0 || minDurNs <= maxFrameDurationNs) capableSizes.add(size);
                } catch (Exception e) {
                    capableSizes.add(size);
                }
            }
            // If nothing matches the fps requirement, fall back to all sizes
            // (the camera will pick the closest fps it can do).
            List<Size> pool = capableSizes.isEmpty() ? Arrays.asList(sizes) : capableSizes;

            // Among capable sizes, prefer the one closest to target resolution.
            Size best = null;
            int bestDiff = Integer.MAX_VALUE;
            for (Size size : pool) {
                int diff = Math.abs(size.getWidth() - targetWidth) + Math.abs(size.getHeight() - targetHeight);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    best = size;
                }
            }
            Log.d(TAG, "chooseOptimalSize forRec=" + forRecording + " target="
                + targetWidth + "x" + targetHeight + "@" + targetFps
                + " capablePool=" + pool.size() + "/" + sizes.length
                + " picked=" + best);
            return best != null ? best : new Size(targetWidth, targetHeight);
        } catch (CameraAccessException e) {
            return new Size(targetWidth, targetHeight);
        }
    }

    private Range<Integer> chooseFpsRange() {
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            CameraCharacteristics chars = manager.getCameraCharacteristics(currentCameraId);
            Range<Integer>[] ranges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES);
            if (ranges == null || ranges.length == 0) return null;

            // 1. Exact [target, target]
            for (Range<Integer> r : ranges) {
                if (r.getLower() == targetFps && r.getUpper() == targetFps) return r;
            }
            // 2. Upper == target, highest lower
            Range<Integer> bestUpper = null;
            for (Range<Integer> r : ranges) {
                if (r.getUpper() == targetFps) {
                    if (bestUpper == null || r.getLower() > bestUpper.getLower()) bestUpper = r;
                }
            }
            if (bestUpper != null) return bestUpper;

            // 3. Upper >= target, closest
            Range<Integer> bestContaining = null;
            for (Range<Integer> r : ranges) {
                if (r.getUpper() >= targetFps) {
                    if (bestContaining == null ||
                        r.getUpper() - targetFps < bestContaining.getUpper() - targetFps ||
                        (r.getUpper() == bestContaining.getUpper() && r.getLower() > bestContaining.getLower())) {
                        bestContaining = r;
                    }
                }
            }
            if (bestContaining != null) return bestContaining;

            // 4. Highest available
            Range<Integer> highest = ranges[0];
            for (Range<Integer> r : ranges) {
                if (r.getUpper() > highest.getUpper()) highest = r;
            }
            return highest;
        } catch (CameraAccessException e) {
            return null;
        }
    }

    private int computeBitrate(int width, int height, int fps) {
        // Broadcast targets, scaled by fps because high-motion content needs
        // more bits/pixel to avoid compression artifacts.
        //  720p60  ≈ 12 Mbps | 1080p60 ≈ 28 Mbps
        // 1440p60  ≈ 50 Mbps | 4K60    ≈ 110 Mbps (capped)
        double bpp = fps >= 60 ? 0.13 : (fps >= 48 ? 0.11 : 0.10);
        long computed = (long) ((double) width * height * fps * bpp);
        return (int) Math.max(6_000_000L, Math.min(computed, 110_000_000L));
    }

    private int getSensorOrientation() {
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            CameraCharacteristics chars = manager.getCameraCharacteristics(currentCameraId);
            Integer orientation = chars.get(CameraCharacteristics.SENSOR_ORIENTATION);
            return orientation != null ? orientation : 0;
        } catch (CameraAccessException e) {
            return 0;
        }
    }

    private int computeRecordingOrientation(int displayRotation, int sensorOrientation) {
        int degrees = 0;
        switch (displayRotation) {
            case Surface.ROTATION_0: degrees = 0; break;
            case Surface.ROTATION_90: degrees = 90; break;
            case Surface.ROTATION_180: degrees = 180; break;
            case Surface.ROTATION_270: degrees = 270; break;
        }
        if (isFrontCamera) {
            return (sensorOrientation + degrees) % 360;
        } else {
            return (sensorOrientation - degrees + 360) % 360;
        }
    }

    private void applyCenterCropTransform(Size previewSize) {
        if (textureView == null || previewContainer == null) return;

        int viewWidth = previewContainer.getWidth();
        int viewHeight = previewContainer.getHeight();
        if (viewWidth == 0 || viewHeight == 0) return;

        int previewWidth = previewSize.getWidth();
        int previewHeight = previewSize.getHeight();

        int sensorOri = getSensorOrientation();
        if (sensorOri == 90 || sensorOri == 270) {
            int tmp = previewWidth;
            previewWidth = previewHeight;
            previewHeight = tmp;
        }

        float ratioView = (float) viewWidth / viewHeight;
        float ratioPreview = (float) previewWidth / previewHeight;

        float scaleX, scaleY;
        if (ratioView > ratioPreview) {
            scaleX = 1f;
            scaleY = ratioView / ratioPreview;
        } else {
            scaleX = ratioPreview / ratioView;
            scaleY = 1f;
        }

        Matrix matrix = new Matrix();
        matrix.setScale(scaleX, scaleY, viewWidth / 2f, viewHeight / 2f);
        textureView.setTransform(matrix);
    }
}
