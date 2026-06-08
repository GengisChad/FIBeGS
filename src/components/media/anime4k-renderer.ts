/**
 * Anime4K Video Enhancement Renderer
 *
 * Strategy:
 * 1. WebGPU primary — uses anime4k-webgpu npm package (CNN upscale + GAN restore)
 * 2. WebGL fallback — lightweight unsharp-mask shader for devices without WebGPU
 *
 * All processing runs on the device GPU — zero network, zero cloud.
 */

// ── WebGL fallback shader (simple sharpen + saturation) ──
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_COMPAT = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform vec2 u_texelSize;
  uniform float u_strength;

  void main() {
    vec3 c  = texture2D(u_texture, v_texCoord).rgb;
    vec3 l  = texture2D(u_texture, v_texCoord + vec2(-u_texelSize.x, 0.0)).rgb;
    vec3 r  = texture2D(u_texture, v_texCoord + vec2( u_texelSize.x, 0.0)).rgb;
    vec3 t  = texture2D(u_texture, v_texCoord + vec2(0.0, -u_texelSize.y)).rgb;
    vec3 b  = texture2D(u_texture, v_texCoord + vec2(0.0,  u_texelSize.y)).rgb;

    vec3 avg = (l + r + t + b) * 0.25;
    vec3 detail = c - avg;
    vec3 sharpened = c + detail * (0.8 + u_strength * 1.6);

    float lum = dot(sharpened, vec3(0.2126, 0.7152, 0.0722));
    vec3 saturated = mix(vec3(lum), sharpened, 1.0 + u_strength * 0.12);
    gl_FragColor = vec4(clamp(saturated, 0.0, 1.0), 1.0);
  }
