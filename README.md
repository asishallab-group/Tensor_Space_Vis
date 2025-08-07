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

#### [View selected 5 gene families](https://asishallab-group.github.io/Tensor_Space_Vis/?config=4ZSA57GP56Ct56KK4Zak5Y6U5a6C4YKr4pux4ZqF5YOC5pSd5I6F5YaE2IngsKTji4PnsLHngaHhqIfkrYrhv4zlnrvjkL_nvLDivqrnt6TnsrzjgaPlrYTks6jkrofirbDnkaPjqqrhh5DmsY3ng57iqL7jop7gqK3isK3mnonjko_joL3nj5rip4vmhI3hnrjhoIjljb_moK_nu7vlmp_FvOewiOW-qeKbmuaQlOGciuWcueS_o-KPjeGmvuaqleC3t-W1nuS8p-GBj-eSsOGtp-OcreKYuOaJh9qExpDgo4zhupTigKDkgYDCgMSBxJ7QjOWgiBs)

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

See an example _(Ensure the server is running before using this feature.)_: [here](http://localhost:8080/?config=4ZSA57GP56Ct56KK4Zak5Y6U5a6C4YKr4pux4ZqF5YOC5pSd5I6F5YaE2IngsKTji4PnsLHngaHhqIfkrYrhv4zlnrvjkL_nvLDivqrnt6TnsrzjgaPlrYTks6jkrofirbDnkaPjqqrhh5DmsY3ng57iqL7jop7gqK3isK3mnonjko_joL3nj5rip4vmhI3hnrjhoIjljb_moK_nu7vlmp_FvOewiOW-qeKbmuaQlOGciuWcueS_o-KPjeGmvuaqleC3t-W1nuS8p-GBj-eSsOGtp-OcreKYuOaJh9qExpDgo4zhupTigKDkgYDCgMSBxJ7QjOWgiBs).

The example includes data from the following gene families:

- **OG0000017**
- **OG0000034**
- **OG0000306**
- **OG0000103**
- **OG0000141**

These are sourced from `sampleData.json`.
