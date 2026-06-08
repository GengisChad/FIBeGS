import { registerPlugin } from "@capacitor/core";

export interface VARNativeCameraPlugin {
  initialize(options: VARCameraOptions): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<{ videoUrl: string }>;
  flipCamera(): Promise<void>;
  updateFrame(options: VARFrameConfig): Promise<void>;
  updateSettings(options: { width?: number; height?: number; fps?: number }): Promise<void>;
  getCapabilities(): Promise<VARCameraCapabilities>;
  setPreviewVisible(options: { visible: boolean }): Promise<void>;
  destroy(): Promise<void>;

  /** List all available camera modules with detailed info */
  listCameras(): Promise<{ cameras: VARCameraInfo[] }>;

  /** Switch to a specific camera module by ID */
  selectCamera(options: { cameraId: string }): Promise<void>;

  /** Set digital zoom level (1.0 = no zoom) */
  setZoom(options: { zoom: number }): Promise<{ zoom: number }>;

  /** Toggle torch/flashlight */
  setTorch(options: { enabled: boolean }): Promise<void>;

  /** Set exposure compensation value */
  setExposureCompensation(options: { value: number }): Promise<void>;

  /** Tap to focus at normalized coordinates (0-1) */
  tapToFocus(options: { x: number; y: number }): Promise<void>;
}

export interface VARCameraOptions {
  camera: "front" | "back";
  cameraId?: string;  // Specific camera module ID (overrides camera)
  frame: VARFrameConfig;
  width?: number;
  height?: number;
  fps?: number;
}

export interface VARFrameConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface VARCameraInfo {
  id: string;
  facing: "front" | "back" | "external";
  lensType: "ultra-wide" | "wide" | "standard" | "telephoto" | "super-telephoto";
  label: string;
  focalLength: number;
  maxDigitalZoom: number;
  hasFlash: boolean;
  sensorOrientation: number;
  maxResolution: string;
  maxFps: number;
  isLogical?: boolean;
  isPhysicalSubCamera?: boolean;
  supportsTapFocus?: boolean;
}

export interface VARCameraCapabilities {
  resolutions: Array<{ width: number; height: number; label: string }>;
  fpsRanges: Array<{ min: number; max: number }>;
  supportedFps: number[];
  maxZoom: number;
  currentZoom: number;
  hasFlash: boolean;
  torchOn: boolean;
  exposureCompensationMin: number;
  exposureCompensationMax: number;
  exposureCompensation: number;
  currentCameraId: string;
  supportsTapFocus?: boolean;
}

const VARNativeCamera = registerPlugin<VARNativeCameraPlugin>("VARNativeCamera");

export default VARNativeCamera;
