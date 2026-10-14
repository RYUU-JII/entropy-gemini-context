import { useState, useSyncExternalStore } from 'react';
import { createSessionFeedRepository } from '../data/createSessionFeedRepository.js';
import { FEED_POSTS } from '../content/posts.js';
import { SHORT_FORM_POSTS } from '../content/shortFormPosts.js';

const ALL_POSTS = Object.freeze([...FEED_POSTS, ...SHORT_FORM_POSTS]);

export function useFeedRepository() {
  const [repository] = useState(() => createSessionFeedRepository({ posts: ALL_POSTS }));
  const snapshot = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  return { repository, snapshot };
}
