"use strict";

import {
  COLOR_REGEX,
  splitFamilyKey,
  createFamilyKey
} from "./validation.js";

const MAX_CHAR_CODE = 2 ** 16 - 1;
const MAX_ENC_CHAR_CODE = 2 ** 15 - 1;

const SEPARATORS = new Map();
[
  "sign",
  "float",
  "familyKeyStart",
  "familyKeyStop",
  "null",
  "array",
].forEach((sep, i) => SEPARATORS.set(sep, String.fromCharCode(MAX_ENC_CHAR_CODE + i + 1)));

const SEPARATORS_REV = new Map();
SEPARATORS.entries().forEach(([k, v]) => SEPARATORS_REV.set(v, k));

export function getEncoder(defaults, familyKeyTypes) {
  const separators = new Map();
  const separatorsRev = new Map();

  // add builtin keys as separators
  for (const [category, settings] of Object.entries(defaults)) {
    for (const key of Object.keys(settings)) {
      const sepType = `${key}:${category}`;
      const sep = String.fromCharCode(MAX_ENC_CHAR_CODE + SEPARATORS.size + separators.size + 1);
      separators.set(sepType, sep);
      separatorsRev.set(sep, sepType);
    }
  }
  for (const keyType in familyKeyTypes) {
    for (const category in defaults) {
      const sepType = `${keyType}_${category}`;
      const sep = String.fromCharCode(MAX_ENC_CHAR_CODE + SEPARATORS.size + separators.size + 1);
      separators.set(sepType, sep);
      separatorsRev.set(sep, sepType);
    }
  }

  let previousFamilyEnc = null;
  let previousFamilyDec = null;

  function encode(category, key, value) {
    const encoders = {
      boolean: (encodedKey, value, defaultValue) => {
        if (value !== defaultValue) {
          return encodedKey;
        } else {
          return "";
        }
      },
      number: (encodedKey, value, defaultValue) => {
        if (value !== defaultValue) {
          return encodedKey + encodeNumber(value);
        } else {
          return "";
        }
      },
      string: (encodedKey, value, defaultValue) => {
        if (value !== defaultValue) {
          if (COLOR_REGEX.test(value)) {
            return encodedKey + encodeColor(value);
          } else {
            console.error("Encoding strings only supported for color codes");
            return "";
          }
        } else {
          return "";
        }
      },
      object: (encodedKey, value, defaultValue) => {
        if (value !== defaultValue) {
          if (value === null) {
            return encodedKey + SEPARATORS.get("null");
          } else if (value instanceof Array) {
            value.sort();
            if (defaultValue === null || defaultValue.sort().toString() !== value.toString()) {
              const encoded = value.map(v => encoders.number(SEPARATORS.get("array"), v)).join("");

              // replace first encoded key by encodedKey
              return encodedKey + encoded.slice(1);
            }
          } else {
            console.error("Encoding objects is not supported");
          }
        }
        return "";
      }
    }
    let type;
    let defaultValue;
    let encodedKey = "";
    const { family, keyType, gene } = splitFamilyKey(key) ?? {};
    if (family !== undefined) {
      if (previousFamilyEnc !== family) {
        encodedKey = SEPARATORS.get("familyKeyStart");
        encodedKey += encodeNumber(family);
        previousFamilyEnc = family;
      }

      const keyTypeSep = `${keyType}_${category}`;
      if (!separators.has(keyTypeSep)) throw new Error(`Missing family key type: '${keyType}'`);
      encodedKey += separators.get(keyTypeSep);

      if (gene !== undefined) {
        encodedKey += encodeNumber(gene);
      }
      
      encodedKey += SEPARATORS.get("familyKeyStop");
      
      defaultValue = familyKeyTypes[keyType].default(family);
      type = familyKeyTypes[keyType].type
    } else {
      previousFamilyEnc = null;
      encodedKey = separators.get(`${key}:${category}`);

      defaultValue = defaults[category][key];
    }
    const encoder = encoders[typeof value];
    return encoder(encodedKey, value, defaultValue);
  }

  function decode(str, idx) {
    const decoders = {
      number: (str, idx) => {
        const decoded = decodeNumber(str, idx);
        return { value: decoded.decoded, idx: decoded.idx };
      },
      string: (str, idx) => {
        const decoded = decodeColor(str, idx);
        return { value: decoded.decoded, idx: decoded.idx };
      },
      object: (str, idx) => {
        if (str.charAt(idx) === SEPARATORS.get("null")) {
          return { value: null, idx: idx + 1 };
        } else {
          const decoded = [];
          if (str.charCodeAt(idx) <= MAX_ENC_CHAR_CODE ) {
            do {
              const decodedNum = decoders.number(str, idx);
              decoded.push(decodedNum.value);
              idx = decodedNum.idx + 1;
            } while (str.charAt(idx - 1) === SEPARATORS.get("array"));
            idx--;
          } 

          return { value: decoded, idx };
        }
      }
    }

    const sepType = SEPARATORS_REV.get(str.charAt(idx)) ?? separatorsRev.get(str.charAt(idx));
    if (sepType === undefined) throw new Error("Corrupted key encoding: Missing key");
    idx++;
    let category;
    let key;
    let type;
    let defaultValue;
    if (sepType.includes(":")) {
      previousFamilyDec = null;

      [key, category] = sepType.split(":");
      type = typeof defaults[category][key];

      if (type === "boolean") {
        defaultValue = defaults[category][key];
      }
    } else {
      let family;
      let keyType;
      if (previousFamilyDec === null || sepType === "familyKeyStart") {
        const decodedFamily = decodeNumber(str, idx);
        idx = decodedFamily.idx;
        family = decodedFamily.decoded;
        previousFamilyDec = family;
        [keyType, category] = separatorsRev.get(str.charAt(idx)).split("_");
        idx++;
      } else {
        family = previousFamilyDec;
        [keyType, category] = sepType.split("_");
      }
      if (category === undefined) throw new Error("Corrupted family key encoding: Unknown category" + keyType);

      let gene;
      type = familyKeyTypes[keyType].type;
      if (type === "boolean") {
        defaultValue = familyKeyTypes[keyType].default(family);
      }
      if (str.charAt(idx) === SEPARATORS.get("familyKeyStop")) {
        idx++;
      } else {
        const decodedGene = decodeNumber(str, idx);
        if (str.charAt(decodedGene.idx) !== SEPARATORS.get("familyKeyStop")) throw new Error("Corrupted family key encoding: Missing stop");

        idx = decodedGene.idx + 1;
        gene = decodedGene.decoded;
      }
      key = createFamilyKey(family, keyType, gene);
    }

    if (type === "boolean") {
      return { category, key, value: !defaultValue, idx };
    } else {
      const decoder = decoders[type];
      return { category, key, ...decoder(str, idx) };
    }
  }

  return {encode, decode};
}