`;

export type Anime4KStrength = "basic" | "ai";

export type Anime4KError = {
  stage: string;
  message: string;
  details?: string;
};

type RendererBackend = "webgpu" | "webgl" | "none";

export class Anime4KRenderer {
  private canvas: HTMLCanvasElement;
  private _active = false;
  private _failed = false;
  private _error: Anime4KError | null = null;
  private _backend: RendererBackend = "none";
  private strength: number = 0.6;
  private video: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;

  // WebGPU state
  private webgpuCleanup: (() => void) | null = null;

  // WebGL fallback state
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uTexelSize: WebGLUniformLocation | null = null;
  private uStrength: WebGLUniformLocation | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** Async init — tries WebGPU first, then WebGL fallback */
  async init(): Promise<void> {
    // Try WebGPU
    if (this.isWebGPUSupported()) {
      try {
        await this.initWebGPU();
        this._backend = "webgpu";
        console.log("Anime4K: using WebGPU backend (anime4k-webgpu)");
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("Anime4K: WebGPU init failed, falling back to WebGL.", msg);
      }
    }

    // Try WebGL fallback
    try {
      this.initWebGL();
      this._backend = "webgl";
      console.log("Anime4K: using WebGL fallback backend");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.fail("init", "Neither WebGPU nor WebGL available", msg);
    }
  }

  private isWebGPUSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  // ── WebGPU init using anime4k-webgpu npm package ──
  private async initWebGPU(): Promise<void> {
    // Optional runtime dependency — hidden from Vite static analysis
    const mod = "anime4k-" + "webgpu";
    const { render, CNNUL, GANUUL } = await (Function('m', 'return import(m)')(mod));

    // We can't call render() yet — we need the video element.
    // Store the render function for later use in start().
    this._webgpuRender = render;
    this._webgpuPipelines = { CNNUL, GANUUL };
  }

  // stored references for lazy WebGPU start
  private _webgpuRender: any = null;
  private _webgpuPipelines: any = null;

  private async startWebGPU(video: HTMLVideoElement): Promise<void> {
    if (!this._webgpuRender || !this._webgpuPipelines) {
      throw new Error("WebGPU not initialized");
    }

    const { CNNUL, GANUUL } = this._webgpuPipelines;
    const useAI = this.strength > 0.7;

    console.log(`Anime4K: starting WebGPU pipeline (mode=${useAI ? "AI" : "basic"}, strength=${this.strength})`);

    // The render() function from anime4k-webgpu sets up the entire pipeline
    // and starts rendering automatically. It returns a cleanup function.
    const cleanup = await this._webgpuRender({
      video,
      canvas: this.canvas,
      pipelineBuilder: (device: GPUDevice, inputTexture: GPUTexture) => {
        if (useAI) {
          // "AI" mode: upscale + restore
          const upscale = new CNNUL({ device, inputTexture });
          const restore = new GANUUL({
            device,
            inputTexture: upscale.getOutputTexture(),
          });
          return [upscale, restore];
        } else {
          // "Basic" mode: restore only (lighter)
          const restore = new GANUUL({ device, inputTexture });
          return [restore];
        }
      },
    });

    this.webgpuCleanup = typeof cleanup === "function" ? cleanup : null;
    console.log("Anime4K: WebGPU pipeline started successfully");
  }

  // ── WebGL fallback init ──
  private initWebGL(): void {
    const gl = this.canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL not available");

    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_COMPAT);
    if (!vs || !fs) throw new Error("Shader compile failed");

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) || "unknown";
      throw new Error(`Shader link failed: ${info}`);
    }
    this.program = program;
    gl.useProgram(program);

    // Fullscreen quad
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1, 1, 1, 0, 0,
      0, 0, 1, 1, 1, 0,
    ]), gl.STATIC_DRAW);
    const aTex = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(aTex);
    gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.uTexelSize = gl.getUniformLocation(program, "u_texelSize");
    this.uStrength = gl.getUniformLocation(program, "u_strength");

    gl.deleteShader(vs);
    gl.deleteShader(fs);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || "unknown";
      gl.deleteShader(shader);
      throw new Error(`Shader compile: ${info}`);
    }
    return shader;
  }

  private fail(stage: string, message: string, details?: string) {
    this._failed = true;
    this._error = { stage, message, details };
    console.error(`Anime4K [${stage}]: ${message}`, details || "");
  }

  get failed() { return this._failed; }
  get error(): Anime4KError | null { return this._error; }
  get backend(): RendererBackend { return this._backend; }

  get active() {
    return this._active && !this._failed;
  }

  setStrength(mode: Anime4KStrength) {
    this.strength = mode === "basic" ? 0.5 : 0.85;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    if (this._failed || this._backend === "none") return;

    // If already active, stop and rebuild pipeline
    if (this._active) {
      console.log("Anime4K: rebuilding pipeline for new strength");
      this.stopInternal();
    }

    this.video = video;
    this._active = true;

    if (this._backend === "webgpu") {
      try {
        await this.startWebGPU(video);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        
        // Check for CORS error
        if (msg.includes("cross-origin") || msg.includes("tainted") || msg.includes("SecurityError")) {
          this.fail("cors", "Video cross-origin: enhance non disponibile", msg);
          this._active = false;
          return;
        }

        console.warn("Anime4K: WebGPU start failed, switching to WebGL.", msg);

        // Fallback to WebGL
        try {
          this.initWebGL();
          this._backend = "webgl";
          this.renderLoopWebGL();
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          this.fail("start", "All backends failed", `WebGPU: ${msg} | WebGL: ${msg2}`);
          this._active = false;
        }
      }
    } else {
      this.renderLoopWebGL();
    }
  }

  /** Internal stop without clearing video ref */
  private stopInternal() {
    this._active = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.webgpuCleanup) {
      this.webgpuCleanup();
      this.webgpuCleanup = null;
    }
  }

  stop() {
    this.stopInternal();
    this.video = null;
  }

  private renderLoopWebGL = () => {
    if (!this._active || !this.video || !this.gl || !this.program) return;

    const gl = this.gl;
    const video = this.video;

    const vw = video.videoWidth || video.clientWidth;
    const vh = video.videoHeight || video.clientHeight;
    if (this.canvas.width !== vw || this.canvas.height !== vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
      gl.viewport(0, 0, vw, vh);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      this.canvas.style.opacity = "0";
      this.animFrameId = requestAnimationFrame(this.renderLoopWebGL);
      return;
    }
    this.canvas.style.opacity = "1";

    gl.uniform2f(this.uTexelSize, 1.0 / vw, 1.0 / vh);
    gl.uniform1f(this.uStrength, this.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.animFrameId = requestAnimationFrame(this.renderLoopWebGL);
  };

  destroy() {
    this.stop();
    if (this.gl) {
      const ext = this.gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    }
    this.gl = null;
    this.program = null;
    this.texture = null;
    this._webgpuRender = null;
    this._webgpuPipelines = null;
  }
}
