import type { AiBackend } from "../../shared/ai-models";

/** The slice of WebGPU this site uses (no @webgpu/types dependency). */
type GpuAdapter = { features: { has(feature: string): boolean } };
type Gpu = { requestAdapter(options?: { powerPreference?: "high-performance" | "low-power" }): Promise<GpuAdapter | null> };

/** WebGPU when the browser has a usable adapter (with 16-bit floats when it can), else WebAssembly on the CPU. */
export async function detectBackend(nav: Navigator | WorkerNavigator): Promise<AiBackend> {
  const gpu = (nav as { gpu?: Gpu }).gpu;
  if (!gpu) return "cpu";
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return "cpu";
    return adapter.features.has("shader-f16") ? "gpu16" : "gpu";
  } catch {
    return "cpu";
  }
}
