"use strict";

const FAMILY_KEY_REGEX = /^(\d+)_(\D+)(:\d+)?$/;
export const COLOR_REGEX = /^#[A-Fa-f0-9]{6}(?:[A-Fa-f0-9]{2})?$/;

export const familyKeyTypes = {
  ShiftVector: { type: "boolean", default: () => false, supportsGeneRelated: true },
  Centroid: { type: "boolean", default: () => false, supportsFamilyRelated: true },
  Hull: { type: "boolean", default: () => false, supportsFamilyRelated: true },
  Color: { type: "string", default: (family) => dataHandler.getColor(family), supportsGeneRelated: true, supportsFamilyRelated: true },
  Diameter: { type: "number", default: () => 0.25, supportsGeneRelated: true },
  PickedGene: { type: "boolean", default: () => false, supportsGeneRelated: true },
  PickedShiftVector: { type: "boolean", default: () => false, supportsGeneRelated: true },
  PickedCentroid: { type: "boolean", default: () => false, supportsFamilyRelated: true },
  Visible: { type: "boolean", default: () => false, supportsFamilyRelated: true }
}
Object.freeze(familyKeyTypes);

export function createFamilyKey(family, key, gene) {
  if (gene === undefined) {
    return `${family}_${key}`;
  } else{
    return `${family}_${key}:${gene}`;
  }
}

export function splitFamilyKey(familyKey) {
  const [, family, keyType, gene] = familyKey.match(FAMILY_KEY_REGEX) ?? [];
  if (family !== undefined) {
    return {
      family: Number(family),
      keyType,
      gene: gene === undefined ? gene : Number(gene.slice(1))
    };
  }
  return null;
}

export function getValidator() {
  const validators = {};
  {
    const asArray = [
      [
        ["orbitMode", "darkMode", "ShiftVector", "Centroid", "Hull", "PickedGene", "PickedShiftVector", "PickedCentroid", "Visible"],
        v => {
          if (typeof v !== "boolean") throw new Error(`Expecting boolean value, got: ${typeof v}`);
        }
      ],
      [
        ["x", "y", "z", "rotationX", "rotationY"],
        v => {
          if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Expecting non infinite number, got: ${typeof v} '${v}'`);
        }
      ],
      [
        ["orbitModeTargetDistance", "mouseSensibility", "movementSpeed", "scale", "Diameter"],
        v => {
          if (typeof v !== "number" || v <= 0 || !Number.isFinite(v)) throw new Error(`Expecting true positive number, got: ${v} (${typeof v})`);
        }
      ],
      [
        ["chunkDiameter"],
        v => {
          if (!Number.isInteger(v) || v <= 0 || v % 2 === 1) throw new Error(`Expecting true positive even integer, got: ${v} (${typeof v})`);
        }
      ],
      [
        ["chunkLoadRange"],
        v => {
          if (!Number.isInteger(v) || v <= 0) throw new Error(`Expecting true positive integer, got: ${v} (${typeof v})`);
        }
      ],
      [["tissueX", "tissueY", "tissueZ"], () => {}],
      [
        ["selectedDataPointColor", "backgroundColor", "xAxisColor", "yAxisColor", "zAxisColor", "Color"],
        v => {
          if (!/^#[A-Fa-f0-9]{6}(?:[A-Fa-f0-9]{2})?$/.test(v)) throw new Error(`Expecting RGB(A) hex color code, got: ${v}`);
        }
      ],
    ]
    for (const [keys, validator] of asArray) {
      for (const key of keys) {
        validators[key] = validator;
      }
    }
  }
  function validate(key, value) {
    const { family, keyType, gene } = splitFamilyKey(key) ?? {};
    let validator;
    if (keyType !== undefined) {
      validator = validators[keyType];
    } else if (key[0].toUpperCase() !== key[0]) {
      validator = validators[key];
    }
    if (validator !== undefined) {
      try {
        validator(value);
        return true;
      } catch (err) {
        throw new Error(`${key}: ${err.message}`);
        return;
      }
    } else {
      throw new Error(`Unknown key: ${key}`);
    }
  }

  return validate;
}
