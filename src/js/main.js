(function () {
  const $modal = document.querySelector('#modal');
  const $form = document.querySelector('form#form');
  const $inputs = document.querySelectorAll('input, textarea, select');

  const setNumFormat = (num) => {
    num = num + '';
    return num.replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
  };

  const setAmount = (item, index) => {
    const price = item.querySelector(`[name=price${index}]`).value || 0;
    const count = item.querySelector(`[name=count${index}]`).value || 1;
    item.querySelector('[name=amount]').value = price * count;
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
      if (document.querySelectorAll('[data-item]').length > 2) {
        this.parentElement.parentElement.remove();
        setTotal();
      }
    });
  };

  const updateItemRow = (row, index) => {
    row.querySelector('[name=category]').name = `category${index}`;
    row.querySelector('[name=item]').name = `item${index}`;
    row.querySelector('[name=price]').name = `price${index}`;
    row.querySelector('[name=count]').name = `count${index}`;
    row.querySelector('[name=unit]').name = `unit${index}`;

    constraints = {
      ...constraints,
      [`item${index}`]: {
        presence: {
          message: '^項目名稱不得為空',
        },
      },
      [`price${index}`]: {
        presence: {
          message: '^單價名稱不得為空',
        },
      },
    };

    row
      .querySelector(`[name=item${index}]`)
      .addEventListener('change', function () {
        const errors = validate($form, constraints) || {};
        showErrorsForInput(this, errors[this.name]);
      });

    row
      .querySelector(`[name=price${index}]`)
      .addEventListener('change', function () {
        setAmount(row, index);
        setTotal();
        const errors = validate($form, constraints) || {};
        showErrorsForInput(this, errors[this.name]);
      });

    row
      .querySelector(`[name=count${index}]`)
      .addEventListener('change', function () {
        setAmount(row, index);
        setTotal();
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
      </div>
    `;
  };

  // validate form
  let constraints = {
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
    item: {
      presence: {
        message: '^項目名稱不得為空',
      },
    },
    price: {
      presence: {
        message: '^單價名稱不得為空',
      },
    },
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

  const handleFormSubmit = (form, input) => {
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

    document.querySelectorAll('[data-item]').forEach((element, index) => {
      if (index === 0) {
        return;
      }
      if (index === 1) {
        data.items.push({
          category: element.querySelector(`[name=category`).value,
          item: element.querySelector(`[name=item`).value,
          price: element.querySelector(`[name=price`).value,
          count: element.querySelector(`[name=count`).value,
          unit: element.querySelector(`[name=unit`).value,
          amount: element.querySelector(`[name=amount]`).value,
        });
      } else {
        data.items.push({
          category: element.querySelector(`[name=category${index - 1}]`).value,
          item: element.querySelector(`[name=item${index - 1}]`).value,
          price: element.querySelector(`[name=price${index - 1}]`).value,
          count: element.querySelector(`[name=count${index - 1}]`).value,
          unit: element.querySelector(`[name=unit${index - 1}]`).value,
          amount: element.querySelector(`[name=amount]`).value,
        });
      }
    });

    return data;
  };

  // document init ==============

  $inputs.forEach((e, i) => {
    e.addEventListener('change', (ev) => {
      const errors = validate($form, constraints) || {};
      showErrorsForInput(e, errors[e.name]);
    });
  });

  document.querySelectorAll('[data-item]').forEach((e) => {
    updateItemRow(e, '');
  });

  // add item row
  document.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    const row = document.querySelector('[data-item]');
    const newRow = row.cloneNode(true);
    const itemLength = document.querySelectorAll('[data-item]').length - 1;
    newRow.style.display = 'flex';
    document.querySelector('[data-items]').append(newRow);
    updateItemRow(newRow, itemLength);
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
