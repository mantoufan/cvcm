import { describe, expect, it } from "vitest";
import { chiCdf, chiInvUpper, chiUpper, fInvUpper, fUpper, lnGamma, normCdf, normInv, normUpper, tInvUpper, tUpper } from "../src/shared/stat-dist";

const close = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1e-300, Math.abs(b)));

describe("stat-dist (reference values from SciPy)", () => {
  it("log-gamma", () => {
    close(lnGamma(5), Math.log(24));
    close(lnGamma(0.5), Math.log(Math.sqrt(Math.PI)));
    close(lnGamma(100.5), 361.43554046777757);
  });
  it("normal", () => {
    close(normCdf(1.959963984540054), 0.975);
    close(normUpper(3), 0.001349898031630093);           // pnorm(3, lower=F)
    close(normUpper(8), 6.22096057427174e-16, 1e-9);   // pnorm(8, lower=F)
    close(normCdf(-1), 0.15865525393145707);
    close(normInv(0.975), 1.959963984540054);
    close(normInv(0.995), 2.5758293035489);
    close(normInv(1e-10), -6.361340902404056, 1e-8);
    close(normInv(0.5) + 1, 1);
  });
  it("t", () => {
    close(2 * tUpper(2.228138851986, 10), 0.05, 1e-8);  // qt(.975,10)
    close(tUpper(1.5, 5), 0.09695184012123659);            // pt(1.5,5,lower=F)
    close(tUpper(-1.5, 5), 1 - 0.09695184012123659);
    close(tUpper(10, 3), 0.0010641995292070751);         // pt(10,3,lower=F)
    close(tInvUpper(0.025, 10), 2.228138851986, 1e-9);
    close(tInvUpper(0.025, 1), 12.70620473617471, 1e-9);
    close(tInvUpper(0.975, 30), -2.042272456301238, 1e-9);
    close(tUpper(2.1, 17.3), 0.02534411151143376);      // fractional df (Welch)
    // Large df: small p-values keep their digits, and t near 0 stays just under 0.5.
    close(tUpper(10, 200), 1.1887415722103823e-19, 1e-8);
    close(tUpper(30, 1000), 7.687343722021544e-142, 1e-7);
    close(tUpper(20, 1e6), 2.8665435236951327e-89, 1e-6);
    close(tUpper(8, 200), 4.939600454665301e-14, 1e-8);
    close(tUpper(1e-6, 1e6), 0.4999996010578193, 1e-12);
    close(tUpper(0.01, 1e6), 0.4960106446827738, 1e-10);
    close(tUpper(0.5, 3), 0.3257239824240755);
    close(tUpper(2, 1e5), 0.022751481728753246, 1e-8);
    close(tInvUpper(1e-20, 1000), 9.467044815255923, 1e-8);
  });
  it("chi-square", () => {
    close(chiUpper(3.841458820694124, 1), 0.05, 1e-9);
    close(chiUpper(10, 4), 0.04042768199451279);        // pchisq(10,4,lower=F)
    close(chiCdf(2, 3), 0.42759329552912);
    close(chiUpper(100, 10), 5.4497019829205215e-17, 1e-8);
    close(chiInvUpper(0.05, 5), 11.07049769351635, 1e-9);
    close(chiInvUpper(0.01, 1), 6.634896601021216, 1e-9);
  });
  it("F", () => {
    close(fUpper(3.3541308285291964, 2, 27), 0.05);
    close(fUpper(4.5, 3, 12), 0.0245734788409537);
    close(fInvUpper(0.05, 2, 27), 3.3541308285291964);
    close(fInvUpper(0.01, 5, 10), 5.636326187669078);
  });
});
