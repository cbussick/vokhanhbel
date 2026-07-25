# Use Shared-Password Session Authentication

The private household app needs to protect learning data and server-side AI costs, but V1 does not need public accounts or separate Learner identities. We use a server-verified shared password and opaque, server-side sessions in secure HTTP-only cookies; password hashes, session identifiers, CSRF checks, rate limiting, expiry, and logout are implemented server-side so a leaked browser token can be revoked immediately.
