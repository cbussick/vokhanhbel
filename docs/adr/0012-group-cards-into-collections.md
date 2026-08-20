# Group Cards into Collections

Supersedes [ADR-0006](0006-defer-card-collections.md), which deferred grouping until mixed-language
use demonstrated the need. The app now holds Vietnamese and English Cards, so the need is
demonstrated: Review Sessions mixed both languages, and the global front-uniqueness index refused the
same German prompt for two different languages.

Every Card belongs to exactly one Collection (`cards.collection_id`, `NOT NULL`). Sub-grouping is
another Collection rather than a nested or multi-valued relationship: a single membership keeps front
uniqueness, Review queues, and deletion unambiguous, and the household can create as many Collections
as it wants.

Front uniqueness moved from global to per-Collection. Deleting a Collection is a soft delete, refused
while it still holds active Cards and refused for the last remaining Collection, so no Card can lose
its Collection.

Points and statistics stay global, as [ADR-0008](0008-derive-points-from-review-log.md) requires.
They are derived from the whole Review log and are not split per Collection.

The migration adds `collection_id` with a column default pointing at the seeded "Vietnamesisch"
Collection. The default is what keeps the already-deployed application writable while the migration
runs ahead of the deploy, as [the deployment strategy](../deployment-strategy.md) requires.

The same migration backfills `reviews.result_card` with the Collection, because the Review replay path
parses those stored snapshots with the current Card contract. This is the one sanctioned exception to
the append-only Review guard from [ADR-0011](0011-keep-reviews-when-a-card-is-deleted.md): the
migration disables the trigger for that single statement inside the migration transaction and
re-enables it immediately. The backfilled value is the only one it could have been, since every
pre-existing Card moved into the same seeded Collection.
