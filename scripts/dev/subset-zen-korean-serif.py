"""Build the pinned, locally shipped Zen Korean serif (no network access).

Requires fonttools==4.61.1 and brotli==1.2.0. Pass the original official TTF
as the sole argument. Run from the repository root.
"""

import hashlib
import json
from pathlib import Path
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


SOURCE_SHA256 = "11f8d5de6f1b79195efba3828aaa2ec95c1178f5ae976fb23c8d53250a9938f3"
ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "src/themes/styles/fonts/ZenKoreanSerif-Variable.woff2"


def korean_copy_characters():
    def strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict):
            for item in value.values():
                yield from strings(item)
        elif isinstance(value, list):
            for item in value:
                yield from strings(item)

    characters = set()
    for source in sorted((ROOT / "src/i18n/locales/ko").glob("*.json")):
        for text in strings(json.loads(source.read_text(encoding="utf-8"))):
            characters.update(map(ord, text))
    return characters


def ks_hangul():
    return {
        ord(bytes([lead, trail]).decode("euc_kr"))
        for lead in range(0xB0, 0xC9)
        for trail in range(0xA1, 0xFF)
    }


def main():
    original = Path(sys.argv[1])
    if hashlib.sha256(original.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("ZEN_KOREAN_SERIF_SOURCE_SHA256_MISMATCH")
    font = TTFont(original, recalcTimestamp=False)
    version = font["name"].getDebugName(5)
    codepoints = ks_hangul() | korean_copy_characters()
    codepoints.update(range(0x20, 0x7F))
    for start, end in [(0x1100, 0x11FF), (0x3130, 0x318F), (0x3000, 0x303F)]:
        codepoints.update(range(start, end + 1))
    supported = set(font.getBestCmap())
    required_hangul = {cp for cp in codepoints if 0xAC00 <= cp <= 0xD7A3}
    if required_hangul - supported:
        raise ValueError("ZEN_KOREAN_SERIF_REQUIRED_HANGUL_MISSING")
    names = {1: "Zen Korean Serif Local", 2: "Regular",
             4: "Zen Korean Serif Local", 6: "ZenKoreanSerifLocal",
             16: "Zen Korean Serif Local", 17: "Regular"}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints & supported)
    subsetter.subset(font)
    instantiateVariableFont(font, {"wght": (400, 400, 700)}, inplace=True)
    font.flavor = "woff2"
    font.save(OUTPUT)
    shipped = TTFont(OUTPUT)
    if required_hangul - set(shipped.getBestCmap()):
        raise ValueError("ZEN_KOREAN_SERIF_SUBSET_COVERAGE_FAILED")
    print(json.dumps({"version": version, "bytes": OUTPUT.stat().st_size,
                      "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
                      "hangulSyllables": len(required_hangul),
                      "glyphs": len(shipped.getBestCmap())}, indent=2))


if __name__ == "__main__":
    main()
