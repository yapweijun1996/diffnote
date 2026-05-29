(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.XORNumberCipher = api;
  root.XORCipherTool = api;
}(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const COMPACT_FORMATS = {
    R: {
      mode: "XC1R",
      modeName: "raw-xor-base64url",
      compression: null,
    },
    G: {
      mode: "XC1G",
      modeName: "gzip-before-xor-base64url",
      compression: "gzip",
    },
    D: {
      mode: "XC1D",
      modeName: "deflate-raw-before-xor-base64url",
      compression: "deflate-raw",
    },
    B: {
      mode: "XC1B",
      modeName: "brotli-before-xor-base64url",
      compression: "brotli",
    },
  };

  function requireValue(value, label) {
    if (!value) {
      throw new Error(`${label} is required.`);
    }
  }

  function cleanCiphertext(ciphertext) {
    return String(ciphertext || "").replace(/\s+/g, "");
  }

  function isCompactCiphertext(ciphertext) {
    return /^XC[12]/u.test(cleanCiphertext(ciphertext));
  }

  function isNumberCiphertext(ciphertext) {
    const clean = cleanCiphertext(ciphertext);
    return clean.length > 0 && /^\d+$/.test(clean);
  }

  function validateNumberCiphertext(ciphertext) {
    const clean = cleanCiphertext(ciphertext);
    requireValue(clean, "Ciphertext");

    if (!/^\d+$/.test(clean)) {
      throw new Error("Ciphertext must contain numbers only.");
    }

    if (clean.length % 3 !== 0) {
      throw new Error("Ciphertext length must be divisible by 3.");
    }

    for (let i = 0; i < clean.length; i += 3) {
      const value = Number(clean.slice(i, i + 3));
      if (value < 0 || value > 255) {
        throw new Error("Each encrypted number must be between 000 and 255.");
      }
    }

    return clean;
  }

  function formatNumberGroups(ciphertext) {
    return cleanCiphertext(ciphertext).replace(/(\d{3})(?=\d)/g, "$1 ");
  }

  function encryptToNumbers(message, key) {
    requireValue(message, "Message");
    requireValue(key, "Key");

    const messageBytes = encoder.encode(message);
    return encryptBytesToNumbers(messageBytes, key);
  }

  function encryptBytesToNumbers(bytes, key) {
    return bytesToNumberGroups(xorBytes(bytes, key));
  }

  function decryptFromNumbers(ciphertext, key) {
    requireValue(key, "Key");

    const outputBytes = decryptNumbersToBytes(ciphertext, key);

    return decoder.decode(outputBytes);
  }

  function decryptNumbersToBytes(ciphertext, key) {
    requireValue(key, "Key");

    const clean = validateNumberCiphertext(ciphertext);
    return xorBytes(numberGroupsToBytes(clean), key);
  }

  function xorBytes(bytes, key) {
    requireValue(key, "Key");

    const keyBytes = encoder.encode(key);
    const outputBytes = new Uint8Array(bytes.length);

    for (let i = 0; i < bytes.length; i += 1) {
      outputBytes[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return outputBytes;
  }

  function bytesToNumberGroups(bytes) {
    return Array.from(bytes, (byte) => String(byte).padStart(3, "0")).join("");
  }

  function numberGroupsToBytes(numberGroups) {
    const clean = validateNumberCiphertext(numberGroups);
    const bytes = [];

    for (let i = 0; i < clean.length; i += 3) {
      bytes.push(Number(clean.slice(i, i + 3)));
    }

    return new Uint8Array(bytes);
  }

  function normalizeCompressionFormat(format) {
    return format || "gzip";
  }

  function requireCompressionStream(type) {
    const ctor = root[type];
    if (typeof ctor !== "function") {
      throw new Error(`${type} is not available in this runtime.`);
    }
    return ctor;
  }

  function isCompressionFormatSupported(format) {
    const normalized = normalizeCompressionFormat(format);

    if (!root.CompressionStream || !root.DecompressionStream) {
      return false;
    }

    try {
      new root.CompressionStream(normalized);
      new root.DecompressionStream(normalized);
      return true;
    } catch (error) {
      return false;
    }
  }

  function bytesToBinary(bytes) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return binary;
  }

  function binaryToBytes(binary) {
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  function bytesToBase64Url(bytes) {
    const base64 = typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(bytesToBinary(bytes));

    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
  }

  function base64UrlToBytes(text) {
    const clean = cleanCiphertext(text);

    if (!/^[A-Za-z0-9_-]*$/u.test(clean)) {
      throw new Error("Compact ciphertext payload must be Base64URL text.");
    }

    const base64 = clean.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat((4 - (clean.length % 4)) % 4);

    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(base64, "base64"));
    }

    return binaryToBytes(atob(base64));
  }

  function bytesToAscii85(bytes) {
    let output = "";

    for (let i = 0; i < bytes.length; i += 4) {
      const remaining = Math.min(4, bytes.length - i);
      const block = new Uint8Array(4);
      block.set(bytes.subarray(i, i + remaining));
      let value = ((block[0] * 256 + block[1]) * 256 + block[2]) * 256 + block[3];
      const encoded = new Array(5);

      for (let j = 4; j >= 0; j -= 1) {
        encoded[j] = String.fromCharCode((value % 85) + 33);
        value = Math.floor(value / 85);
      }

      output += encoded.slice(0, remaining === 4 ? 5 : remaining + 1).join("");
    }

    return output;
  }

  function ascii85ToBytes(text) {
    const clean = cleanCiphertext(text);

    if (!/^[!-u]*$/u.test(clean)) {
      throw new Error("Compact v2 ciphertext payload must be ASCII85 text.");
    }

    if (clean.length % 5 === 1) {
      throw new Error("Invalid ASCII85 payload length.");
    }

    const bytes = [];

    for (let i = 0; i < clean.length; i += 5) {
      const chunk = clean.slice(i, i + 5);
      const finalChunk = chunk.length < 5;
      const padded = finalChunk ? chunk.padEnd(5, "u") : chunk;
      let value = 0;

      for (let j = 0; j < 5; j += 1) {
        value = value * 85 + (padded.charCodeAt(j) - 33);
      }

      const block = [
        Math.floor(value / 16777216) & 255,
        Math.floor(value / 65536) & 255,
        Math.floor(value / 256) & 255,
        value & 255,
      ];
      bytes.push(...block.slice(0, finalChunk ? chunk.length - 1 : 4));
    }

    return new Uint8Array(bytes);
  }

  async function compressBytes(bytes, format) {
    const normalized = normalizeCompressionFormat(format);
    const Compression = requireCompressionStream("CompressionStream");
    const stream = new Blob([bytes]).stream().pipeThrough(new Compression(normalized));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decompressBytes(bytes, format) {
    return decoder.decode(await decompressToBytes(bytes, format));
  }

  async function decompressToBytes(bytes, format) {
    const normalized = normalizeCompressionFormat(format);
    const Decompression = requireCompressionStream("DecompressionStream");
    const stream = new Blob([bytes]).stream().pipeThrough(new Decompression(normalized));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function zipNumberCiphertext(ciphertext) {
    const clean = validateNumberCiphertext(ciphertext);
    const compressed = await compressBytes(encoder.encode(clean));
    return bytesToNumberGroups(compressed);
  }

  async function unzipNumberCiphertext(zippedCiphertext) {
    const compressedBytes = numberGroupsToBytes(zippedCiphertext);
    const restored = await decompressBytes(compressedBytes);
    return validateNumberCiphertext(restored);
  }

  async function encryptToZippedNumbers(message, key) {
    return await zipNumberCiphertext(encryptToNumbers(message, key));
  }

  async function decryptFromZippedNumbers(zippedCiphertext, key) {
    return decryptFromNumbers(await unzipNumberCiphertext(zippedCiphertext), key);
  }

  async function encryptCompressedToNumbers(message, key) {
    requireValue(message, "Message");
    requireValue(key, "Key");

    const compressed = await compressBytes(encoder.encode(message));
    return encryptBytesToNumbers(compressed, key);
  }

  async function decryptCompressedFromNumbers(ciphertext, key) {
    const compressed = decryptNumbersToBytes(ciphertext, key);
    const plainBytes = await decompressToBytes(compressed);
    return decoder.decode(plainBytes);
  }

  async function encryptToShortestNumbers(message, key) {
    const normal = encryptToNumbers(message, key);
    const compressed = await encryptCompressedToNumbers(message, key);

    if (compressed.length < normal.length) {
      return {
        ciphertext: compressed,
        compressed: true,
        zipped: true,
        normalLength: normal.length,
        compressedLength: compressed.length,
        zippedLength: compressed.length,
        savedDigits: normal.length - compressed.length,
      };
    }

    return {
      ciphertext: normal,
      compressed: false,
      zipped: false,
      normalLength: normal.length,
      compressedLength: compressed.length,
      zippedLength: compressed.length,
      savedDigits: 0,
    };
  }

  async function encryptBestNumbers(message, key) {
    requireValue(message, "Message");
    requireValue(key, "Key");

    const normal = encryptToNumbers(message, key);
    const compressed = await encryptCompressedToNumbers(message, key);
    const doubleCompressed = await zipNumberCiphertext(compressed);
    const candidates = [
      {
        mode: "000",
        modeName: "normal",
        payload: normal,
      },
      {
        mode: "001",
        modeName: "gzip-before-encrypt",
        payload: compressed,
      },
      {
        mode: "002",
        modeName: "gzip-before-encrypt-plus-gzip",
        payload: doubleCompressed,
      },
    ].map((candidate) => ({
      ...candidate,
      ciphertext: `${candidate.mode}${candidate.payload}`,
      length: candidate.payload.length + 3,
    }));
    const best = candidates.reduce((winner, candidate) => (
      candidate.length < winner.length ? candidate : winner
    ));

    return {
      ciphertext: best.ciphertext,
      mode: best.mode,
      modeName: best.modeName,
      normalLength: candidates[0].length,
      compressedLength: candidates[1].length,
      doubleCompressedLength: candidates[2].length,
      selectedLength: best.length,
      savedDigits: Math.max(0, candidates[0].length - best.length),
      candidates,
    };
  }

  async function decryptBestNumbers(ciphertext, key) {
    requireValue(key, "Key");

    const clean = validateNumberCiphertext(ciphertext);
    if (clean.length < 6) {
      throw new Error("Best ciphertext must include a 3-digit mode header and payload.");
    }

    const mode = clean.slice(0, 3);
    const payload = clean.slice(3);

    if (mode === "000") {
      return decryptFromNumbers(payload, key);
    }

    if (mode === "001") {
      return await decryptCompressedFromNumbers(payload, key);
    }

    if (mode === "002") {
      const compressedCiphertext = await unzipNumberCiphertext(payload);
      return await decryptCompressedFromNumbers(compressedCiphertext, key);
    }

    throw new Error(`Unsupported best ciphertext mode: ${mode}.`);
  }

  async function encodeNumber(message, key, options) {
    requireValue(message, "Message");
    requireValue(key, "Key");

    const mode = options && options.mode ? String(options.mode).toLowerCase() : "normal";
    const normal = encryptToNumbers(message, key);

    if (mode === "normal" || mode === "none" || mode === "raw" || mode === "000") {
      const ciphertext = `000${normal}`;
      return {
        ciphertext,
        format: "number",
        mode: "000",
        modeName: "normal",
        selectedLength: ciphertext.length,
        savedDigits: 0,
      };
    }

    const compressed = await encryptCompressedToNumbers(message, key);

    if (mode === "gzip" || mode === "compressed" || mode === "001") {
      const ciphertext = `001${compressed}`;
      return {
        ciphertext,
        format: "number",
        mode: "001",
        modeName: "gzip-before-encrypt",
        selectedLength: ciphertext.length,
        savedDigits: Math.max(0, normal.length + 3 - ciphertext.length),
      };
    }

    if (mode === "gzip-number" || mode === "double" || mode === "002") {
      const doubleCompressed = await zipNumberCiphertext(compressed);
      const ciphertext = `002${doubleCompressed}`;
      return {
        ciphertext,
        format: "number",
        mode: "002",
        modeName: "gzip-before-encrypt-plus-gzip",
        selectedLength: ciphertext.length,
        savedDigits: Math.max(0, normal.length + 3 - ciphertext.length),
      };
    }

    throw new Error(`Unsupported number compression mode: ${mode}.`);
  }

  function normalizeCompactMode(mode) {
    if (!mode || mode === "best") return null;

    const normalized = String(mode).toLowerCase();
    if (normalized === "raw" || normalized === "xc1r" || normalized === "r") return "R";
    if (normalized === "gzip" || normalized === "xc1g" || normalized === "g") return "G";
    if (normalized === "deflate-raw" || normalized === "deflate" || normalized === "xc1d" || normalized === "d") return "D";
    if (normalized === "brotli" || normalized === "xc1b" || normalized === "b") return "B";

    throw new Error(`Unsupported compact mode: ${mode}.`);
  }

  function encodeCompactPayload(bytes, encoding) {
    if (encoding === "base85") {
      return bytesToAscii85(bytes);
    }

    return bytesToBase64Url(bytes);
  }

  function decodeCompactPayload(text, encoding) {
    if (encoding === "base85") {
      return ascii85ToBytes(text);
    }

    return base64UrlToBytes(text);
  }

  async function buildCompactCandidate(plainBytes, key, modeCode, encoding) {
    const config = COMPACT_FORMATS[modeCode];
    if (!config) {
      throw new Error(`Unsupported compact mode: ${modeCode}.`);
    }

    if (config.compression && !isCompressionFormatSupported(config.compression)) {
      return {
        mode: config.mode,
        modeName: config.modeName,
        supported: false,
        skipped: true,
        reason: `${config.compression} is not available in this runtime.`,
      };
    }

    const payloadBytes = config.compression
      ? await compressBytes(plainBytes, config.compression)
      : plainBytes;
    const encryptedBytes = xorBytes(payloadBytes, key);
    const mode = encoding === "base85"
      ? config.mode.replace("XC1", "XC2")
      : config.mode;
    const ciphertext = `${mode}.${encodeCompactPayload(encryptedBytes, encoding)}`;

    return {
      ciphertext,
      format: "compact",
      mode,
      modeName: encoding === "base85"
        ? config.modeName.replace("base64url", "base85")
        : config.modeName,
      compression: config.compression || "none",
      encoding,
      selectedLength: ciphertext.length,
      length: ciphertext.length,
      supported: true,
      skipped: false,
    };
  }

  async function encodeCompact(message, key, options) {
    requireValue(message, "Message");
    requireValue(key, "Key");

    const plainBytes = encoder.encode(message);
    const requestedMode = normalizeCompactMode(options && options.mode);
    const requestedEncoding = options && options.encoding;
    const modeCodes = requestedMode ? [requestedMode] : ["R", "G", "D", "B"];
    const encodings = requestedEncoding ? [requestedEncoding] : ["base64url", "base85"];
    const candidates = [];

    for (const modeCode of modeCodes) {
      for (const encoding of encodings) {
        if (!["base64url", "base85"].includes(encoding)) {
          throw new Error(`Unsupported compact encoding: ${encoding}.`);
        }

        const candidate = await buildCompactCandidate(plainBytes, key, modeCode, encoding);
        candidates.push(candidate);
      }
    }

    const supportedCandidates = candidates.filter((candidate) => candidate.supported);
    if (!supportedCandidates.length) {
      throw new Error("No compact output modes are available in this runtime.");
    }

    if (requestedMode && supportedCandidates.length !== candidates.length) {
      throw new Error(candidates[0].reason || "Requested compact mode is not available.");
    }

    const best = supportedCandidates.reduce((winner, candidate) => (
      candidate.length < winner.length ? candidate : winner
    ));

    return {
      ciphertext: best.ciphertext,
      format: "compact",
      mode: best.mode,
      modeName: best.modeName,
      compression: best.compression,
      encoding: best.encoding,
      selectedLength: best.length,
      candidates,
    };
  }

  async function decodeCompact(ciphertext, key) {
    requireValue(key, "Key");

    const clean = cleanCiphertext(ciphertext);
    requireValue(clean, "Ciphertext");

    const match = clean.match(/^(XC[12][RGDB])\.([!-uA-Za-z0-9_-]*)$/u);
    if (!match) {
      throw new Error("Compact ciphertext must use XC1 or XC2 format.");
    }

    const modeCode = match[1].slice(-1);
    const encoding = match[1].startsWith("XC2") ? "base85" : "base64url";
    const config = COMPACT_FORMATS[modeCode];
    const encryptedBytes = decodeCompactPayload(match[2], encoding);
    const payloadBytes = xorBytes(encryptedBytes, key);

    if (!config.compression) {
      return decoder.decode(payloadBytes);
    }

    return decoder.decode(await decompressToBytes(payloadBytes, config.compression));
  }

  async function decodeAuto(ciphertext, key) {
    const clean = cleanCiphertext(ciphertext);
    requireValue(clean, "Ciphertext");

    if (isCompactCiphertext(clean)) {
      return await decodeCompact(clean, key);
    }

    if (isNumberCiphertext(clean)) {
      const mode = clean.slice(0, 3);
      if (["000", "001", "002"].includes(mode) && clean.length >= 6) {
        try {
          return await decryptBestNumbers(clean, key);
        } catch (error) {
          return decryptFromNumbers(clean, key);
        }
      }

      return decryptFromNumbers(clean, key);
    }

    throw new Error("Ciphertext must be numeric or start with XC1 compact format.");
  }

  async function encodeBest(message, key, options) {
    const output = options && options.output ? options.output : "auto";

    if (output === "number") {
      return {
        format: "number",
        ...await encryptBestNumbers(message, key),
      };
    }

    if (output === "compact") {
      return await encodeCompact(message, key, options);
    }

    if (output !== "auto") {
      throw new Error(`Unsupported output format: ${output}.`);
    }

    const numberResult = {
      format: "number",
      ...await encryptBestNumbers(message, key),
    };
    const compactResult = await encodeCompact(message, key, options);
    const best = compactResult.selectedLength < numberResult.selectedLength
      ? compactResult
      : numberResult;

    return {
      ...best,
      candidates: [
        {
          format: "number",
          mode: numberResult.mode,
          modeName: numberResult.modeName,
          length: numberResult.selectedLength,
          selectedLength: numberResult.selectedLength,
        },
        {
          format: "compact",
          mode: compactResult.mode,
          modeName: compactResult.modeName,
          length: compactResult.selectedLength,
          selectedLength: compactResult.selectedLength,
        },
      ],
    };
  }

  async function encode(message, key, options) {
    const output = options && options.output ? options.output : "number";

    if (output === "number") {
      return await encodeNumber(message, key, options);
    }

    return await encodeBest(message, key, options);
  }

  function buildXorRows(message, key, limit) {
    requireValue(key, "Key");

    const messageBytes = encoder.encode(message || "");
    const keyBytes = encoder.encode(key);
    const maxRows = Number.isFinite(limit) ? Math.max(0, limit) : messageBytes.length;
    const rows = [];

    for (let i = 0; i < Math.min(messageBytes.length, maxRows); i += 1) {
      const messageByte = messageBytes[i];
      const keyByte = keyBytes[i % keyBytes.length];
      const xor = messageByte ^ keyByte;
      rows.push({
        index: i + 1,
        messageByte,
        keyByte,
        xor,
        group: String(xor).padStart(3, "0"),
      });
    }

    return rows;
  }

  return {
    encode,
    decode: decodeAuto,
    encrypt: encryptToNumbers,
    decrypt: decryptFromNumbers,
    encryptToNumbers,
    decryptFromNumbers,
    encryptBytesToNumbers,
    decryptNumbersToBytes,
    xorBytes,
    validateNumberCiphertext,
    formatNumberGroups,
    cleanCiphertext,
    isNumberCiphertext,
    isCompactCiphertext,
    bytesToBase64Url,
    base64UrlToBytes,
    bytesToAscii85,
    ascii85ToBytes,
    compressBytes,
    decompressBytes,
    decompressToBytes,
    isCompressionFormatSupported,
    zipNumberCiphertext,
    unzipNumberCiphertext,
    encryptToZippedNumbers,
    decryptFromZippedNumbers,
    encryptCompressedToNumbers,
    decryptCompressedFromNumbers,
    encryptToShortestNumbers,
    encryptBestNumbers,
    decryptBestNumbers,
    encodeNumber,
    encodeCompact,
    decodeCompact,
    encodeBest,
    decodeAuto,
    buildXorRows,
  };
}));
