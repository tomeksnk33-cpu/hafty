/** Kolumny lokalizacji klienta pralni w bazie. */
export type LocationColumns = {
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  locatedAt: Date | null;
  locatedBy: string | null;
};

/** Lokalizacja klienta dla telefonu albo `null`, gdy jeszcze jej nie zapisano. */
export function locationOut(row: LocationColumns) {
  if (row.latitude == null || row.longitude == null) return null;
  return {
    lat: row.latitude,
    lng: row.longitude,
    accuracy: row.locationAccuracy,
    at: row.locatedAt?.toISOString() ?? null,
    by: row.locatedBy,
  };
}
