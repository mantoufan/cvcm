#!/usr/bin/env python3
"""Check a batch 25 translation against en: same keys and the same {placeholders} (button names quoted in how-tos are checked by hand)."""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def flat(o, p=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from flat(v, f"{p}.{k}" if p else k)
    else:
        yield p, o


def check(loc: str) -> list[str]:
    errs = []
    for kind in ("tools-src", "learn-src"):
        en = dict(flat(json.loads((ROOT / f"scripts/{kind}/batch25/en.json").read_text(encoding="utf-8"))))
        path = ROOT / f"scripts/{kind}/batch25/{loc}.json"
        if not path.exists():
            errs.append(f"missing {path}")
            continue
        tr = dict(flat(json.loads(path.read_text(encoding="utf-8"))))
        for k in en.keys() - tr.keys():
            errs.append(f"{kind}: missing {k}")
        for k in tr.keys() - en.keys():
            errs.append(f"{kind}: extra {k}")
        for k, v in en.items():
            if k in tr and isinstance(v, str):
                if set(re.findall(r"\{\w+\}", v)) != set(re.findall(r"\{\w+\}", str(tr[k]))):
                    errs.append(f"{kind}: placeholders differ in {k}")
    return errs


if __name__ == "__main__":
    bad = False
    for loc in sys.argv[1:]:
        errs = check(loc)
        print(loc, "OK" if not errs else "\n  ".join([""] + errs))
        bad = bad or bool(errs)
    sys.exit(1 if bad else 0)
