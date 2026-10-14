# Session interaction boundary

`createSessionFeedRepository({ posts })` owns only this page's mounted session.
It exposes `getSnapshot`, `subscribe`, `toggleLike`,
`addComment`, and `removeComment`. All commands are synchronous; snapshots and
entries are immutable, and unchanged reads return the same snapshot reference.
`subscribe` returns an unsubscribe function and notifies after each successful
mutation. Comments use plain text, a maximum of 500 Unicode code points, session
sequence IDs, and ISO creation timestamps. Invalid post/comment IDs throw.

Likes and comments begin at zero. They represent only interactions made during
this page session, not shared popularity. Refreshing resets them. No browser
storage, extension API, or network is used. The UI must disclose this scope.

A future shared backend needs its own explicit repository and admission/error
contract, not a local mirror or an implicit fallback inside this repository.
Networking and moderation belong to that future boundary. Sharing stays a UI
capability and does not change repository state.
