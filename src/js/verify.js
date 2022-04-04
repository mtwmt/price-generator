const verify = () => {
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

  return {
    constraints,
    setItemFormValidate,
    showErrorsForInput,
    handleFormSubmit,
  };
}