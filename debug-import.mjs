import * as pkg from 'parquet-wasm';
console.log("Namespace keys:", Object.keys(pkg));
if (pkg.default) {
    console.log("Default export keys:", Object.keys(pkg.default));
}
