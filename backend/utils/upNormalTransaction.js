function abNormalTransaction({ transactionsArray, currentAmount }) {
  console.log('start');
  console.log(
    'transactionsArray',
    transactionsArray,
    'currentAmount',
    currentAmount,
  );
  const amounts = transactionsArray;

  const average =
    amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

  const variance =
    amounts.reduce((sum, amount) => sum + Math.pow(amount - average, 2), 0) /
    amounts.length;

  const standardDeviation = Math.sqrt(variance);

  const currentAmountValue = currentAmount;

  const zScore = (currentAmountValue - average) / standardDeviation;

  console.log({
    average,
    standardDeviation,
    zScore,
  });

  return zScore;
}

module.exports = { abNormalTransaction };
