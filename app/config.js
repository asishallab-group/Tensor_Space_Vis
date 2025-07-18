"use strict";

import { createFamilyKey, splitFamilyKey, getValidator } from "./config/validation.js";

const DEFAULTS = {
  allModes: {
    orbitMode: false,
    darkMode: true,
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0,
    rotationY: 0,
    orbitModeTargetDistance: 10,
    mouseSensibility: 2000,  // the higher, the slower, greater zero
    movementSpeed: 0.5,
    scale: 100,
    chunkDiameter: 50,
    chunkLoadRange: 2,
    shownFamilies: null,
    tissueX: "Liver",
    tissueY: "Heart",
    tissueZ: "Lung",
    defaultDiameter: 0.25
  },
  lightMode: {
    selectedDataPointColor: "#FFFF00FF",

    backgroundColor: "#FFFFFFFF",

    xAxisColor: "#FF0000FF",
    yAxisColor: "#00FF00FF",
    zAxisColor: "#0000FFFF",
  },
  darkMode: {
    selectedDataPointColor: "#FFFF00FF",

    backgroundColor: "#1B1A1FFF",

    xAxisColor: "#DE0000FF",
    yAxisColor: "#19CF00FF",
    zAxisColor: "#0092FFFF",
  }
};

export async function setupConfig() {

  const values = {
    allModes: {},
    lightMode: {},
    darkMode: {}
  };

  let familyKeyTypes;
  
  const callbacks = {};
  const validate = getValidator();

  const config = {
    get(key) {
      let value = values.allModes[key] ?? DEFAULTS.allModes[key];
      if (value === undefined) {
        if (values.allModes.darkMode ?? DEFAULTS.allModes.darkMode) {
          value = values.darkMode[key] ?? DEFAULTS.darkMode[key];
        } else {
          value = values.lightMode[key] ?? DEFAULTS.lightMode[key];
        }
      }

      return value ?? familyDefault(key, familyKeyTypes);
    },
    set(key, value, update=true) {
      validate(key, value);
      if (DEFAULTS.allModes[key] !== undefined || !key.endsWith("Color")) values.allModes[key] = value;
      else if (this.get("darkMode")) values.darkMode[key] = value;
      else values.lightMode[key] = value;
      
      const { family, keyType, gene } = splitFamilyKey(key) ?? {};
      if (keyType !== undefined) {
        document.dispatchEvent(new CustomEvent(keyType, { detail: { family, gene, value } }));
        if (update) {
          document.dispatchEvent(new CustomEvent(keyType + "Updated"));
        }
      } else if (update) {
        document.dispatchEvent(new CustomEvent(key, { detail: value }));
      }
    },
    familySet(familyIndex, key, value, geneIndex, update) {
      this.set(createFamilyKey(familyIndex, key, geneIndex), value, update);
    },
    familyGet(familyIndex, key, geneIndex) {
      return this.get(createFamilyKey(familyIndex, key, geneIndex));
    },
    async asURL() {
      const currentURL = new URL(document.URL);
      const encode = await getCompressor(familyKeyTypes, values);
      const base64 = await encode(true);
      return `${currentURL.origin}${currentURL.pathname}?config=${base64}`;
    },
    async asFile(filename="tox_flyer.conf", compressed=true) {
      let content;

      if (compressed) {
        const encode = await getCompressor(familyKeyTypes, values);
        content = await encode();
      } else {
        content = JSON.stringify(values);
      }

      // Create a blob from the string
      const blob = new Blob([content], { type: "text/plain" });

      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a link and trigger the download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  Object.freeze(config);

  familyKeyTypes = {
    ShiftVector: { type: "boolean", default: () => false },
    Centroid: { type: "boolean", default: () => false },
    Hull: { type: "boolean", default: () => false },
    Color: { type: "string", default: (family) => dataHandler.getColor(family) },
    OutlierColor: { type: "string", default: (family) => config.get(`${family}_Color`) },
    Diameter: { type: "number", default: () => config.get("defaultDiameter") },
    OutlierDiameter: { type: "number", default: () => config.get("defaultDiameter") },
    PickedGene: { type: "boolean", default: () => false },
    PickedShiftVector: { type: "boolean", default: () => false },
    PickedCentroid: { type: "boolean", default: () => false },
  };

  config.set("darkMode", window.matchMedia('(prefers-color-scheme: dark)').matches);

  try {
    const currentURL = new URL(document.URL);
    const configArg = currentURL.searchParams.get("config");
    if (configArg) {
      const decode = await getCompressor(familyKeyTypes);
      const importingConfig = await decode(configArg, true);

      values.allModes = importingConfig.allModes;
      values.lightMode = importingConfig.lightMode;
      values.darkMode = importingConfig.darkMode;
    }
  } catch (err) {
    console.error("Could not import config from URL");
  }

  document.addEventListener("initialTrigger", evt => {
    const unchunked = new Set(evt.detail);

    for (const settings of Object.values(values)) {
      for (const [key, value] of Object.entries(settings)) {
        const { family, keyType, gene } = splitFamilyKey(key) ?? {};
        if (unchunked.has(keyType)) {
          document.dispatchEvent(new CustomEvent(keyType, { detail: { family, gene, value } }));
        }
      }
    }

    for (const key of unchunked) {
      document.dispatchEvent(new CustomEvent(key + "Updated"));
    }
  }, { once: true });

  return config;
}

function familyDefault(key, familyKeyTypes) {
  const [family, keyType, gene] = key.match(/^(\d+)_(\D+)(:\d+)?$/)?.slice(1) ?? [];
  if (keyType !== undefined) {
    return familyKeyTypes[keyType].default(family);
  } else if (key === "shownFamilies") {
    return dataHandler.families;
  }
}

async function getCompressor(familyKeyTypes, values=null) {
  const {
    getEncoder,
    encode,
    encodeBase64,
    decode,
    decodeBase64
  } = await import("./config/compress.js");

  const defaultsCopy = JSON.parse(JSON.stringify(DEFAULTS));
  defaultsCopy.allModes.tissueX = dataHandler.tissues.indexOf(DEFAULTS.allModes.tissueX);
  defaultsCopy.allModes.tissueY = dataHandler.tissues.indexOf(DEFAULTS.allModes.tissueY);
  defaultsCopy.allModes.tissueZ = dataHandler.tissues.indexOf(DEFAULTS.allModes.tissueZ);
  const encoder = getEncoder(defaultsCopy, familyKeyTypes);

  if (values) {
    const valuesCopy = JSON.parse(JSON.stringify(values));
    for (const tissue of ["tissueX", "tissueY", "tissueZ"]) {
      const val = valuesCopy.allModes[tissue];
      if (val !== undefined) {
        valuesCopy.allModes[tissue] = dataHandler.tissues.indexOf(val);
      }
    }

    function compress(asBase64=false) {
      if (asBase64) {
        return encodeBase64(encoder.encode, valuesCopy);
      } else {
        return encode(encoder.encode, valuesCopy);
      }
    }
    return compress;
  } else {
    async function decompress(encoded, isBase64=false) {
      let decodedValues;
      if (isBase64) {
        decodedValues = await decodeBase64(encoder.decode, encoded);
      } else {
        decodedValues = await decode(encoder.decode, encoded);
      }

      for (const tissue of ["tissueX", "tissueY", "tissueZ"]) {
        const val = decodedValues.allModes[tissue];
        if (val !== undefined) {
          decodedValues.allModes[tissue] = dataHandler.tissues[val];
        }
      }

      return decodedValues;
    }

    return decompress;
  }
}
