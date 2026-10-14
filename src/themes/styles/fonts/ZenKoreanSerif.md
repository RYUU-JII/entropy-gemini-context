# Zen Korean Serif Local

Noto Serif KR 2.003-H1, normal variable weight 400–700, renamed locally so
registering it cannot change the app-neutral Korean serif stack or other themes.
Zen's `tokens.typography` is the only consumer bridge. Latin remains App Serif
Local; the Korean face has an explicit Hangul/jamo/punctuation unicode range.

- Official Google Fonts commit: `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`.
- Original: `ofl/notoserifkr/NotoSerifKR[wght].ttf` in that commit.
- Original SHA-256: `11f8d5de6f1b79195efba3828aaa2ec95c1178f5ae976fb23c8d53250a9938f3`.
- Licence: SIL OFL 1.1, shipped as `public/OFL-ZenKoreanSerif.txt` and retained
  in the font name metadata alongside its original copyright.
- Coverage: all 2,350 KS X 1001 Hangul syllables, current Korean locale copy,
  supported Hangul jamo and punctuation. The script checks required syllables
  before and after generation. Dynamic names keep the browser's normal font
  matching outside the shipped repertoire.
- WOFF2: 1,068,916 bytes; SHA-256
  `6f8ea180c30bc3c2a5c6b48fb050155ca8920804492d7420e8d78665f0f62cdc`.

To regenerate, download the original from the pinned official commit into a
disposable task directory. With native Python, fonttools 4.61.1 and brotli 1.2.0:

```powershell
python scripts/dev/subset-zen-korean-serif.py <original-ttf-path>
```

The generator checks the original hash and does no network access. It subsets
characters before restricting the weight axis, preserves shaping features and
copyright/license metadata, and does not rewrite timestamps. Record any new
output hash in the release asset provenance ledger. Builds use only the checked-in
WOFF2 and never fetch fonts.
