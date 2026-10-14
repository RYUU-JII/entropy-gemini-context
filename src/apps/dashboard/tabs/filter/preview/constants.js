export const SETTINGS_PREVIEW_PLATFORMS = [
  { id: 'default', label: 'ENTROPY LAB', labelKey: 'preview.platforms.default', icon: 'monitor' },
  { id: 'default-dark', label: 'ENTROPY LAB // NIGHT', labelKey: 'preview.platforms.default_dark', icon: 'monitor' },
  { id: 'youtube', label: 'YouTube', labelKey: 'preview.platforms.youtube' },
  { id: 'x', label: 'X', labelKey: 'preview.platforms.x' },
  { id: 'instagram', label: 'Instagram', labelKey: 'preview.platforms.instagram' },
  { id: 'tiktok', label: 'TikTok', labelKey: 'preview.platforms.tiktok' },
];

export const MOCK_PLATFORM_DATA = {
  youtube: {
    title: '24시간 워크스테이션 브이로그 | 무보정 데스크 사운드',
    channel: 'Studio Delta',
    subscribers: '구독자 42.8만명',
    views: '조회수 9.8만회',
    age: '8시간 전',
    likes: '5,842',
    duration: '18:42',
    description: '신규 프로젝트 킥오프 데이의 실제 작업 흐름을 기록했습니다.\n#vlog #workflow #desksetup #build',
    comments: [
      { user: 'frame_hunter', text: '컷 전환 타이밍이 진짜 깔끔하네요.', likes: '41' },
      {
        user: 'render_lab',
        text: '렌더 세팅 프리셋 공유 가능할까요?',
        likes: '18',
        replies: [{ user: 'Studio Delta', text: '고정 댓글에 프리셋 링크 추가해뒀어요.', likes: '7' }]
      },
      { user: 'pixel_note', text: '키보드 타건음이 은근히 ASMR 같아서 계속 보게 됩니다.', likes: '63' },
      { user: 'night_shift', text: '야간 작업할 때 배경으로 두기 좋네요.', likes: '25' },
      { user: 'devjournal', text: '타임코드 챕터 구성 감사합니다.', likes: '29' },
      { user: 'layout_nerd', text: 'UI 모션 참고하기 좋아요.', likes: '16' },
      {
        user: 'gear_room',
        text: '사용한 마이크 모델 뭐예요?',
        likes: '11',
        replies: [{ user: 'Studio Delta', text: 'SM7B + CL-1 체인입니다.', likes: '6' }]
      },
      { user: 'codec_lane', text: '다음엔 색보정 파트 길게 다뤄주세요!', likes: '52' },
    ],
    recommendations: [
      { title: 'Client Landing Page Build Log', channel: 'UI Cartography', views: '12만회', age: '3일 전', duration: '22:11' },
      { title: 'Keyboard Sound Test: 12 Switches', channel: 'Input Forge', views: '38만회', age: '2주 전', duration: '16:03' },
      { title: 'Single Take Color Grading Breakdown', channel: 'Color Node', views: '7.1만회', age: '6일 전', duration: '14:57' },
      { title: 'Night Shift Livestream', channel: 'Buildlane', views: '8,941명 시청 중', age: '실시간', duration: 'LIVE' },
      { title: 'Minimal Desk Reset Routine', channel: 'Studio Habit', views: '28만회', age: '1개월 전', duration: '09:44' },
      { title: 'Notion Sprint Planning Tutorial', channel: 'Ops Journal', views: '4.5만회', age: '5일 전', duration: '19:08' },
      { title: 'Ambient Server Room Loop', channel: 'Loop Foundry', views: '61만회', age: '4개월 전', duration: '01:00:00' },
      { title: 'Camera Rig Under $500', channel: 'Gear Draft', views: '18만회', age: '2주 전', duration: '12:19' },
      { title: 'After Effects Text Motion Pack', channel: 'Motion Clerk', views: '9.3만회', age: '9일 전', duration: '08:52' },
      { title: 'SaaS Feature Demo Teardown', channel: 'Product Replay', views: '14만회', age: '11일 전', duration: '17:20' },
      { title: 'Lighting Setup for Tiny Rooms', channel: 'Frame Unit', views: '5.8만회', age: '1주 전', duration: '13:40' },
      { title: 'Weekly Creator KPI Review', channel: 'Dashboard Daily', views: '2.1만회', age: '1일 전', duration: '10:12' },
    ],
  },
  x: {
    name: 'Studio Delta',
    handle: '@studiodelta',
    time: '49m',
    metrics: {
      replies: '84',
      reposts: '241',
      likes: '3.7K',
      views: '26K',
    },
    trends: [
      { category: 'Trending in South Korea', name: '#BuildInPublic', posts: '27.3K posts' },
      { category: 'Design · Trending', name: 'Motion Pass', posts: '11.2K posts' },
      { category: 'Technology · Trending', name: 'Ship Day', posts: '8,044 posts' },
      { category: 'Business · Trending', name: 'Creator Stack', posts: '4,908 posts' },
    ],
  },
  instagram: {
    user: 'studio.delta',
    time: '2시간 전',
    likes: '좋아요 12,408',
    actionsLabel: '좋아요 · 댓글 · 공유',
  },
  tiktok: {
    user: '@studio.delta',
    music: 'Original Sound - Studio Delta',
    metrics: {
      likes: '58.9K',
      comments: '2,304',
      bookmarks: '1,104',
      shares: '9,812',
      views: '312K',
    },
  },
  defaults: {
    captionFallback: '새 작업 세션 시작. 오늘은 레이아웃 마감 + 모션 폴리시 정리.',
  },
};
