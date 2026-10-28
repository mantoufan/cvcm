#!/usr/bin/env python3
"""Export Real-ESRGAN's compact upscalers (BSD-3-Clause, xinntao/Real-ESRGAN v0.2.5.0) to ONNX.

SRVGGNetCompact is a plain conv stack (1.2M / 0.6M parameters), so the image upscaler downloads a few MB and runs
a tile in tens of milliseconds on WebGPU, where Swin2SR took seconds.

Needs Python 3.12 with: torch onnx onnxconverter-common onnxruntime
Usage: export-realesrgan.py OUT_DIR
Writes OUT_DIR/{realesrgan-general-x4v3,realesrgan-anime-x4v3}/{config.json,onnx/model.onnx,onnx/model_fp16.onnx}.
"""
import json
import os
import sys
import urllib.request

import numpy as np
import onnx
import torch
import torch.nn.functional as F
from onnxconverter_common import float16
from torch import nn

RELEASE = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0"
MODELS = {
    "realesrgan-general-x4v3": ("realesr-general-x4v3.pth", 32),
    "realesrgan-anime-x4v3": ("realesr-animevideov3.pth", 16),
}


class SRVGGNetCompact(nn.Module):
    """Same layout as realesrgan.archs.srvgg_arch, so the released state dicts load as-is."""

    def __init__(self, num_conv, num_feat=64, upscale=4):
        super().__init__()
        self.upscale = upscale
        body = [nn.Conv2d(3, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)]
        for _ in range(num_conv):
            body += [nn.Conv2d(num_feat, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)]
        body.append(nn.Conv2d(num_feat, 3 * upscale * upscale, 3, 1, 1))
        self.body = nn.ModuleList(body)
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        return out + F.interpolate(x, scale_factor=self.upscale, mode="nearest")


def main():
    out_root = sys.argv[1]
    import onnxruntime as ort

    ort.set_default_logger_severity(3)
    for name, (weights, num_conv) in MODELS.items():
        out = os.path.join(out_root, name)
        os.makedirs(os.path.join(out, "onnx"), exist_ok=True)
        pth = os.path.join(out, weights)
        if not os.path.exists(pth):
            urllib.request.urlretrieve(f"{RELEASE}/{weights}", pth)
        state = torch.load(pth, map_location="cpu", weights_only=True)
        model = SRVGGNetCompact(num_conv)
        model.load_state_dict(state.get("params", state))
        model.eval()
        fp32 = os.path.join(out, "onnx", "model.onnx")
        fp16 = os.path.join(out, "onnx", "model_fp16.onnx")
        with torch.no_grad():
            torch.onnx.export(
                model, torch.rand(1, 3, 64, 64), fp32,
                input_names=["pixel_values"], output_names=["reconstruction"],
                dynamic_axes={"pixel_values": {2: "height", 3: "width"}, "reconstruction": {2: "out_height", 3: "out_width"}},
                opset_version=17, dynamo=False,
            )
        onnx.save(float16.convert_float_to_float16(onnx.load(fp32), keep_io_types=True), fp16)
        x = np.random.RandomState(0).rand(1, 3, 96, 80).astype(np.float32)
        ref = model(torch.from_numpy(x)).detach().numpy()
        a = ort.InferenceSession(fp32, providers=["CPUExecutionProvider"]).run(None, {"pixel_values": x})[0]
        b = ort.InferenceSession(fp16, providers=["CPUExecutionProvider"]).run(None, {"pixel_values": x})[0]
        print(name, "onnx vs torch", float(np.abs(a - ref).max()), "fp16 vs fp32", float(np.abs(a - b).max()))
        with open(os.path.join(out, "config.json"), "w") as f:
            json.dump({"model_type": "srvggnet", "upscale": 4, "num_conv": num_conv, "source": f"{RELEASE}/{weights}"}, f)
        os.remove(pth)
        for file in ("onnx/model.onnx", "onnx/model_fp16.onnx"):
            print(" ", file, os.path.getsize(os.path.join(out, file)))


if __name__ == "__main__":
    main()
