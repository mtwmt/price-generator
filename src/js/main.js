(function () {
  const $modal = document.querySelector('#modal');
  const $preview = document.querySelector('#preview');
  const $form = document.querySelector('form#form');
  const $inputs = document.querySelectorAll('input, textarea, select');

  const { setAmount, setTotal } = common();

  const {
    constraints,
    setItemFormValidate,
    showErrorsForInput,
    handleFormSubmit,
  } = verify();

  const { createModal } = view();

  const delItem = (row) => {
    row.querySelector('.delItem').addEventListener('click', function (e) {
      e.preventDefault();
      if (document.querySelectorAll('[data-item]').length > 1) {
        this.parentElement.parentElement.remove();
        setTotal();
      }
      setItemFormValidate();
    });
  };

  const updateItemRow = (row) => {
    row.querySelectorAll('input').forEach((e, i) => {
      e.addEventListener('change', (ev) => {
        setAmount(row);
        setTotal();
        const errors = validate($form, constraints) || {};
        showErrorsForInput(e, errors[e.name]);
      });
    });
    delItem(row);
  };

  /**
   * formData
   * @returns 表單資料
   */
  const formData = function () {
    const data = {
      company: document.querySelector('[name=company]').value,
      name: document.querySelector('[name=name]').value,
      phone: document.querySelector('[name=phone]').value,
      email: document.querySelector('[name=email]').value,
      desc: document.querySelector('[name=desc]').value,
      total: document.querySelector('#total-price').textContent,
      items: [],
    };

    document.querySelectorAll('[data-item]').forEach((e, index) => {
      data.items.push({
        category: e.querySelector(`[name*=category`).value,
        item: e.querySelector(`[name*=item`).value,
        price: e.querySelector(`[name*=price`).value,
        count: e.querySelector(`[name*=count`).value,
        unit: e.querySelector(`[name*=unit`).value,
        amount: e.querySelector(`[name*=amount]`).value,
      });
    });
    return data;
  };

  // document init ==============
  document.querySelectorAll('[data-item]').forEach((e) => {
    updateItemRow(e);
    setItemFormValidate();
  });

  $inputs.forEach((e, i) => {
    e.addEventListener('change', (ev) => {
      const errors = validate($form, constraints) || {};
      showErrorsForInput(e, errors[e.name]);
    });
  });

  // add item row
  document.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    const row = document.querySelector('[data-item]');
    const newRow = row.cloneNode(true);
    newRow.querySelectorAll('input').forEach((e) => {
      e.value = e.defaultValue;
      e.classList.remove('is-invalid');
      e.parentNode.querySelectorAll('.invalid-feedback').forEach((el) => {
        el.remove();
      });
    });

    document.querySelector('[data-items]').append(newRow);
    updateItemRow(newRow);
    setItemFormValidate();
  });

  // on preview
  $preview.addEventListener('show.bs.modal', function (e) {
    const data = formData();
    const modalTitle = this.querySelector('.modal-title');
    const modalBody = this.querySelector('.modal-body');
    modalTitle.append(`${data.company} ${!data.company ? '' : '-'} 報價單`);
    modalBody.insertAdjacentHTML('beforeend', createModal(data));
  });
  $preview.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    this.querySelector('.modal-title').textContent = '';
    this.querySelector('.modal-body').textContent = '';
  });

  // on Submit
  $modal.addEventListener('show.bs.modal', function (e) {
    if (!handleFormSubmit($form)) {
      e.preventDefault();
      this.querySelector('.modal-title').textContent = '';
      this.querySelector('.modal-body').textContent = '';
    } else {
      const data = formData();
      const modalTitle = this.querySelector('.modal-title');
      const modalBody = this.querySelector('.modal-body');
      modalTitle.append(data.company + '-報價單');
      modalBody.insertAdjacentHTML('beforeend', createModal(data));
    }
  });

  $modal.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    this.querySelector('.modal-title').textContent = '';
    this.querySelector('.modal-body').textContent = '';
  });

  // Export ==============
  document.querySelector('#exportImage').addEventListener('click', function () {
    const preview = document.querySelector('#modal .modal-content');

    // export Image
    html2canvas(preview).then(function (canvas) {
      console.log('canvas', canvas);
      document.body.appendChild(canvas);
      const $a = document.createElement('a');
      $a.href = canvas
        .toDataURL('image/jpeg')
        .replace('image/jpeg', 'image/octet-stream');
      $a.download = ''.concat(
        new Date().toLocaleString('roc', { hour12: false }),
        '_quotation.jpg'
      );
      $a.click();
    });
  });

  // Print ==============
  const printScreen = (print) => {
    const printArea = print.innerHTML;
    const printPage = window.open('', 'Printing...', '');
    printPage.document.open();
    printPage.document.write(
      `<html>
        <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>報價單產生器</title>
          <link rel="stylesheet" href="https://unpkg.com/@tabler/core@latest/dist/css/tabler.min.css"/>
        </head>
        <body onload='window.print();window.close()'>`
    );
    printPage.document.write(printArea);
    printPage.document.close('</body></html>');
  };

  document.querySelector('#print').addEventListener('click', function () {
    const now = new Date().toLocaleDateString();
    const printHtml = document.querySelector(
      '#modal .modal-dialog .modal-content'
    );
    const newPrintHtml = printHtml.cloneNode(true);
    newPrintHtml.querySelector('.modal-footer').remove();
    newPrintHtml.insertAdjacentHTML(
      'beforeend',
      `<p style="text-align: right;">報價時間：${now}</p>`
    );
    printScreen(newPrintHtml);
  });
})();
