# Tensor_Space_Vis

A high-performance WebGPU-based scientific visualization tool for multi-omics and multi-dimensional vector spaces.

## Demo

Explore the **Tensor Omics Flyer**, a WebGPU-based interactive visualization tool for multi-omics gene expression analysis.

This demo focuses on sex-related gene families across 4 mammalian species:

* Cynomolgus macaque
* Dog
* Mouse
* Rat

### 🔗 Quick Access

#### [View all gene families](https://asishallab-group.github.io/Tensor_Space_Vis/)
  
  Loads the full dataset with all available orthogroups.

#### [View selected 5 gene families](https://asishallab-group.github.io/Tensor_Space_Vis/?config=4LqA5paX57e94K2Y4KyN5JuP45C_5pO_5KSZ46uO55685bOD5L-i4Kmh4YOG5J-c546Q5rmW56Si5a-ExL7khrXni6DmkJPkpIvih4PijrXhuoDntL7mo7PhmLDlnqzkqJrlgbXiu6TinqzWleOHlOKJnOSwmeG5q-GrruaKmuGxmeeao-OlnOC2qOeGn-KjjeeNiuWrtOaDouK7vOCrmeSOoOeFpOCkpuOHj-e5oOWDteSVsOasgOSlneWmo-e-reO9iOamtuSNsuOpo-OcoGjmgJnigozHqciC0ITgoIjhgJDmgJTkgYDltoAB)

  Loads a focused view of five representative orthogroups for clearer visualization.

##### Gene Families and Color Coding

| Gene Family   | Color   |
|---------------|---------|
| OG0000017     | Red     |
| OG0000034     | Green   |
| OG0000306     | Gray    |
| OG0000103     | Cyan    |
| OG0000141     | Magenta |

## Getting Started

To test the flyer locally, start a simple HTTP server:

```bash
python3 -m http.server 8080
```

Then, open [http://localhost:8080](http://localhost:8080/) in your browser.

## Configuration

The config object is available in developer tools. Open the console and modify settings as needed. Supported attributes can be found in [`./app/config.js`](./app/config.js).

To generate a sharable URL reflecting the current view, use:

```js
await config.asUrl()
```

See an example _(Ensure the server is running before using this feature.)_: [here](http://localhost:8080/?config=4LqA5paX57e94K2Y4KyN5JuP45C_5pO_5KSZ46uO55685bOD5L-i4Kmh4YOG5J-c546Q5rmW56Si5a-ExL7khrXni6DmkJPkpIvih4PijrXhuoDntL7mo7PhmLDlnqzkqJrlgbXiu6TinqzWleOHlOKJnOSwmeG5q-GrruaKmuGxmeeao-OlnOC2qOeGn-KjjeeNiuWrtOaDouK7vOCrmeSOoOeFpOCkpuOHj-e5oOWDteSVsOasgOSlneWmo-e-reO9iOamtuSNsuOpo-OcoGjmgJnigozHqciC0ITgoIjhgJDmgJTkgYDltoAB).

The example includes data from the following gene families:

- **OG0000017**
- **OG0000034**
- **OG0000306**
- **OG0000103**
- **OG0000141**

These are sourced from `sampleData.json`.
