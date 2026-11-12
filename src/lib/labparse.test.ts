import { describe, expect, it } from "vitest";
import { parseLabText } from "./labparse";

describe("lab slip parser", () => {
  it("reads a typical KK FBC block", () => {
    const p = parseLabText(`KLINIK KESIHATAN SEKSYEN 7\nDate: 05/11/2026\nHAEMOGLOBIN 13.2 g/dL\nHAEMATOCRIT 41.0 %\nWHITE BLOOD CELL 3.1 x10^9/L\nPLATELET 98 x10^9/L\nMCHC 33.1 g/dL`);
    expect(p).toMatchObject({ hb: 13.2, hct: 41, wcc: 3.1, plt: 98, date: "2026-11-05" });
  });
  it("normalises units", () => {
    const p = parseLabText(`Hb 132 g/L\nHct 0.44 L/L\nWBC 3,400 /uL\nPlatelet count 71,000 /uL`);
    expect(p).toMatchObject({ hb: 13.2, hct: 44, wcc: 3.4, plt: 71 });
  });
  it("fixes OCR digit confusions", () => {
    const p = parseLabText(`PCV 4O.5 %\nPLT 1l8 10^3/uL`);
    expect(p).toMatchObject({ hct: 40.5, plt: 118 });
  });
  it("ignores MCHC as haemoglobin", () => {
    const p = parseLabText(`MCHC 34.0\nHGB 12.1`);
    expect(p.hb).toBe(12.1);
  });
  it("rejects implausible values", () => {
    const p = parseLabText(`HCT 4100 %`);
    expect(p.hct).toBeUndefined();
  });
});
