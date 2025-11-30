"use strict";

// using fetch, as this is may not be supported in some cases: import data from "./sampleData.json" with { type: "json" };
// anyway, the data will come from wasm in future
const data = await (await fetch("./app/sampleData.json")).json();

export const handler = {
  get families() {
    return Array.from({ length: this.getFamilyCount() }, (_, i) => i);
  },
  genes(familyIdx) {
    const geneIndices = data.families[familyIdx]?.gene_indices
    if (geneIndices !== undefined) {
      return Array.from({ length: geneIndices.length }, (_, i) => i);
    }
  },
  get tissues() {
    return data.tissues;
  },
  getFamilyIndices(...familyIDs) {
    return getIndices(
      familyIDs,
      this.getFamilyCount(),
      i => this.getFamilyIDs(i)[0]
    )
  },
  getTissueIndices(...tissueIndices) {
    return getIndices(
      tissueIndices,
      this.getTissueCount(),
      i => this.getTissueNames(i)[0]
    )
  },
  getFamilyIDs(...familyIndices) {
    return familyIndices.map(f => data.families[f]?.family);
  },
  getTissueNames(...tissueIndices) {
    return tissueIndices.map(t => data.tissues[t]);
  },
  getFamilyCount() {
    return data.families.length;
  },
  getTissueCount() {
    return data.tissues.length;
  },
  getGeneCount(familyIdx) {
    return data.families[familyIdx]?.gene_indices.length;
  },
  getColor(familyIdx) {
    // using the checksum of the family name as color code
    const familyID = this.getFamilyIDs(familyIdx)[0];
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

    if (tissues.length === 0) {
      tissues = this.tissues;
    }

    // TODO: switch to tissue indices in general, as already done with families and genes
    const tissueIndices = this.getTissueIndices(...tissues);
    for (const tissue of tissues) {
      familyData.centroid.push(data.families[familyIdx]?.centroid[tissueIndices[tissue]]);
      const tissueData = this.genes(familyIdx).map(gene => {
        const geneData = this.getGeneData(familyIdx, gene, [tissue], [])
        return geneData.coordinates[0]
      });
      familyData.stdDevs.push(stdDev(tissueData ?? []));
    }
    return familyData;
  },
  getGeneData: function (familyIdx, geneIndex, tissues=null, attributes=null) {
    tissues ??= this.tissues;
    const tissueIndices = this.getTissueIndices(...tissues);
    geneIndex = data.families[familyIdx]?.gene_indices[geneIndex];
    if (geneIndex !== undefined) {
      const geneData = data.genes[geneIndex];
      const resultData = {};
      attributes ??= Object.keys(geneData);
      for (const key of attributes) {
        resultData[key] = geneData[key];
      }
      resultData.coordinates = tissues.map(tissue => {
        return geneData.coordinates[tissueIndices[tissue]];
      });
      return resultData;
    }
  }
}

function getIndices(names, totalCount, getName) {
  names = new Set(names);
  const indices = {};
  for (let i = 0; i < totalCount; i++) {
    const name = getName(i);
    if (names.delete(name)) {
      indices[name] = i;
    }
    if (names.size === 0) {
      break;
    }
  }
  return indices;
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
