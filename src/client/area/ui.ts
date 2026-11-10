import { t } from "../i18n";
import { mountShapeCalc, unmountShapeCalc } from "../shape-calc";
import { AREA_FIELDS, AREA_FORMULA, AREA_SHAPES, AREA_UNITS, convertArea, solveArea, type AreaShape } from "../../shared/area";

export function mountArea(host: HTMLElement): void {
  mountShapeCalc<AreaShape>(host, {
    ns: "area",
    shapes: AREA_SHAPES,
    fields: AREA_FIELDS,
    formula: AREA_FORMULA,
    power: "²",
    solve: (shape, values, f) => {
      const r = solveArea(shape, values, f);
      return r.ok ? { ok: true, main: r.area, second: r.perimeter, secondApprox: r.perimeterApprox, working: r.working } : r;
    },
    conversions: (area, unit) => {
      const all = convertArea(area, unit);
      return AREA_UNITS.map((u) => [t(`area.u_${u}`), all[u]]);
    },
    start: { shape: "rectangle", unit: "m", values: { length: "5", width: "3" } },
  });
}

export const unmountArea = unmountShapeCalc;
