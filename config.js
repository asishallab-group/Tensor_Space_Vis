"use strict";

function setupConfig() {
  const defaults = {
    allModes: {
      orbitMode: false,
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
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
      outlierDataPointDiameter: 0.25
    },
    lightMode: {
      selectedDataPointColor: "#FFFF00FF",
      outlierDataPointColor: "#0000FFFF",

      backgroundColor: "#FFFFFFFF",

      xAxisColor: "#FF0000FF",
      yAxisColor: "#00FF00FF",
      zAxisColor: "#0000FFFF",
    },
    darkMode: {
      selectedDataPointColor: "#FFFF00FF",
      outlierDataPointColor: "#F15829FF",

      backgroundColor: "#1B1A1FFF",

      xAxisColor: "#DE0000FF",
      yAxisColor: "#19CF00FF",
      zAxisColor: "#0092FFFF",
    }
  };

  const values = {
    allModes: {},
    lightMode: {},
    darkMode: {}
  };
  
  const callbacks = {};
  const validate = getValidator();

  const triggersChunkReload = [
    "tissueX",
    "tissueY",
    "tissueZ",
    "chunkDiameter",
    "chunkLoadRange",
    "scale",
    "darkMode",
    "shownFamilies"
  ];

  const config = {
    get(key) {
      let value = values.allModes[key] ?? defaults.allModes[key];
      if (value === undefined) {
        if (values.allModes.darkMode ?? defaults.allModes.darkMode) {
          value = values.darkMode[key] ?? defaults.darkMode[key];
        } else {
          value = values.lightMode[key] ?? defaults.lightMode[key];
        }
      }

      return value;
    },
    set(key, value, runCallback=true) {
      if (validate(key, value) !== undefined) {
        if (defaults.allModes[key] !== undefined || !key.endsWith("Color")) values.allModes[key] = value;
        else if (config.get("darkMode")) values.darkMode[key] = value;
        else values.lightMode[key] = value;

        if (runCallback) {
          callbacks[key]?.(value);

          // when changing family related stuff (like <familyname>_Color) or other things that need to trigger a chunk reload
          if (key.includes("_") || triggersChunkReload.includes(key)) {
            document.dispatchEvent(new CustomEvent("chunkReload", {
              detail: { setting: key }
            }));
          }
        }
      }
    },
    setSetterCallback(key, callback) {
      if (callbacks[key] === undefined) {
        callbacks[key] = (value) => callback(value); // wrapping the callback to avoid this-context on the private callbacks object
        callback(config.get(key));
      } else {
        throw Error(`Another callback function has been already registered for '${key}' in the past.`);
      }
    },
    asURL() {
      const currentURL = new URL(document.URL);
      return `${currentURL.origin}${currentURL.pathname}?config=${btoa(JSON.stringify(values))}`;
    }
  }

  Object.freeze(config);

  // on dark mode switch, all callbacks need to be triggered
  config.setSetterCallback("darkMode", (enable) => {
    for (const [key, callback] of Object.entries(callbacks)) {
      if (key !== "darkMode") {
        callback(config.get(key));
      }
    }
    const event = new CustomEvent("chunkReload", {
      detail: { setting: "darkMode" }
    });
    document.dispatchEvent(event);
  })

  try {
    const currentURL = new URL(document.URL);
    const configArg = currentURL.searchParams.get("config");
    if (configArg) {
      const importingConfig = JSON.parse(atob(configArg));
      if (importingConfig.allModes) values.allModes = importingConfig.allModes;
      if (importingConfig.darkMode) values.darkMode = importingConfig.darkMode;
      if (importingConfig.lightMode) values.lightMode = importingConfig.lightMode;
    }
  } catch (err) {
    console.log("Could not import config from URL");
  }

  return config;
}

function getValidator() {
  const validators = {};
  {
    const asArray = [
      [
        ["orbitMode", "darkMode"],
        v => {
          if (typeof v !== "boolean") throw Error("Expecting boolean value, got:", typeof v);
        }
      ],
      [
        ["x", "y", "z", "rotationX", "rotationY"],
        v => {
          if (typeof v !== "number") throw Error("Expecting number, got:", typeof v);
        }
      ],
      [
        ["orbitModeTargetDistance", "mouseSensibility", "movementSpeed", "scale"],
        v => {
          if (typeof v !== "number" || v <= 0) throw Error(`Expecting true positive number, got: ${v} (${typeof v})`);
        }
      ],
      [
        ["chunkDiameter", "chunkLoadRange"],
        v => {
          if (!Number.isInteger(v) || v <= 0) throw Error(`Expecting true positive integer, got: ${v} (${typeof v})`);
        }
      ],
      [
        ["shownFamilies"],
        v => {
          if (v !== null || !(v instanceof Array)) throw Error("Expecting either null or Array of family names, got:", v)
        }
      ]
      //[] TODO: tissue validation
    ]
    for (const [keys, validator] of asArray) {
      for (const key of keys) {
        validators[key] = validator;
      }
    }
  }
  function validate(key, value) {
    const validator = validators[key];
    if (validator !== undefined) {
      try {
        validator(value);
        return true;
      } catch (err) {
        console.error(`${key}: ${err.message}`);
        return;
      }
    } else if (key.endsWith("Diameter")) {
      if (typeof v !== "number" || v <= 0) {
        console.error(`${key}: Expecting true positive number, got: ${v} (${typeof v})`);
        return;
      } else {
        return true;
      }
    }
    console.error(`Unknown key: ${key}`);
  }

  return validate;
}

export const config = setupConfig();
