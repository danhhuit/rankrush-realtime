import { describe, expect, it } from "vitest";
import { isUnsafeNickname } from "./nickname-filter.js";

describe("isUnsafeNickname", () => {
  it("keeps common Vietnamese and international names", () => {
    for (const name of [
      "Thành Danh",
      "Quốc An",
      "Lê Hậu",
      "Hồng Vỹ",
      "Gia Hưng",
      "Alice",
      "Carlos",
      "Yuki",
      "Min-jun",
      "Cat",
      "Cát",
    ])
      expect(isUnsafeNickname(name), name).toBe(false);
  });

  it("detects profanity from multiple supported languages", () => {
    for (const name of ["fuck", "puta", "connard", "сука"])
      expect(isUnsafeNickname(name), name).toBe(true);
  });

  it("detects Vietnamese profanity with or without diacritics", () => {
    for (const name of ["địt mẹ", "duma", "vãi lồn", "cặt", "CẶT", "cặk"])
      expect(isUnsafeNickname(name), name).toBe(true);
  });

  it("detects common separator and leetspeak bypasses", () => {
    for (const name of ["f.u.c.k", "fu.ck", "sh1t", "đ.ị.t m.ẹ", "fu​ck"])
      expect(isUnsafeNickname(name), name).toBe(true);
  });
});
