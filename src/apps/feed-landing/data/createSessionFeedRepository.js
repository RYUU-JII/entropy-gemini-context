export const MAX_COMMENT_LENGTH = 500;

const freezeEntry = (entry) => Object.freeze({
  ...entry,
  comments: Object.freeze(entry.comments),
});

/**
 * Owns real interactions for this mounted page session only. No persistence,
 * network, seeded popularity, or extension storage enters this repository.
 */
export function createSessionFeedRepository({ posts }) {
  if (!Array.isArray(posts)) throw new TypeError('Feed posts must be an array.');

  const initialEntries = Object.create(null);
  for (const post of posts) {
    if (typeof post?.id !== 'string' || post.id.trim() === '') {
      throw new TypeError('Every feed post must have a non-empty string id.');
    }
    if (Object.hasOwn(initialEntries, post.id)) {
      throw new Error(`Duplicate feed post id: ${post.id}`);
    }
    initialEntries[post.id] = freezeEntry({
      liked: false,
      likeCount: 0,
      comments: [],
    });
  }

  let snapshot = Object.freeze({ posts: Object.freeze(initialEntries), revision: 0 });
  let commentSequence = 0;
  const listeners = new Set();

  const requirePost = (postId) => {
    if (typeof postId !== 'string' || !Object.hasOwn(snapshot.posts, postId)) {
      throw new Error(`Unknown feed post: ${String(postId)}`);
    }
    return snapshot.posts[postId];
  };

  const publish = (postId, entry) => {
    snapshot = Object.freeze({
      posts: Object.freeze({ ...snapshot.posts, [postId]: freezeEntry(entry) }),
      revision: snapshot.revision + 1,
    });
    for (const listener of [...listeners]) listener(snapshot);
    return snapshot.posts[postId];
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A feed subscriber must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggleLike(postId) {
      const entry = requirePost(postId);
      return publish(postId, {
        ...entry,
        liked: !entry.liked,
        likeCount: entry.liked ? 0 : 1,
      });
    },
    addComment(postId, body) {
      const entry = requirePost(postId);
      if (typeof body !== 'string') throw new TypeError('A comment must be plain text.');
      const trimmedBody = body.trim();
      if (trimmedBody.length === 0) throw new Error('댓글 내용을 입력해 주세요.');
      if (Array.from(trimmedBody).length > MAX_COMMENT_LENGTH) {
        throw new Error(`댓글은 ${MAX_COMMENT_LENGTH}자까지 입력할 수 있습니다.`);
      }
      commentSequence += 1;
      const comment = Object.freeze({
        id: `session-comment-${commentSequence}`,
        author: '나',
        body: trimmedBody,
        createdAt: new Date().toISOString(),
      });
      publish(postId, { ...entry, comments: [...entry.comments, comment] });
      return comment;
    },
    removeComment(postId, commentId) {
      const entry = requirePost(postId);
      const comment = entry.comments.find((item) => item.id === commentId);
      if (!comment) throw new Error(`Unknown feed comment: ${String(commentId)}`);
      publish(postId, { ...entry, comments: entry.comments.filter((item) => item.id !== commentId) });
      return comment;
    },
  });
}
