function abNormalTransaction({ transactionsArray, currentAmount }) {
  const amounts = (transactionsArray || [])
    .map((a) => Number(a))
    .filter((a) => !isNaN(a) && a > 0);

  if (amounts.length === 0) return 0;

  const average =
    amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

  const variance =
    amounts.reduce((sum, amount) => sum + Math.pow(amount - average, 2), 0) /
    amounts.length;

  const standardDeviation = Math.sqrt(variance);
  const currentAmountValue = Number(currentAmount) || 0;

  // If all previous transactions were identical (variance == 0)
  if (standardDeviation === 0) {
    if (currentAmountValue >= average * 3 && currentAmountValue > 500) {
      return 5; // Clear outlier spike
    }
    return currentAmountValue === average ? 0 : 1;
  }

  const zScore = (currentAmountValue - average) / standardDeviation;

  console.log({
    average,
    standardDeviation,
    zScore,
    currentAmountValue,
  });

  return zScore;
}

module.exports = { abNormalTransaction };
