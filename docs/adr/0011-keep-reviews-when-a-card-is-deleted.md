# Keep Reviews When a Card Is Deleted

Points derive from an append-only Review log, so cascading a Card deletion would erase earned Points and history. We soft-delete Cards with `deleted_at`, hiding them from study and lists while retaining their Reviews and awarded Points.
