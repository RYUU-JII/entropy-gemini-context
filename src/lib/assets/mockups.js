import previewPlaceholderUrl from '../../assets/mockups/images/preview-placeholder.svg?url';

function labelFromPath(path) {
  const filename = path.split('/').pop() || '';
  return filename.replace(/\.[^/.]+$/, '') || 'sample';
}

function buildVariants(entries, type) {
  return Object.entries(entries).map(([path, url]) => ({
    type,
    url,
    label: labelFromPath(path),
  }));
}

export const MOCKUP_IMAGE_VARIANTS = buildVariants(
  import.meta.glob('../../assets/mockups/images/*.{png,jpg,jpeg,webp,svg}', {
    query: '?url',
    import: 'default',
    eager: true,
  }),
  'image'
);

export const MOCKUP_VIDEO_VARIANTS = buildVariants(
  import.meta.glob('../../assets/mockups/video/*.{mp4,webm}', {
    query: '?url',
    import: 'default',
    eager: true,
  }),
  'video'
);

export const MOCKUP_MEDIA_VARIANTS = [
  ...(MOCKUP_IMAGE_VARIANTS.length
    ? MOCKUP_IMAGE_VARIANTS
    : [{ type: 'image', url: previewPlaceholderUrl, label: 'preview-placeholder' }]),
  ...MOCKUP_VIDEO_VARIANTS,
];
