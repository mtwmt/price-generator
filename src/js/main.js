(function () {
  const $modal = document.querySelector('#modal');
  const $form = document.querySelector('form#form');
  const $inputs = document.querySelectorAll('input, textarea, select');

  // validate
  const mainValidate = {
    company: {
      presence: {
        message: '^請輸入業主名稱',
      },
    },
    name: {
      presence: {
        message: '^請輸入報價人員',
      },
    },
    email: {
      presence: {
        message: '^請輸入 E-Mail',
      },
      email: {
        message: '格式錯誤',
      },
    },
    phone: {
      presence: {
        message: '^請輸入聯絡電話',
      },
      format: {
        pattern: '^09[0-9]{8}$',
        message: '^手機格式錯誤',
      },
    },
  };
  let constraints = {};

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

  const createItem = (data) => {
    return data.map(
      (e) =>
        `
        <tr>
          <td class="text-left">${e.category}</td>
          <td class="text-left">${e.item}</td>
          <td>${e.price}</td>
          <td>${e.count} ${!!e.unit ? '/' : ''} ${e.unit}</td>
          <td class="price">${e.amount}</td>
        </tr> 
      `
    );
  };
  const createModal = (data) => {
    return `
      <div class="table-responsive">
        <table class="table table-vcenter">
          <tr>
            <th>報價人員</th>
            <td>${data.name}</td>
          </tr>
          <tr>
            <th>聯絡電話</th>
            <td>${data.phone}</td>
          </tr>
          <tr>
            <th>E-Mail</th>
            <td>${data.email}</td>
          </tr>
        </table>
        <table class="table table-vcenter">
          <thead>
            <tr>
              <th>類別</th>
              <th>項目</th>
              <th>單價</th>
              <th>數量</th>
              <th>金額</th>
            </tr>
          </thead>
          <tbody>
            ${createItem(data.items).join('')}
          </tbody>
        </table>
        <table class="table table-vcenter">
          <thead>
            <tr>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                ${(data.description + '').replace(/\r\n/g, '<br />')}
              </td>
            </tr>
          </thead>
          </tbody>
        </table>
      </div>
    `;
  };

  // set validate
  const setItemFormValidate = () => {
    let itemValidate = {};
    document.querySelectorAll('[data-item]').forEach((e, i) => {
      e.querySelector('[name*=category]').name = `category${i}`;
      e.querySelector('[name*=item]').name = `item${i}`;
      e.querySelector('[name*=price]').name = `price${i}`;
      e.querySelector('[name*=count]').name = `count${i}`;
      e.querySelector('[name*=unit]').name = `unit${i}`;

      itemValidate = {
        ...itemValidate,
        [`item${i}`]: {
          presence: {
            message: '^項目名稱不得為空',
          },
        },
        [`price${i}`]: {
          presence: {
            message: '^單價名稱不得為空',
          },
        },
      };
    });
    constraints = {
      ...mainValidate,
      ...itemValidate,
    };
  };

  const resetFormInput = (formInput) => {
    formInput.classList.remove('is-invalid');
    formInput.parentNode.querySelectorAll('.invalid-feedback').forEach((el) => {
      el.remove();
    });
  };

  const addError = (formInput, error) => {
    const block = document.createElement('div');
    block.classList.add('invalid-feedback');
    block.innerText = error;
    formInput.parentNode.appendChild(block);
  };

  const showErrorsForInput = (input, errors) => {
    resetFormInput(input);
    if (errors) {
      input.classList.add('is-invalid');

      errors.forEach((err) => {
        addError(input, err);
      });
    }
  };

  const showErrors = (form, errors) => {
    form.querySelectorAll('input[name], select[name]').forEach((input) => {
      showErrorsForInput(input, errors && errors[input.name]);
    });
  };

  const handleFormSubmit = (form) => {
    const errors = validate(form, constraints);
    if (!errors) {
      return true;
    }
    showErrors(form, errors || {});
    return false;
  };

  const formData = function () {
    const data = {
      company: document.querySelector('[name=company]').value,
      name: document.querySelector('[name=name]').value,
      phone: document.querySelector('[name=phone]').value,
      email: document.querySelector('[name=email]').value,
      description: document.querySelector('[name=description]').value,
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

  // on Submit
  $modal.addEventListener('show.bs.modal', function (e) {
    if (!handleFormSubmit($form)) {
      e.preventDefault();
      this.querySelector('.modal-title').textContent = '';
      this.querySelector('.modal-body').textContent = '';
    } else {
      const data = formData();
      const modalTitle = document.querySelector('.modal-title');
      const modalBody = document.querySelector('.modal-body');
      modalTitle.append(data.company + '-報價單');
      modalBody.insertAdjacentHTML('beforeend', createModal(data));
    }
  });

  $modal.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    this.querySelector('.modal-title').textContent = '';
    this.querySelector('.modal-body').textContent = '';
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
    const printHtml = document.querySelector('.modal-dialog .modal-content');

    const newPrintHtml = printHtml.cloneNode(true);
    newPrintHtml.querySelector('.modal-footer').remove();
    newPrintHtml.insertAdjacentHTML(
      'beforeend',
      `<p style="text-align: right;">報價時間：${now}</p>`
    );

    printScreen(newPrintHtml);
  });
})();
