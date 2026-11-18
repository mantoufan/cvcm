/** cubejs 1.3.2 (MIT, https://github.com/ldez/cubejs): the parts the solver worker uses. */
declare module "cubejs" {
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
}
