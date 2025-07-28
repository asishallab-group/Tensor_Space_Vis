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

  const familyKeyTypes = {
    ShiftVector: { type: "boolean", default: () => false, supportsGeneRelated: true },
    Centroid: { type: "boolean", default: () => false, supportsFamilyRelated: true },
    Hull: { type: "boolean", default: () => false, supportsFamilyRelated: true },
    Color: { type: "string", default: (family) => dataHandler.getColor(family), supportsGeneRelated: true, supportsFamilyRelated: true },
    Diameter: { type: "number", default: () => 0.25, supportsGeneRelated: true },
    PickedGene: { type: "boolean", default: () => false, supportsGeneRelated: true },
    PickedShiftVector: { type: "boolean", default: () => false, supportsGeneRelated: true },
    PickedCentroid: { type: "boolean", default: () => false, supportsFamilyRelated: true },
  };
  
  const callbacks = {};
  const updated = new Map();
  function callCallbacks(key, value, update) {
    const registeredCallbacks = callbacks[key] ?? [];
    for (let callback of registeredCallbacks) {
      if (update || callback.updatePriority === null) {
        callback(value);
      } else {
        if (!updated.has(callback.updatePriority)) {
          updated.set(callback.updatePriority, new Set([callback]));
        } else {
          updated.get(callback.updatePriority).add(callback);
        }
      }
    }
  }

  const validate = getValidator(familyKeyTypes);

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
        const { supportsGeneRelated, supportsFamilyRelated } = familyKeyTypes[keyType];
        if (!supportsFamilyRelated && gene === undefined) {
          throw new Error(`Setting '${keyType}' is related to single genes, setting value for whole family is not supported`);
        } else if (!supportsGeneRelated && gene !== undefined) {
          throw new Error(`Setting '${keyType}' is related to the whole family, setting value for single gene is not supported`);
        }
        callCallbacks(keyType, { family, gene, value }, update);
      } else {
        callCallbacks(key, { value }, update);
      }
    },
    familySet(familyIndex, key, value, geneIndex, update) {
      this.set(createFamilyKey(familyIndex, key, geneIndex), value, update);
    },
    familyGet(familyIndex, key, geneIndex) {
      return this.get(createFamilyKey(familyIndex, key, geneIndex));
    },
    onChange(key, callback, updatePriority=0) {
      callbacks[key] ??= [];
      callback.updatePriority = updatePriority;
      callback.key = key;
      callbacks[key].push(callback);
      callbacks[key].sort((a, b) => b.updatePriority - a.updatePriority);
    },
    update() {
      const queue = [...updated].sort(([a], [b]) => b-a);  // descending
      updated.clear();

      for (const [, callbacksToUpdate] of queue) {
        for (const callback of callbacksToUpdate) {
          callback({ value: this.get(callback.key) });
        }
      }
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
    },
    init() {
      for (const [key, value] of Object.entries({...DEFAULTS.allModes, ...values.allModes})) {
        const { family, keyType, gene } = splitFamilyKey(key) ?? {};
        if (keyType !== undefined) {
          config.familySet(family, keyType, value, gene, false);
        } else {
          config.set(key, value, false);
        }
      }
      config.update();
    }
  }

  Object.freeze(config);

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
    console.error("Could not import config from URL", err);
  }

  config.onChange("darkMode", function({ value }) {
    const mode = value ? "darkMode" : "lightMode";
    for (const [key, value] of Object.entries({...DEFAULTS[mode], ...values[mode]})) {
      if (key !== "darkMode") {
        const { family, keyType, gene } = splitFamilyKey(key) ?? {};
        if (keyType !== undefined) {
          config.familySet(family, keyType, value, gene, false);
        } else {
          config.set(key, value, false);
        }
      }
    }
  }, 1);

  config.onChange("darkMode", config.update.bind(config));

  return config;
}


function familyDefault(key, familyKeyTypes) {
  const { family, keyType, gene } = splitFamilyKey(key) ?? {};
  if (keyType !== undefined) {
    if (gene === undefined) {
      return familyKeyTypes[keyType]?.default(family);
    } else {
      return config.familyGet(family, keyType);
    }
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
