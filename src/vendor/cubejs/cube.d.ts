/** Types for the vendored cubejs 1.3.2 (MIT): the parts the solver worker and tests use. */
interface CubeInstance {
  solve(maxDepth?: number): string;
  asString(): string;
  move(alg: string): CubeInstance;
}
interface CubeStatic {
  new (): CubeInstance;
  fromString(facelets: string): CubeInstance;
  initSolver(): void;
}
const Cube: CubeStatic;
export default Cube;
