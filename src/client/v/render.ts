/**
 * 2.5D parallax in one WebGL2 pass: each output pixel marches a ray through the depth map from near to far and
 * takes the photo's color where the ray meets the surface, so near things cover what is behind them.
 */
import type { Camera } from "../../shared/parallax";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPhoto;
uniform sampler2D uDepth;
uniform vec2 uOffset;
uniform float uZoom;
uniform float uDolly;
uniform float uFocus;
uniform vec2 uScale;
uniform vec4 uCrop;
in vec2 vUv;
out vec4 outColor;

vec2 project(float layer) {
  float d = layer - uFocus;
  vec2 c = (vUv - 0.5) / (uZoom * (1.0 + uDolly * d));
  return 0.5 + c + uOffset * d * uScale;
}

vec2 photoUv(vec2 p) {
  return uCrop.xy + clamp(p, 0.0, 1.0) * uCrop.zw;
}

float surface(float layer) {
  return texture(uDepth, photoUv(project(layer))).r;
}

void main() {
  const int STEPS = 48;
  float above = 1.0;
  float layer = 1.0;
  for (int i = 0; i <= STEPS; i++) {
    layer = 1.0 - float(i) / float(STEPS);
    if (surface(layer) >= layer) break;
    above = layer;
  }
  float lo = layer;
  float hi = above;
  for (int i = 0; i < 6; i++) {
    float mid = 0.5 * (lo + hi);
    if (surface(mid) >= mid) lo = mid; else hi = mid;
  }
  outColor = texture(uPhoto, photoUv(project(lo)));
}`;

export type Crop = { x: number; y: number; w: number; h: number };

export class ParallaxRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private photo: WebGLTexture;
  private depth: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private crop: Crop = { x: 0, y: 0, w: 1, h: 1 };

  /** Throws if the browser has no WebGL2. */
  constructor(readonly canvas: HTMLCanvasElement, opts: { keepFrame?: boolean } = {}) {
    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: opts.keepFrame ?? false });
    if (!gl) throw new Error("webgl2");
    this.gl = gl;
    this.program = link(gl, VERT, FRAG);
    gl.useProgram(this.program);
    for (const name of ["uPhoto", "uDepth", "uOffset", "uZoom", "uDolly", "uFocus", "uScale", "uCrop"]) {
      this.loc[name] = gl.getUniformLocation(this.program, name);
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(this.program, "aPos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    this.photo = texture(gl);
    this.depth = texture(gl);
    gl.uniform1i(this.loc.uPhoto, 0);
    gl.uniform1i(this.loc.uDepth, 1);
    gl.uniform1f(this.loc.uFocus, 0.5);
    this.setDepth(null);
  }

  setPhoto(source: TexImageSource): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photo);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  /** Depth bytes, 0 = far … 255 = near. Null is a flat plane at the focus (no parallax, zoom only). */
  setDepth(depth: { data: Uint8Array; width: number; height: number } | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depth);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (depth) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, depth.width, depth.height, 0, gl.RED, gl.UNSIGNED_BYTE, depth.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([128]));
  }

  setCrop(crop: Crop): void {
    this.crop = crop;
  }

  draw(cam: Camera): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(this.loc.uOffset, cam.ox, cam.oy);
    gl.uniform1f(this.loc.uZoom, cam.zoom);
    gl.uniform1f(this.loc.uDolly, cam.dolly);
    // Offsets are in short-side lengths: the same move on a wide and a tall frame, never past the zoom margin.
    gl.uniform2f(this.loc.uScale, Math.min(1, height / width), Math.min(1, width / height));
    gl.uniform4f(this.loc.uCrop, this.crop.x, this.crop.y, this.crop.w, this.crop.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function texture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader");
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link");
  return program;
}

/**
 * Grow near areas by a couple of pixels, then soften. Photo edges blend foreground and background colors;
 * without this the blended rim stays behind on the background as a ghost outline when the camera moves.
 */
export function prepareDepth(src: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const grown = new Uint8Array(src.length);
  const r = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx++) {
          const v = src[yy * width + Math.min(width - 1, Math.max(0, x + dx))];
          if (v > m) m = v;
        }
      }
      grown[y * width + x] = m;
    }
  }
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) sum += grown[yy * width + Math.min(width - 1, Math.max(0, x + dx))];
      }
      out[y * width + x] = Math.round(sum / 9);
    }
  }
  return out;
}
