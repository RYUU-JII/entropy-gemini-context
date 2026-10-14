# Original short-form motion

`ribbon-loop.mp4` and `ribbon-poster.webp` are repository-authored procedural
motion and its first frame. No external footage, music or image assets are used.
The clip is 480 × 854, H.264, 24 fps, six seconds, silent and seamlessly looping.

Reproduce explicitly from the native Windows repository with installed FFmpeg:

```powershell
node scripts/dev/feed-landing/generate-shortform-video.mjs
```

Ordinary builds consume these checked-in assets and never invoke an encoder.
All twelve authored slots intentionally reference this same source; their social
presentation format varies while the underlying clip remains identical.