function encodeBigInt(int) {
  let encoded = "";
  if (int < 0) {
    encoded = SEPARATORS.get("sign");
    int = -int;
  }

  const shift = BigInt(2 ** MAX_ENC_CHAR_CODE.toString(2).length);
  do {
    const charCode = int & BigInt(MAX_ENC_CHAR_CODE);
    encoded += String.fromCharCode(Number.parseInt(charCode));
    int /= shift;
  } while (int > 0)
  return encoded;
}

function decodeBigInt(str, idx) {
  let sign = 1n;
  if (str.charAt(idx) === SEPARATORS.get("sign")) {
    sign = -1n;
    idx++;
  }
  if (str.charCodeAt(idx) > MAX_ENC_CHAR_CODE) throw new Error("Corrupted int encoding: Unexpected separator");
  let decoded = 0n;
  const shift = BigInt(MAX_ENC_CHAR_CODE.toString(2).length);

  let i = 0n;
  while (str.charCodeAt(idx) <= MAX_ENC_CHAR_CODE) {
    decoded += BigInt(str.charCodeAt(idx)) * (2n ** (shift * i++));
    idx++;
  }
  return { decoded: sign * decoded, idx };
}

function floatToBigInt(float) {
  const buf = new ArrayBuffer(8); // 64 bits
  const view = new DataView(buf);
  view.setFloat64(0, float);

  let result = 0n;
  for (let i = 0; i < 8; i++) {
    result = (result << 8n) | BigInt(view.getUint8(i));
  }
  return result;
}

