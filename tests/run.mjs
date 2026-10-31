// In-process execution also works in environments that restrict spawning test workers.
// Assertions in the integration suites reject this module; node:test owns the pairing tests.
await import('./extension.test.mjs');
await import('./harness.test.mjs');
await import('./pairing.test.mjs');
