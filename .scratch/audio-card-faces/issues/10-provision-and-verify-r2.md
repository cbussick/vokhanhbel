# 10 — Provision and verify live R2 integration

**What to build:** Have the household operator provision isolated private Cloudflare R2 resources and verify the complete recording lifecycle against a real preview bucket before release. Record evidence that the deployed configuration uses the intended EU environment and cannot alter production recordings from preview.

**Blocked by:** 04 — Safely edit and delete Card recordings; 09 — Prepare isolated R2 environments for operation.

**Status:** ready-for-human

- [ ] Cloudflare R2 is enabled and separate private Standard buckets exist for preview and production in the EU jurisdiction.
- [ ] Preview and production credentials are restricted to their required bucket operations, stored only in the corresponding server environment, and cannot access the other environment's bucket.
- [ ] A preview deployment successfully uploads a supported recording, plays it through the authenticated application endpoint with required range behavior, replaces it, and removes the obsolete bytes.
- [ ] Removing face audio and soft-deleting a Card remove the corresponding preview objects from live storage.
- [ ] An abandoned staged upload expires according to the documented policy, and an induced deletion failure produces observable retry evidence that can be resolved safely.
- [ ] Unauthenticated playback, direct public object access, and use of preview credentials against production are rejected.
- [ ] Verification evidence records the EU endpoint, bucket isolation, lifecycle results, and the accepted absence of audio backup without including credentials, object keys, or personal recordings.