function encodeNumber(number) {
  if (Number.isSafeInteger(number)) {
    return encodeBigInt(BigInt(number));
  } else {
    return encodeBigInt(floatToBigInt(number)) + SEPARATORS.get("float");
  }
}

function bigIntToFloat64(big) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  for (let i = 7; i >= 0; i--) {
    view.setUint8(i, Number(big & 0xFFn));
    big >>= 8n;
  }
  return view.getFloat64(0);
}

function decodeNumber(str, idx) {
  const decoded = decodeBigInt(str, idx);
  idx = decoded.idx;

  let number;
  if (str.charAt(idx) === SEPARATORS.get("float")) {
    number = bigIntToFloat64(decoded.decoded);
    idx++;
  } else {
    number = Number.parseInt(decoded.decoded);
  }

  return { decoded: number, idx };
}

function encodeColor(hexCode) {
  const code = hexCode.slice(1).padEnd(8, "F");
  const codeInt = Number.parseInt(code, 16);
  return encodeNumber(codeInt);
}

function decodeColor(str, idx) {
  let decoded = "#";
  const decodedInt = decodeNumber(str, idx);
  decoded += decodedInt.decoded.toString(16).padStart(8, "0");
  return { decoded, idx: decodedInt.idx };
}

export function encode(encoder, values) {
  const entries = [];
  for (const [category, settings] of Object.entries(values)) {
    for (const [key, value] of Object.entries(settings)) {
      entries.push([key, category, value]);
    }
  }
  entries.sort(([a], [b]) => a.localeCompare(b));

  let encoded = "";
  for (const [key, category, value] of entries) {
    encoded += encoder(category, key, value);
  }

  return new Promise((res, rej) => {
    LZMA.compress(encoded, 1, (compressed, err) => {
      if (err) rej(new Error("Error during LZMA compression"));
      try {
        const asBigInt = compressed.reduce((acc, byte) => (acc << 8n) | BigInt(byte + 128), 0n);
        res(encodeBigInt(asBigInt));
      } catch (err) {
        rej(err);
      }
    });
  });
}

export async function encodeBase64(encoder, values) {
  const encoded = await encode(encoder, values);
  let base64 = btoa(unescape(encodeURIComponent(encoded)));
  base64 = base64.replaceAll("/", "_");
  base64 = base64.replaceAll("+", "-");
  return base64.replaceAll("=", "");
}

export function decode(decoder, encodedStr) {
  const lzmaEncoded = [];
  let lzmaAsBigInt = decodeBigInt(encodedStr, 0).decoded;
  while (lzmaAsBigInt > 0n) {
    lzmaEncoded.unshift(Number(lzmaAsBigInt & 0xFFn) - 128); // Get least significant byte
    lzmaAsBigInt >>= 8n; // Shift 8 bits to the right
  }

  return new Promise((res, rej) => {
    LZMA.decompress(lzmaEncoded, (decompressed, err) => {
      if (err) rej(new Error("Error during LZMA decompression"));
      try {
        const values = {
          allModes: {},
          lightMode: {},
          darkMode: {}
        };

        let idx = 0;
        while (idx < decompressed.length) {
          const decoded = decoder(decompressed, idx);

          values[decoded.category][decoded.key] = decoded.value;
          idx = decoded.idx;
        }

        res(values);
      } catch (err) {
        rej(err);
      }
    });
  });

}

export function decodeBase64(decoder, base64) {
  base64 = base64.replaceAll("_", "/");
  base64 = base64.replaceAll("-", "+");
  base64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const encoded = decodeURIComponent(escape(atob(base64)));
  return decode(decoder, encoded);
}

