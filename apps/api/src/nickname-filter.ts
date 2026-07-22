import { Profanity } from "@2toad/profanity";

const supportedLanguages = [
  "ar",
  "zh",
  "en",
  "fr",
  "de",
  "hi",
  "it",
  "ja",
  "ko",
  "pt",
  "ru",
  "es",
];

const vietnameseProfanity = [
  // Common unaccented spellings and abbreviations.
  "dit",
  "dit me",
  "ditme",
  "duma",
  "du ma",
  "dume",
  "du me",
  "dmm",
  "dm",
  "lon",
  "vai lon",
  "mat lon",
  "cac",
  "cak",
  "vai cac",
  "buoi",
  "dau buoi",
  "vcl",
  "vkl",
  "deo",
  "clm",
  "oc cho",
  "occho",
  "con cho",
  "thang cho",
  "do ngu",
  "dcm",
  "dkm",
  "chich",
  "cho de",
  "cho ma",
  "suc vat",
  "khon nan",
  "thang ngu",
  "con ngu",
  // Accented spellings and deliberate misspellings that must not be reduced
  // to ambiguous harmless words such as the English word "cat".
  "cặc",
  "cặt",
  "cẹc",
  "cạk",
  "cặk",
  "kặc",
  "kặt",
  "lồn",
  "lìn",
  "buồi",
  "địt",
  "đụ",
  "đéo",
  "đĩ",
  "điếm",
  "phò",
  "chịch",
  "đụ má",
  "đụ mẹ",
  "địt má",
  "địt mẹ",
  "óc chó",
  "chó đẻ",
  "chó má",
];

const filter = new Profanity({
  languages: supportedLanguages,
  wholeWord: true,
  unicodeWordBoundaries: true,
});
filter.addWords(vietnameseProfanity);

const lookalikes: Record<string, string> = {
  "@": "a",
  "4": "a",
  "8": "b",
  "3": "e",
  "1": "i",
  "!": "i",
  "|": "i",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
  "9": "g",
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  Α: "a",
  α: "a",
  Ε: "e",
  ε: "e",
  Ο: "o",
  ο: "o",
  Ρ: "p",
  ρ: "p",
  Χ: "x",
  χ: "x",
};

function normalizeLatin(value: string) {
  return value
    .normalize("NFKD")
    .replace(/đ/gi, "d")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi-VN");
}

function replaceLookalikes(value: string) {
  return [...value]
    .map((character) => lookalikes[character] ?? character)
    .join("");
}

function joinSeparatedLetters(value: string) {
  const tokens = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const output: string[] = [];
  for (let index = 0; index < tokens.length;) {
    if ([...tokens[index]!].length !== 1) {
      output.push(tokens[index]!);
      index += 1;
      continue;
    }
    let end = index;
    while (end < tokens.length && [...tokens[end]!].length === 1) end += 1;
    const run = tokens.slice(index, end);
    if (run.length >= 3) output.push(run.join(""));
    else output.push(...run);
    index = end;
  }
  return output.join(" ");
}

export function isUnsafeNickname(value: string) {
  const raw = value.normalize("NFKC").toLocaleLowerCase();
  const latin = normalizeLatin(raw);
  const deobfuscated = replaceLookalikes(latin);
  const separatedLettersJoined = joinSeparatedLetters(deobfuscated);
  const compact = deobfuscated.replace(/[^\p{L}\p{N}]+/gu, "");
  const candidates = new Set([
    raw,
    latin,
    deobfuscated,
    separatedLettersJoined,
    compact,
    deobfuscated.replace(/(.)\1{1,}/gu, "$1"),
    separatedLettersJoined.replace(/(.)\1{1,}/gu, "$1"),
    compact.replace(/(.)\1{1,}/gu, "$1"),
  ]);
  return [...candidates].some((candidate) => filter.exists(candidate));
}
