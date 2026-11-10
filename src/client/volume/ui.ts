import { t } from "../i18n";
import { mountShapeCalc, unmountShapeCalc } from "../shape-calc";
import { VOLUME_FIELDS, VOLUME_FORMULA, VOLUME_SHAPES, VOLUME_UNITS, convertVolume, solveVolume, type VolumeShape } from "../../shared/volume";

export function mountVolume(host: HTMLElement): void {
  mountShapeCalc<VolumeShape>(host, {
    ns: "volume",
    shapes: VOLUME_SHAPES,
    fields: VOLUME_FIELDS,
    formula: VOLUME_FORMULA,
    power: "³",
    solve: (shape, values, f) => {
      const r = solveVolume(shape, values, f);
      return r.ok ? { ok: true, main: r.volume, second: r.surface, secondApprox: r.surfaceApprox, working: r.working } : r;
    },
    conversions: (volume, unit) => {
      const all = convertVolume(volume, unit);
      return VOLUME_UNITS.map((u) => [t(`volume.u_${u}`), all[u]]);
    },
    start: { shape: "box", unit: "cm", values: { length: "30", width: "20", height: "10" } },
  });
}

export const unmountVolume = unmountShapeCalc;
