(function () {
  const modal = document.querySelector('#modal');
  const form = document.querySelector('form#form');
  const inputs = document.querySelectorAll('input, textarea, select');
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
      data.items.push({
        category: element.querySelector('[name=category]').value,
        item: element.querySelector('[name=item]').value,
        price: element.querySelector('[name=price]').value,
        number: element.querySelector('[name=number]').value,
        amount: element.querySelector('[name=amount]').value,
      });
    });

    return data;
  };
  const setAmount = (element) => {
    const price = element.querySelector('[name=price]').value || 0;
    const number = element.querySelector('[name=number]').value || 1;
    element.querySelector('[name=amount]').value = price * number;
  };
  const setTotal = () => {
    const total = document.querySelectorAll('[name=amount]');
    let getTotal = 0;
    total.forEach((e) => {
      getTotal += +e.value;
    });
    document.querySelector('#total-price').textContent = getTotal;
  };
  const updateDom = () => {
    document.querySelectorAll('[data-item]').forEach((element, index) => {
      element.querySelector('[name=price]').addEventListener('change', (ev) => {
        setAmount(element);
        setTotal();
      });

      element
        .querySelector('[name=number]')
        .addEventListener('change', (ev) => {
          setAmount(element);
          setTotal();
        });

      if (index > 1) {
        element
          .querySelector('.delItem')
          .addEventListener('click', function (e) {
            this.parentElement.parentElement.remove();
            setTotal();
          });
      }
    });
  };

  const createItem = (data) => {
    console.log('createItem', data);

    return data.map(
      (e) =>
        `
        <tr>
          <td class="text-left">${e.category}</td>
          <td class="text-left">${e.item}</td>
          <td>${e.price}</td>
          <td>${e.number}</td>
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
              <th>數量 / 頁</th>
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
  const constraints = {
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

  updateDom();

  for (var i = 0; i < inputs.length; ++i) {
    inputs.item(i).addEventListener('change', function (ev) {
      const errors = validate(form, constraints) || {};

      showErrorsForInput(this, errors[this.name]);
    });
  }

  // add item row
  document.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    const row = document.querySelector('[data-item]');
    const newRow = row.cloneNode(true);
    newRow.style.display = 'flex';
    document.querySelector('[data-items]').append(newRow);
    updateDom();
  });

  // on Submit
  modal.addEventListener('show.bs.modal', function (e) {
    if (!handleFormSubmit(form)) {
      e.preventDefault();
      console.log('this', this);
      this.querySelector('.modal-title').textContent = '';
      this.querySelector('.modal-body').textContent = '';
    } else {
      const data = formData();
      const modalTitle = document.querySelector('.modal-title');
      const modalBody = document.querySelector('.modal-body');

      modalTitle.append(data.company);
      modalBody.insertAdjacentHTML('beforeend', createModal(data));
    }
  });

  modal.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    this.querySelector('.modal-title').textContent = '';
    this.querySelector('.modal-body').textContent = '';
  });

})();
