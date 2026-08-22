const server = "postgresql://postgres:postgres@localhost:5433";

/**
 * The database the suite creates for itself and drops again. The name has to end in `_test`:
 * the global setup refuses to drop anything else, so a misconfiguration cannot reach the
 * development database.
 */
export const testDatabaseName = "vokhanhbel_test";

export const testDatabaseUrl = `${server}/${testDatabaseName}`;

/** Connecting to the test database itself would block dropping and creating it. */
export const maintenanceDatabaseUrl = `${server}/postgres`;
