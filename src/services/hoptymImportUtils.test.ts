import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHoptymBoolean, parseHoptymDate, parseHoptymNumber } from "./hoptymImportUtils";

test("number parser handles French and English decimal/group separators", () => {
  assert.equal(parseHoptymNumber("1 234,56 €"), 1234.56);
  assert.equal(parseHoptymNumber("1.234,56"), 1234.56);
  assert.equal(parseHoptymNumber("1,234.56"), 1234.56);
  assert.equal(parseHoptymNumber("1,234"), 1234);
  assert.equal(parseHoptymNumber("89.90"), 89.9);
  assert.equal(parseHoptymNumber("12%"), 12);
  assert.equal(parseHoptymNumber("not-a-number"), null);
});

test("date parser handles ISO, French and Excel serial dates without timezone drift", () => {
  assert.equal(parseHoptymDate("2026-11-14T00:00:00+02:00"), "2026-11-14");
  assert.equal(parseHoptymDate("14/11/2026"), "2026-11-14");
  assert.equal(parseHoptymDate(46340), "2026-11-14");
  assert.equal(parseHoptymDate("2026-02-31"), null);
  assert.equal(parseHoptymDate("not-a-date"), null);
});

test("boolean parser recognizes localized restriction flags", () => {
  assert.equal(parseHoptymBoolean("oui"), true);
  assert.equal(parseHoptymBoolean("fermé"), true);
  assert.equal(parseHoptymBoolean("false"), false);
  assert.equal(parseHoptymBoolean("non"), false);
});
