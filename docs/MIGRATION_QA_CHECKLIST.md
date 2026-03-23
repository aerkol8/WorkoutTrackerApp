# Migration QA Checklist (Expo Go -> New Build)

This checklist validates guest backup migration, import, and post-login sync.

## Preconditions

- Old app (Expo Go) still has your real guest data.
- New app build is installed and opens correctly.
- Backup export/import is available in Profile settings.

## 1. Export from old app

1. Open old app (Expo Go container that has your history).
2. Go to `Profile -> Export Backup`.
3. Copy/share the generated JSON.
4. Save a copy outside the app (notes/file/password manager).

Expected:
- JSON includes `backupVersion`, `exportedAt`, `authMode`, `workout`, `nutrition`, `profile`.

## 2. Import into new build (guest mode)

1. Open new app build.
2. Enter guest mode (or stay logged out if guest uses local mode).
3. Go to `Profile -> Import Backup`.
4. Paste JSON and continue import.

Expected:
- Import confirmation shows counts (routines/history/favorites/templates/measurements).
- Home/workout/nutrition/profile data appears immediately.

## 3. Workout integrity checks

1. Check routine count and names.
2. Check history entries and set numbers.
3. Open exercises dashboard and verify:
   - Unmapped warning (if any) is visible.
   - Alias mappings can be added/removed.

Expected:
- No crash with legacy names.
- Unmapped entries are preserved (not silently deleted).

## 4. Nutrition integrity checks

1. Verify day totals for at least one known date.
2. Verify favorites and meal templates are present.
3. Verify custom meals have correct portions/macros.

Expected:
- Macros and portions match exported values.
- Source badges render (`OFF`, `USDA`, `CUSTOM`) where applicable.

## 5. Post-login sync check

1. Sign in with your account after successful guest import.
2. Wait for sync/write cycle.
3. Force close and reopen app while logged in.

Expected:
- Imported workout/nutrition/profile data persists after reopen.
- Data is read from cloud-backed state without loss.

## 6. Negative tests

1. Try invalid JSON import.
2. Try unsupported `backupVersion`.
3. Try partial payload with missing sections.

Expected:
- Invalid payloads show error and do not overwrite existing state.
- Partial payloads fall back safely to defaults.

## Pass criteria

- No data loss between old guest data and new logged-in state.
- No critical UI or runtime errors in workout/nutrition/profile after import.
