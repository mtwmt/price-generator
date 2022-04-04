const common = () => {
  const setNumFormat = (num) => {
    num = num + '';
    return num.replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
  };

  const setAmount = (row) => {
    const price = row.querySelector(`[name*=price]`).value || 0;
    const count = row.querySelector(`[name*=count]`).value || 1;
    row.querySelector('[name=amount]').value = price * count;
  };

  const setTotal = () => {
    const total = document.querySelectorAll('[name=amount]');
    let getTotal = 0;
    total.forEach((e) => {
      getTotal += +e.value;
    });
    document.querySelector('#total-price').textContent = setNumFormat(getTotal);
  };

  return {
    setNumFormat,
    setAmount,
    setTotal,
  };
}