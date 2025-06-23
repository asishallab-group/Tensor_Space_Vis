"use strict";

// using fetch, as this is may not be supported in some cases: import data from "./sampleData.json" with { type: "json" };
// anyway, the data will come from wasm in future
const data = await (await fetch("./app/sampleData.json")).json();

export const handler = {
  get families() {
    return Object.keys(data);
  },
  get tissues() {
    return Object.keys(
      data[this.families[0]]?.[tissues] ?? {}
    )
  },
  getGeneCount(family) {
    return data[family]?.genes.length;
  },
  getColor(family) {
    // using the checksum of the family name as color code
    const value = crc32(family) & (8**6-1); // mask the bits to have a number that is between octal 0-777777, a range of around 260k values
    const shift = config.get("darkMode") ? 3 : 7;
    const hexString = value.toString(8).padStart(6, "0");

    // shift the numbers, so in darkmode the color consists of numbers between 3-9 and in lightMode between 9-F
    // why shifting? because brighter colors are ugly in darkmode and vice versa
    return "#" + hexString.replace(/[0-7]/g, char => (Number(char) + shift).toString(16)).toUpperCase();
  },
  getCentroid(family, ...tissues) {
    return tissues.map((tissue) => {
      return data[family]?.centroid[tissue];
    });
  },
  getGeneData: function (family, geneIndex, tissues=null, attributes=null) {
    tissues ??= this.tissues;

    const familyData = data[family];
    if (familyData !== undefined) {
      const geneData = {};
      attributes ??= Object.keys(familyData).slice(0, -2); // without 'centroid' and 'tissues'
      for (const key of attributes) {
        geneData[key] = familyData[key][geneIndex];
      }
      geneData.coordinates = tissues.map((tissue) => {
        return familyData.tissues[tissue]?.[geneIndex];
      })
      return geneData;
    }
  }
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