function test() {
  const tests = {
    async testEncodeDecode() {
      const defaults = {
        allModes: {
          changedInt: 1,
          unchangedFloat: 1.00000001,
          unchangedBool: true,
          setNullToArray: null,
          unchangedArray: [1, 4, 2]
        },
        lightMode: {
          changedColor: "#ABCDEF05",
          setArrayNull: [],
          setArrayEmpty: [1,2,3]
        }, 
        darkMode: {
          unchangedColor: "#123456"
        }
      };
      const custom = {
        allModes: {
          changedInt: 2,
          unchangedFloat: 1.00000001,
          unchangedBool: true,
          "123_ChangedFamilySettingWithGene:12": false,
          "123_ChangedFamilySettingWithGene:13": false,
          "124_ChangedFamilySettingWithGene:14": false,
          "124_ChangedFamilySettingWithGene:15": false,
          setNullToArray: [1, 16, 12],
          unchangedArray: [4, 1, 2]
        },
        lightMode: {
          changedColor: "#00666666",
          "123_UnchangedFamilySettingWithoutGene": "#FFFFFF",
          setArrayEmpty: [],
          setArrayNull: null
        },
        darkMode: {
          unchangedColor: "#123456"
        }
      };
      const expected = {
        allModes: {
          "123_ChangedFamilySettingWithGene:12": false,
          "123_ChangedFamilySettingWithGene:13": false,
          "124_ChangedFamilySettingWithGene:14": false,
          "124_ChangedFamilySettingWithGene:15": false,
          changedInt: 2,
          setNullToArray: [1, 12, 16]
        },
        lightMode: {
          changedColor: "#00666666",
          setArrayEmpty: [],
          setArrayNull: null
        },
        darkMode: {}
      };

      const familyKeyTypes = {
        ChangedFamilySettingWithGene: { type: "boolean", default: (family) => true },
        UnchangedFamilySettingWithoutGene: { type: "string", default: (family) => "#FFFFFF" },
      }

      const encoder = getEncoder(defaults, familyKeyTypes);
      const encoded = await encodeBase64(encoder.encode, custom);
      const decoded = await decodeBase64(encoder.decode, encoded);

      if (JSON.stringify(decoded) !== JSON.stringify(expected)) {
        throw new Error("Mismatched decoding");
      }
    },
    testInt() {
      const ints = [MAX_CHAR_CODE * 12, 12, 0, MAX_CHAR_CODE, MAX_CHAR_CODE - 1, 100000000, -100000000, 2882400255, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
      for (const int of ints) {
        const encodedInt = encodeNumber(int);
        const decodedInt = decodeNumber(encodedInt, 0);

        if (decodedInt.decoded !== int) {
          throw new Error(`Integer decoding failed, expected ${int}, got ${decodedInt.decoded}`);
        }
        if (decodedInt.idx !== encodedInt.length) {
          throw new Error(`Integer decoding for ${int} returned wrong index, expected ${encodedInt.length}, got ${decodedInt.idx}`);
        }
      }
    },
    testFloat() {
      const floats = [MAX_CHAR_CODE * 12, 12, 0.00000001, MAX_CHAR_CODE, MAX_CHAR_CODE - 1, 100000000, -100000000, 2882400255].map(f => f * Math.PI);

      for (const float of [...floats, Number.MAX_VALUE, Number.MIN_VALUE]) {
        const encodedFloat = encodeNumber(float);
        const decodedFloat = decodeNumber(encodedFloat, 0);

        if (decodedFloat.decoded !== float) {
          throw new Error(`Float decoding failed, expected ${float}, got ${decodedFloat.decoded}`);
        }
        if (decodedFloat.idx !== encodedFloat.length) {
          throw new Error(`Float decoding for ${float} returned wrong index, expected ${encodedFloat.length}, got ${decodedFloat.idx}`);
        }
      }
    },
    testColor() {
      const colors = ["#ABCDEF", "#ABCDEF10"];
      for (const color of colors) {
        const encodedColor = encodeColor(color);
        const decodedColor = decodeColor(encodedColor, 0);

        const expected = color.padEnd(9, "F").toLowerCase();
        if (decodedColor.decoded !== expected) {
          throw new Error(`Color encoding failed, expected '${expected}', got '${decodedColor.decoded}'`);
        }
        if (decodedColor.idx !== encodedColor.length) {
          throw new Error(`Color decoding returned wrong index, expected ${encodedColor.length}, got ${decodedColor.idx}`);
        }
      }
    }
  }

  for (const [test, func] of Object.entries(tests)) {
    try {
      func();
      console.log(`${test}: SUCCESS`)
    } catch (err) {
      console.error(`${test}: FAILED: ${err.message}`, err);
    }
  }
}

// note that if you run tests, all previous encodings (e.g. in URLs) won't decode correctly,
// as the separators differ then because the test function initializes some separators when calling getEncoder
test()