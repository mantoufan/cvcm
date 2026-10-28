#!/usr/bin/env python3
"""Export BiRefNet lite (MIT, ZhengPeng7/BiRefNet_lite) to ONNX for the background remover.

Why not onnx-community/BiRefNet_lite-ONNX: that export unrolls deformable convolution into GatherND chains whose
intermediates reach 411 MB each (over 4 GB at 1024 px), which no browser holds. Here torchvision's deform_conv2d
maps to ONNX's own DeformConv (opset 19): ONNX Runtime runs it on the CPU (threaded WASM) and the rest on WebGPU.

The fp16 copy keeps DeformConv and the shape arithmetic in fp32; masks differ from fp32 by about 1e-5 on average.

Needs Python 3.12 with: torch torchvision timm einops kornia transformers onnx onnxconverter-common onnxruntime
Usage: export-birefnet.py OUT_ROOT [SIZE=1024]
Writes OUT_ROOT/birefnet-lite-{SIZE}/{config.json,preprocessor_config.json,onnx/model.onnx,onnx/model_fp16.onnx}.
"""
import json
import os
import sys

import numpy as np
import onnx
import torch
from onnx import helper
from onnxconverter_common import float16
from torch.onnx import register_custom_op_symbolic
from torch.onnx import symbolic_helper as sh
from transformers import AutoModelForImageSegmentation

REPO = "ZhengPeng7/BiRefNet_lite"
REVISION = "aa62cd87eafb9cc43056d08ef3615a14628b831d"
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


@sh.parse_args("v", "v", "v", "v", "v", "i", "i", "i", "i", "i", "i", "i", "i", "b")
def deform_conv(g, x, w, offset, mask, bias, stride_h, stride_w, pad_h, pad_w, dil_h, dil_w, groups, offset_groups, use_mask):
    inputs = [x, w, offset, bias] + ([mask] if use_mask else [])
    return g.op(
        "DeformConv", *inputs,
        dilations_i=[dil_h, dil_w], group_i=groups, offset_group_i=offset_groups,
        pads_i=[pad_h, pad_w, pad_h, pad_w], strides_i=[stride_h, stride_w],
    )


class Last(torch.nn.Module):
    """BiRefNet returns every decoder stage; the page needs only the final logits."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, x):
        return self.model(x)[-1]


def export_fp32(path, size):
    register_custom_op_symbolic("torchvision::deform_conv2d", deform_conv, 19)
    model = AutoModelForImageSegmentation.from_pretrained(REPO, revision=REVISION, trust_remote_code=True).eval()
    with torch.no_grad():
        torch.onnx.export(
            Last(model), torch.randn(1, 3, size, size), path,
            input_names=["input_image"], output_names=["output_image"],
            opset_version=19, dynamo=False, do_constant_folding=True,
        )


def to_fp16(src, dst):
    model = onnx.shape_inference.infer_shapes(onnx.load(src))
    graph = model.graph
    consts = {i.name for i in graph.initializer}
    shape_math, keep = set(), []
    # Shape / Size and everything computed only from them stays fp32 (the converter mistypes those chains).
    for node in graph.node:
        ins = [i for i in node.input if i]
        if node.op_type in ("Shape", "Size"):
            shape_math.update(node.output)
            keep.append(node.name)
        elif node.op_type == "Constant":
            consts.update(node.output)
        elif ins and all(i in shape_math or i in consts for i in ins) and any(i in shape_math for i in ins):
            shape_math.update(node.output)
            keep.append(node.name)
    kept = set(keep)
    half = float16.convert_float_to_float16(
        model, keep_io_types=True,
        op_block_list=list(float16.DEFAULT_OP_BLOCK_LIST) + ["DeformConv"], node_block_list=keep,
    )
    types = {v.name: v.type.tensor_type.elem_type for v in list(graph.value_info) + list(graph.output)}
    nodes, cast_of = [], {}
    for node in half.graph.node:
        if node.name not in kept and node.op_type != "DeformConv":
            for k, name in enumerate(node.input):
                if name in shape_math and types.get(name) == onnx.TensorProto.FLOAT:
                    if name not in cast_of:
                        cast_of[name] = f"{name}/to_fp16"
                        nodes.append(helper.make_node("Cast", [name], [cast_of[name]], name=cast_of[name], to=onnx.TensorProto.FLOAT16))
                    node.input[k] = cast_of[name]
        nodes.append(node)
    del half.graph.node[:]
    half.graph.node.extend(nodes)
    # Casts to float32 inside the converted graph (Swin's bool mask → float) now feed fp16 ops.
    consumers = {}
    for node in half.graph.node:
        for name in node.input:
            consumers.setdefault(name, []).append(node)
    outputs = {o.name for o in half.graph.output}
    for node in half.graph.node:
        if node.op_type != "Cast" or node.name in kept or node.output[0] in outputs:
            continue
        to = next(a for a in node.attribute if a.name == "to")
        users = consumers.get(node.output[0], [])
        if to.i == onnx.TensorProto.FLOAT and users and all(u.name not in kept and u.op_type not in ("DeformConv", "Shape") for u in users):
            to.i = onnx.TensorProto.FLOAT16
    del half.graph.value_info[:]
    onnx.save(half, dst)


def check(fp32, fp16, size):
    import onnxruntime as ort

    ort.set_default_logger_severity(3)
    rng = np.random.RandomState(0)
    # A soft blob on noise: enough structure that the mask is not all background.
    yy, xx = np.mgrid[0:size, 0:size] / size
    blob = (((yy - 0.5) ** 2 + (xx - 0.5) ** 2) < 0.08).astype(np.float32)
    img = np.clip(rng.rand(size, size, 3) * 0.3 + blob[..., None] * 0.6, 0, 1)
    x = ((img - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)
    a = ort.InferenceSession(fp32, providers=["CPUExecutionProvider"]).run(None, {"input_image": x})[0]
    b = ort.InferenceSession(fp16, providers=["CPUExecutionProvider"]).run(None, {"input_image": x})[0]
    diff = np.abs(1 / (1 + np.exp(-a)) - 1 / (1 + np.exp(-b)))
    print(f"fp16 vs fp32 mask: mean {diff.mean():.2e}, max {diff.max():.3f}")
    assert diff.mean() < 1e-3, "fp16 export drifted"


def main():
    size = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
    out = os.path.join(sys.argv[1], f"birefnet-lite-{size}")
    os.makedirs(os.path.join(out, "onnx"), exist_ok=True)
    fp32 = os.path.join(out, "onnx", "model.onnx")
    fp16 = os.path.join(out, "onnx", "model_fp16.onnx")
    export_fp32(fp32, size)
    to_fp16(fp32, fp16)
    check(fp32, fp16, size)
    with open(os.path.join(out, "config.json"), "w") as f:
        json.dump({"model_type": "swin", "transformers.js_config": {"dtype": "fp32"}}, f)
    with open(os.path.join(out, "preprocessor_config.json"), "w") as f:
        json.dump({
            "do_normalize": True, "do_rescale": True, "do_resize": True,
            "feature_extractor_type": "ViTFeatureExtractor", "image_processor_type": "ViTFeatureExtractor",
            "image_mean": MEAN, "image_std": STD, "resample": 2, "rescale_factor": 1 / 255,
            "size": {"height": size, "width": size},
        }, f, indent=2)
    for name in ("onnx/model.onnx", "onnx/model_fp16.onnx"):
        print(name, os.path.getsize(os.path.join(out, name)))


if __name__ == "__main__":
    main()
