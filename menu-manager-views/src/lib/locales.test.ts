import { describe, expect, it } from "vitest";
import en from "../../settings/locales/en.json";
import fr from "../../settings/locales/fr.json";
import ja from "../../settings/locales/ja.json";
import zh from "../../settings/locales/zh.json";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`),
  );
const placeholders = (value: string) => (value.match(/{{\s*\w+\s*}}/g) ?? []).sort((a, b) => a.localeCompare(b));
const reference = flatten(en);

describe.each([
  ["fr", fr],
  ["ja", ja],
  ["zh", zh],
] as const)("%s.json against en.json", (_language, locale) => {
  const entries = flatten(locale);
  it("has exactly the keys of en.json, in the same order", () => {
    expect(entries.map(([key]) => key)).toEqual(reference.map(([key]) => key));
  });
  it("keeps the placeholders of every value", () => {
    const byKey = new Map(entries);
    expect(reference.filter(([k, v]) => placeholders(byKey.get(k) ?? "").join() !== placeholders(v).join()).map(([k]) => k)).toEqual([]);
  });
});
