// Handle version migrations for snapshots
export function migrateSnapshot(snapshot: any, fromVersion: number, toVersion: number) {
    if (fromVersion === toVersion) return snapshot;
    // Current only version 1, add rules later as needed
    return snapshot;
}
