# Group Cards into Collections

Supersedes [ADR-0006](0006-defer-card-collections.md), which deferred grouping until mixed-language
use demonstrated the need. The app now holds Vietnamese and English Cards, so the need is
demonstrated: Review Sessions mixed both languages, and the global front-uniqueness index refused the
same German prompt for two different languages.

Every Card belongs to exactly one Collection (`cards.collection_id`, `NOT NULL`). Sub-grouping
_across_ languages is another Collection rather than a nested Collection: a single membership keeps
front uniqueness, Review queues, and deletion unambiguous, and the household can create as many
Collections as it wants. Overlapping subsets _inside_ a Collection are Topics
([ADR-0013](0013-group-cards-with-topics-inside-a-collection.md)).

Front uniqueness moved from global to per-Collection. Deleting a Collection soft-deletes the
Collection and all of its active Cards after the Learner confirms that the Cards will also be
deleted. Their Reviews remain in the append-only Review log, following
[ADR-0011](0011-keep-reviews-when-a-card-is-deleted.md). The last remaining Collection may also be
deleted; the Learner can create a new Collection from the resulting empty state.

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
