# Compression of the config

To encode the config as a string that is as short as possible, so it can be shared in a URL, it is necessary to compress it.

This happens in these steps:
1. encode config data as compact parsible string
2. use LZMA algorithm to compress the string
3. encode returned byte array as shorter final string

For URL generation this final string is gonna be base64 encoded, with `/`, `+` replaced by `_`, `-` and trailing `=` removed.

***

## Step 1: encode config data as compact parsible string

The encoding of the data follows the concept of key-value pairs.
After the encoded key its related encoded value follows.
The keys act as separators here, so when decoding, the value ends if the next key comes.
Each key in the config has a default value. Thus, a key-value pair will only be encoded if the value doesn't match its default.

### Encoding Values

Value encoding is actually only boolean and integer encoding only. Color codes are treated as hexadecimal number, integers as integers and for floats, their underlying bits are just treated as if they encode an integer. Encoding strings is not yet supported, see the future enhancements at the end of this Readme.

#### Encoding Integers

Integers will be treated as character codes. JavaScript supports up to 16-bit characters.
As some characters need to be reserved for separators/keys, the integers are using only 15-bit characters.

Therefore, here the code for encoding integer `int`:
```js
encoded = "";
while (int > 0) {
  charCode = last15bits(int);
  encoded += String.fromCharCode(charCode);
  int = shift(int, 15);
}
```

When decoding, the char codes will be concatenated on bit-level.

For floats a special "float" separator character will be appended to the encoding to tell the decoder that the decoded integer's bits were originally floats.
This is necessary, as there are floats that can be treated as integers. So when decoding it would be a guessing of what was actually encoded if there isn't such indicating "float" character.

#### Encoding Booleans

The encoding of booleans is very simple. They don't have a value in their encoding, they consist of their key instead. There are default values for each key in the config. So if the key of a boolean appears in the encoding, it means that the value in the config is the negation of the default value. So if the default for `orbitMode` is `false` and the encoded key of `orbitMode` appears in the encoding, the value will be set to `true`.

### Encoding keys

There are two types of keys in the config:
1. static keys that are always the same in every environment
2. family related keys that depend on gene families

All keys are related to one of the following categories:
- allModes: keys that are dark/light mode independent
- lightMode: keys and their values for light mode
- darkMode: keys and their values for dark mode

Encoding static keys is very straight-forward, each of them (pattern `${key}:${category}`, like `scale:allModes`) gets a unique separator character assigned with a char code in range 2<sup>15</sup>-2<sup>16</sup>, as the other characters are used in integer encoding. That's it.

Encoding family related keys is more tricky, as there will exist more families than available separator characters.
- each family related key follows this regular expression `^(\d+)_(\w+)(:\d+)?`
  - the first group specifies the id of the family (if it is not efficiently possible to assign each family a unique numeric id, use its identifier as string, but this will need string encoding, for that see the future enhancements at the end of this Readme)
  - the second group specifies the setting the key is related to, e.g. the key `123_ShiftVector:1` toggles the shift vector for gene with index `1` for family `123`
  - the third group is optional and specifies the gene index the setting is related to. It is optional, as there are settings that affect the whole family (like if centroid is shown or not), but also some that are gene related (like if the shift vector for a gene is shown)

Having this, the encoded key is built from multiple parts:
1. separator character `familyKeyStart` to announce a family related key
2. the encoded family id (first group)
3. the encoded second group, the related setting. As the number of those settings is static, they get a unique separator character assigned as well as the non-family related keys, but here with the pattern `${key}_${category}`, so they use underscore instead of a colon.
4. (optional) if a gene index was specified (third group), its encoding follows here
5. separator `familyKeyStop` tells that the key ends here

There is one optimization concerning family related keys. Before encoding the config object, all key-value pairs will be sorted by their key.
In this way, all settings related to a family come in a sequence. This can be exploited.
Instead of encoding the same family id for every key of this family, the family is only encoded for the first element,
and all following keys that are part of the family will be encoded without the trailing "familyKeyStart" character and the encoded family.
They simply start with the encoded second group.
So when decoding and finding such encoded group without trailing "familyKeyStart" implies that the family of the previous key is used.

### Encoding arrays

Currently, there is only encoding of numeric arrays supported. It can be easily extended for arrays with color codes if there is a real use case for it in the future.
Arrays of strings may be also possible in future, see the future enhancements concerning strings at the end of this Readme.

Anyway, arrays store only elements of the same data type.

It will be encoded as follows:
```js
if (array === null) {
  return encode(key) + separator("null");
} else {
  encoding = encode(key);
  encoding += array.map(element => encode(element)).join(separator("array"));
  return encoding;
}
```

So each key with array typed value accepts `null` as value. `null` will be treated by the config as `all possible values`, e.g. in key `shownFamilies`, it means that all families are shown.

When decoding:
- `null` follows after key means value `null`
- a separator character unlike `null` follows after key means value `[]`
- a value follows means: Take it as first element and append all values of the following key-value pairs if key is `array` separator

***

### Future Enhancements

#### Arrays: range

Currently, the numeric values of arrays are simply encoded and separated by the separator `array`. But when having an array of integers, a significant improvement can be done. Imagine an array with ascending integers, which is common if we have an array of indices, like `[1,2,3,5]`.
Instead of encoding every single int, the series `1,2,3` could be encoded as `encode(1) + separator("range") + encode(3)`, which reduces this overhead for encoding `2`. The longer the series, the more benefit. Even in the smallest case of range `1-2` (`encode(1) + separator("range") + encode(2)`) it would be just the same amount of characters as if encoding as `1,2` (`encode(1) + separator("array") + encode(2)`).
So in the end it is a good improvement for integer arrays.

#### Strings

Strings are kinda tricky in the encoding, as they may contain separator characters. Thus, here a workaround for that:
- in encoding:
  1. create empty strings array
  2. when encoding a string, push it to strings array and encode its index instead
  3. when all values encoded and strings array is not empty, append `strings` separator to encoding, followed by the JSON stringified strings array (with removed unnecessary chars like brackets)
- in decoding:
  Before decoding the data, the string array needs to be extracted and used as lookup in decoding, as the strings are encoded as indices.
  ```js
  [encoded, ...split] = encoded.split(separator("strings"));
  stringArray = parse(split.join(separator("strings")));
  return decode(encoded, stringArray);
  ```