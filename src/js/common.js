const common = () => {

  // set datepicker
  const startDate = new Litepicker({
    element: document.querySelector('#startDate'),
    startDate: new Date(),
  });
  const endDate = new Litepicker({
    element: document.querySelector('#endDate'),
    lockDays: [[new Date(0), new Date()]],
    resetButton: () => {
      let btn = document.createElement('a');
      btn.classList = 'btn btn-primary btn-sm';
      btn.innerText = '待確認';
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
      });
      return btn;
    },
  });

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
};
