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

#### [View selected 5 gene families](https://asishallab-group.github.io/Tensor_Space_Vis/?config=eyJhbGxNb2RlcyI6eyJ4IjotMC4xNjEwMjYwMTQ4NjkxODU5LCJ5IjoxLjM3NTkyMjQxMTYyNjkyMjksInoiOi0xLjc3MDU2MTI2NTgxMTg1NTcsInJvdGF0aW9uWCI6MC4zMjg3NTY0NTQ4Mjk1NDgxMywicm90YXRpb25ZIjotMC40NDI4MzU4NDg0ODc4NzE1LCJvcmJpdE1vZGVUYXJnZXREaXN0YW5jZSI6MTAsInNjYWxlIjoxMCwic2hvd25GYW1pbGllcyI6WyJPRzAwMDAwMTciLCJPRzAwMDAwMzQiLCJPRzAwMDAzMDYiLCJPRzAwMDAxMDMiLCJPRzAwMDAxNDEiXSwiZGFya01vZGUiOnRydWV9LCJsaWdodE1vZGUiOnsiT0cwMDAwMDE3X0NvbG9yIjoiI0QzMzMzMyIsIk9HMDAwMDAzNF9Db2xvciI6IiMzM0QzMzMiLCJPRzAwMDAzMDZfQ29sb3IiOiIjMzMzM0QzIiwiT0cwMDAwMTAzX0NvbG9yIjoiIzMzRDNEMyIsIk9HMDAwMDE0MV9Db2xvciI6IiNEMzMzRDMifSwiZGFya01vZGUiOnsiT0cwMDAwMDE3X0NvbG9yIjoiI0EwMDAwMCIsIk9HMDAwMDAzNF9Db2xvciI6IiMwMEEwMDAiLCJPRzAwMDAzMDZfQ29sb3IiOiIjQTBBMEEwIiwiT0cwMDAwMTAzX0NvbG9yIjoiIzAwQTBBMCIsIk9HMDAwMDE0MV9Db2xvciI6IiNBMDAwQTAifX0=)

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

The config object is available in developer tools. Open the console and modify settings as needed. Supported attributes can be found in [`./config.js`](./config.js).

To generate a sharable URL reflecting the current view, use:

```js
config.asUrl()
```

See an example _(Ensure the server is running before using this feature.)_: [here](http://localhost:8080/?config=eyJhbGxNb2RlcyI6eyJ4IjoxLjQyNjExMDQ5NDQwNDI1OTcsInkiOjEuODYzNTU2MTc3MjU5MjU2NCwieiI6LTIuMTI1NjI2MTAxODIxMjI1Miwicm90YXRpb25YIjowLjQwODQ4MjQyODIxMzA0ODYsInJvdGF0aW9uWSI6MC4yMzMxNDI3MjUwODQzMzk1LCJvcmJpdE1vZGVUYXJnZXREaXN0YW5jZSI6MTAsInNjYWxlIjoxMCwidGlzc3VlWCI6IkxpdmVyIiwidGlzc3VlWSI6IkJyYWluIiwidGlzc3VlWiI6IlBpdHVpdGFyeSIsInNob3duRmFtaWxpZXMiOlsiT0cwMDAwMTAzIiwiT0cwMDAwNzEzIiwiT0cwMDAwMDkxIiwiT0cwMDAwODQ1IiwiT0cwMDAwMTQxIl0sIk9HMDAwMDA5MV9PdXRsaWVyRGlhbWV0ZXIiOjAuNSwiT0cwMDAwNzEzX091dGxpZXJEaWFtZXRlciI6MC41LCJPRzAwMDAxMDNfT3V0bGllckRpYW1ldGVyIjowLjUsIk9HMDAwMDg0NV9PdXRsaWVyRGlhbWV0ZXIiOjAuNSwiT0cwMDAwMTQxX091dGxpZXJEaWFtZXRlciI6MC41fSwibGlnaHRNb2RlIjp7fSwiZGFya01vZGUiOnsiT0cwMDAwMDkxX0NvbG9yIjoiI0EwMDAwMCIsIk9HMDAwMDcxM19Db2xvciI6IiMwMEEwMDAiLCJPRzAwMDAxMDNfQ29sb3IiOiIjQTBBMEEwIiwiT0cwMDAwODQ1X0NvbG9yIjoiIzAwQTBBMCIsIk9HMDAwMDE0MV9Db2xvciI6IiNBMDAwQTAifX0=).

The example includes data from the following gene families:

- **OG0000017**
- **OG0000034**
- **OG0000306**
- **OG0000103**
- **OG0000141**

These are sourced from `sampleData.json`.
