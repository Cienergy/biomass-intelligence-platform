const R = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number, earthRadiusKm = R) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.asin(Math.sqrt(a));
}

export function transportKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  roadFactor: number,
  earthRadiusKm = R
) {
  return haversineKm(lat1, lon1, lat2, lon2, earthRadiusKm) * roadFactor;
}
