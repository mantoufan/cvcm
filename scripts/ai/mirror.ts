/**
 * Stage the AI tools' files and (with --upload) put them on s3.cv.cm, where the Worker serves them at /ai/.
 *
 *   node scripts/ai/mirror.mjs                      # download to tmp-verify/mirror (dev: VITE_AI_MODEL_HOST=/tmp-verify/mirror/)
 *   node scripts/ai/mirror.mjs --exports DIR        # take our own cvcm/* exports (scripts/ai/export-*.py OUT_ROOT)
 *   node scripts/ai/mirror.mjs --upload             # then PUT anything missing to files/ai/ (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)
 *
 * Layout (same on disk, in the bucket under ai/, and on the site under /ai/):
 *   models/{repo}/{revision}/{file}   pinned Hugging Face revisions; URLs never change, so they cache forever
 *   ort/{version}/ort-wasm-simd-threaded.asyncify.{mjs,wasm}   ONNX Runtime's WebAssembly build
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { AI_MODELS, mirrorFiles, type AiModelId } from "../../src/shared/ai-models";
import { presignS3Put, type S3Config } from "../../src/s3-sign";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? "" : null;
};
const root = resolve(process.cwd());
const out = resolve(flag("--out") ?? join(root, "tmp-verify/mirror"));
const exportsDir = flag("--exports");
const upload = args.includes("--upload");

const ORT_FILES = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];

async function size(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return -1;
  }
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, new Uint8Array(await res.arrayBuffer()));
}

/** Every file to publish: [path relative to out/, source]. */
async function stage(): Promise<string[]> {
  const rels: string[] = [];
  for (const id of Object.keys(AI_MODELS) as AiModelId[]) {
    const { repo, revision } = AI_MODELS[id];
    for (const file of mirrorFiles(id)) {
      const rel = `models/${repo}/${revision}/${file}`;
      const dest = join(out, rel);
      rels.push(rel);
      if (repo.startsWith("cvcm/")) {
        // Our own exports (not on Hugging Face): copy from the export scripts' output root when given.
        if (exportsDir) {
          await mkdir(dirname(dest), { recursive: true });
          await copyFile(join(exportsDir, repo.slice("cvcm/".length), file), dest);
        } else if ((await size(dest)) <= 0) {
          throw new Error(`${rel} missing: run scripts/ai/export-*.py OUT_ROOT and pass --exports OUT_ROOT`);
        }
        continue;
      }
      if ((await size(dest)) > 0) continue;
      console.log("download", rel);
      await download(`https://huggingface.co/${repo}/resolve/${revision}/${file}`, dest);
    }
  }
  const ortPkg = JSON.parse(await readFile(join(root, "node_modules/onnxruntime-web/package.json"), "utf8")) as { version: string };
  for (const file of ORT_FILES) {
    const rel = `ort/${ortPkg.version}/${file}`;
    rels.push(rel);
    await mkdir(join(out, dirname(rel)), { recursive: true });
    await copyFile(join(root, "node_modules/onnxruntime-web/dist", file), join(out, rel));
  }
  return rels;
}

function contentType(path: string): string {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".mjs")) return "text/javascript";
  return "application/octet-stream";
}

async function publish(rels: string[]): Promise<void> {
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secret = process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKey || !secret) throw new Error("set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  const cfg: S3Config = { accessKey, secret, host: "s3.cv.cm", bucket: "files", region: "us-east-1" };
  for (const rel of rels) {
    const path = join(out, rel);
    const bytes = await size(path);
    const key = `ai/${rel}`;
    const head = await fetch(`https://s3.cv.cm/files/${key}`, { method: "HEAD" });
    if (head.ok && Number(head.headers.get("content-length")) === bytes) continue;
    const type = contentType(rel);
    const url = await presignS3Put(cfg, key, new Date(), 3600, type, bytes);
    // curl, not fetch: s3.cv.cm answers a large PUT only after storing it, past fetch's 5-minute header timeout.
    const code = execFileSync("curl", [
      "-sS", "--noproxy", "*", "-o", "/dev/null", "-w", "%{http_code}",
      "-X", "PUT", "-H", `Content-Type: ${type}`, "--upload-file", path, url,
    ]).toString().trim();
    if (code !== "200") throw new Error(`PUT ${key}: HTTP ${code}`);
    const sum = createHash("sha256").update(await readFile(path)).digest("hex").slice(0, 12);
    console.log("uploaded", key, bytes, sum);
  }
}

const rels = await stage();
console.log(`staged ${rels.length} files in ${out}`);
if (upload) await publish(rels);
