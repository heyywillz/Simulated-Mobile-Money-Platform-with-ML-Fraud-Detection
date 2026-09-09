function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; //earth raduis

  const toRadian = (degree) => (degree * Math.PI) / 180;

  const dlat = toRadian(lat2 - lat1);
  const dlon = toRadian(lon2 - lon1);

  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRadian(lat1)) *
      Math.cos(toRadian(lat2)) *
      Math.sin(dlon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function locationRisk({
  previousLat,
  previousLong,
  currentLat,
  currentLong,
  minutesSincePreviousTransaction,
}) {
  console.log('start');
  console.log(
    previousLat,
    previousLong,
    currentLat,
    currentLong,
    minutesSincePreviousTransaction,
  );
  const distance = haversineDistance(
    previousLat,
    previousLong,
    currentLat,
    currentLong,
  );

  const hours = Math.max(minutesSincePreviousTransaction / 60, 0.01);
  const speed = distance / hours;

  let risk = 0;

  // Distance
  if (distance > 100) risk += 20;
  if (distance > 500) risk += 30;
  if (distance > 1000) risk += 30;

  // Impossible/unrealistic travel
  if (speed > 900) risk += 50;
  if (speed > 1200) risk += 20;

  // Final binary decision
  return {
    distanceKm: Math.round(distance * 100) / 100,
    speedKmh: Math.round(speed),
    riskScore: Math.min(risk, 100),
    suspicious: risk >= 50 ? 1 : 0,
  };
}

module.exports = { locationRisk };
