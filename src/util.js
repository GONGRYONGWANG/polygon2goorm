export function readUint16LE(view, offset) {
  return view.getUint16(offset, true);
}

export function readUint32LE(view, offset) {
  return view.getUint32(offset, true);
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64DataUrl(bytes, mimeType) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function decodeBestEffort(bytes) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  let euckr = utf8;
  try {
    euckr = new TextDecoder("euc-kr", { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
  return scoreKorean(euckr) > scoreKorean(utf8) ? euckr : utf8;
}

function scoreKorean(text) {
  let score = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) score += 3;
    else if (code === 0xfffd) score -= 5;
    else if (code >= 0x4e00 && code <= 0x9fff) score -= 1;
  }
  return score;
}
