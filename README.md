# Tensor_Space_Vis

A high-performance WebGPU-based scientific visualization tool for multi-omics and multi-dimensional vector spaces.

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

## Sample Data

The visualization includes data from the following families:

- **OG0000103**
- **OG0000713**
- **OG0000091**
- **OG0000845**
- **OG0000141**

These are sourced from `sampleData.json`.
