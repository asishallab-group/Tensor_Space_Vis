"use strict";

// using fetch, as this is may not be supported in some cases: import data from "./sampleData.json" with { type: "json" };
// anyway, the data will come from wasm in future
const data = await (await fetch("./app/sampleData.json")).json();

export const handler = {
  get families() {
    return Array.from({ length: this.getFamilyCount() }, (_, i) => i);
  },
  genes(familyIdx) {
    return Array.from({ length: this.getGeneCount(familyIdx) }, (_, i) => i);
  },
  get tissues() {
    return Object.keys(
      data[0]?.tissues ?? {}
    );
  },
  getFamilyIndices(...familyIDs) {
    familyIDs = new Set(familyIDs);
    const indices = {};
    for (let i = 0; i < data.length; i++) {
      const family = data[i].family;
      if (familyIDs.delete(family)) {
        indices[family] = i;
      }
      if (familyIDs.size === 0) {
        break;
      }
    }
    return indices;
  },
  getFamilyIDs(...familyIndices) {
    return familyIndices.map(f => data[f]?.family);
  },
  getFamilyCount() {
    return data.length;
  },
  getGeneCount(familyIdx) {
    return data[familyIdx]?.genes.length;
  },
  getColor(familyIdx) {
    // using the checksum of the family name as color code
    const familyID = data[familyIdx]?.family;
    if (familyID !== undefined) {
      const value = crc32(familyID) & (8**6-1); // mask the bits to have a number that is between octal 0-777777, a range of around 260k values
      const shift = config.get("darkMode") ? 3 : 7;
      const hexString = value.toString(8).padStart(6, "0");

      // shift the numbers, so in darkmode the color consists of numbers between 3-9 and in lightMode between 9-F
      // why shifting? because brighter colors are ugly in darkmode and vice versa
      return "#" + hexString.replace(/[0-7]/g, char => (Number(char) + shift).toString(16)).toUpperCase();
    }
  },
  getFamilyData(familyIdx, ...tissues) {
    const familyData = {
      family: this.getFamilyIDs(familyIdx)[0],
      centroid: [],
      stdDevs: []
    };

    for (const tissue of tissues) {
      familyData.centroid.push(data[familyIdx]?.centroid[tissue]);
      const tissueData = data[familyIdx]?.tissues[tissue];
      familyData.stdDevs.push(stdDev(tissueData ?? []));
    }
    return familyData;
  },
  getGeneData: function (familyIdx, geneIndex, tissues=null, attributes=null) {
    tissues ??= this.tissues;

    const familyData = data[familyIdx];
    if (familyData !== undefined) {
      const geneData = {};
      attributes ??= Object.keys(familyData).slice(0, -2); // without 'centroid' and 'tissues'
      for (const key of attributes) {
        if (typeof familyData[key] === "object") {
          geneData[key] = familyData[key][geneIndex];
        } else {
          geneData[key] = familyData[key];
        }
      }
      geneData.coordinates = tissues.map((tissue) => {
        return familyData.tissues[tissue]?.[geneIndex];
      })
      return geneData;
    }
  }
}

function stdDev(array) {
  const mean = array.reduce((sum, val) => sum + val, 0) / array.length;
  const squaredDiffs = array.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / array.length;
  return Math.sqrt(variance);
}

// calculates a checksum for a given string
function crc32(str) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  
  return crc ^ 0xFFFFFFFF;
}

Object.freeze(handler);

Object.defineProperty(window, "iterFamilies", {
  value: (function* () {for (const i of handler.families) {console.log(i);config.set("shownFamilies", [i]); yield;}}),
  writable: false, // Prevents modification
  configurable: false // Prevents deletion
});
