This original QA asset is a 180 second, 320 × 180 solid-colour VP8 WebM. It has
no external source or user content and one silent Opus audio track so native
volume controls are available. Native media metadata, decoding,
seeking and browser controls remain real. Reproduce with FFmpeg:

```text
ffmpeg -f lavfi -i color=c=0x234657:s=320x180:r=1:d=180 -f lavfi -i anullsrc=r=48000:cl=mono -t 180 -c:v libvpx -b:v 15k -g 10 -c:a libopus -b:a 6k -metadata title="Entropy native controls QA 180 seconds" native-video-skip.webm
```

FFmpeg is only an asset-authoring dependency, never a QA runtime dependency.
