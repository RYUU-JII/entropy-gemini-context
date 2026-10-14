import { tRuntime } from '../../settings/i18n/runtime.js';

export function getInstagramSocialLabels() {
  return {
    LIKE: tRuntime('common:social.instagram.like'),
    COMMENT: tRuntime('common:social.instagram.comment'),
    REPOST: tRuntime('common:social.instagram.repost'),
    POSTS: tRuntime('common:social.instagram.posts'),
    FOLLOWER: tRuntime('common:social.instagram.follower'),
    FOLLOWING: tRuntime('common:social.instagram.following'),
    VIEWS: tRuntime('common:social.instagram.views'),
    UPLOAD: tRuntime('common:social.instagram.upload'),
  };
}

export function getGenericSocialLabels() {
  return {
    LIKE: tRuntime('common:social.actions.like'),
    COMMENT: tRuntime('common:social.actions.comment'),
  };
}
