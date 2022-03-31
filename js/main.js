"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {
  var $modal = document.querySelector('#modal');
  var $preview = document.querySelector('#preview');
  var $form = document.querySelector('form#form');
  var $inputs = document.querySelectorAll('input, textarea, select'); // validate

  var mainValidate = {
    company: {
      presence: {
        message: '^請輸入業主名稱'
      }
    },
    name: {
      presence: {
        message: '^請輸入報價人員'
      }
    },
    email: {
      presence: {
        message: '^請輸入 E-Mail'
      },
      email: {
        message: '格式錯誤'
      }
    },
    phone: {
      presence: {
        message: '^請輸入聯絡電話'
      },
      format: {
        pattern: '^09[0-9]{8}$',
        message: '^手機格式錯誤'
      }
    }
  };
  var constraints = {};

  var setNumFormat = function setNumFormat(num) {
    num = num + '';
    return num.replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
  };

  var setAmount = function setAmount(row) {
    var price = row.querySelector("[name*=price]").value || 0;
    var count = row.querySelector("[name*=count]").value || 1;
    row.querySelector('[name=amount]').value = price * count;
  };

  var setTotal = function setTotal() {
    var total = document.querySelectorAll('[name=amount]');
    var getTotal = 0;
    total.forEach(function (e) {
      getTotal += +e.value;
    });
    document.querySelector('#total-price').textContent = setNumFormat(getTotal);
  };

  var delItem = function delItem(row) {
    row.querySelector('.delItem').addEventListener('click', function (e) {
      e.preventDefault();

      if (document.querySelectorAll('[data-item]').length > 1) {
        this.parentElement.parentElement.remove();
        setTotal();
      }

      setItemFormValidate();
    });
  };

  var updateItemRow = function updateItemRow(row) {
    row.querySelectorAll('input').forEach(function (e, i) {
      e.addEventListener('change', function (ev) {
        setAmount(row);
        setTotal();
        var errors = validate($form, constraints) || {};
        showErrorsForInput(e, errors[e.name]);
      });
    });
    delItem(row);
  };

  var createItem = function createItem(data) {
    return data.map(function (e) {
      return "\n        <tr>\n          <td class=\"text-left\">".concat(e.category, "</td>\n          <td class=\"text-left\">").concat(e.item, "</td>\n          <td>").concat(e.price, "</td>\n          <td>").concat(e.count, " ").concat(!!e.unit ? '/' : '', " ").concat(e.unit, "</td>\n          <td class=\"text-end price\">NT$ ").concat(setNumFormat(e.amount), "</td>\n        </tr> \n      ");
    });
  };

  var createModal = function createModal(data) {
    return "\n      <div class=\"table-responsive\">\n        <table class=\"table table-vcenter\">\n          <tr>\n            <th>\u5831\u50F9\u4EBA\u54E1</th>\n            <td>".concat(data.name, "</td>\n          </tr>\n          <tr>\n            <th>\u806F\u7D61\u96FB\u8A71</th>\n            <td>").concat(data.phone, "</td>\n          </tr>\n          <tr>\n            <th>E-Mail</th>\n            <td>").concat(data.email, "</td>\n          </tr>\n        </table>\n        <table class=\"table table-vcenter\">\n          <thead>\n            <tr>\n              <th>\u985E\u5225</th>\n              <th>\u9805\u76EE</th>\n              <th>\u55AE\u50F9</th>\n              <th>\u6578\u91CF</th>\n              <th class=\"text-end\">\u91D1\u984D</th>\n            </tr>\n          </thead>\n          <tbody>\n            ").concat(createItem(data.items).join(''), "\n            <tr>\n              <td colspan=\"5\" class=\"text-end\">\n               \u5408\u8A08\uFF1ANT$ <span class=\"fs-2 fw-bold text-danger\">").concat(data.total, "</span> \u5143\u6574\n              </td>\n            </tr>\n          </tbody>\n        </table>\n        <table class=\"table table-vcenter\">\n          <thead>\n            <tr>\n              <th>\u5099\u8A3B</th>\n            </tr>\n          </thead>\n          <tbody>\n            <tr>\n              <td>\n                ").concat((data.desc + '').replace(/\r\n/g, '<br />'), "\n              </td>\n            </tr>\n          </thead>\n          </tbody>\n        </table>\n      </div>\n    ");
  }; // set validate


  var setItemFormValidate = function setItemFormValidate() {
    var itemValidate = {};
    document.querySelectorAll('[data-item]').forEach(function (e, i) {
      var _objectSpread2;

      e.querySelector('[name*=category]').name = "category".concat(i);
      e.querySelector('[name*=item]').name = "item".concat(i);
      e.querySelector('[name*=price]').name = "price".concat(i);
      e.querySelector('[name*=count]').name = "count".concat(i);
      e.querySelector('[name*=unit]').name = "unit".concat(i);
      itemValidate = _objectSpread(_objectSpread({}, itemValidate), {}, (_objectSpread2 = {}, _defineProperty(_objectSpread2, "item".concat(i), {
        presence: {
          message: '^項目名稱不得為空'
        }
      }), _defineProperty(_objectSpread2, "price".concat(i), {
        presence: {
          message: '^單價名稱不得為空'
        }
      }), _objectSpread2));
    });
    constraints = _objectSpread(_objectSpread({}, mainValidate), itemValidate);
  };

  var resetFormInput = function resetFormInput(formInput) {
    formInput.classList.remove('is-invalid');
    formInput.parentNode.querySelectorAll('.invalid-feedback').forEach(function (el) {
      el.remove();
    });
  };

  var addError = function addError(formInput, error) {
    var block = document.createElement('div');
    block.classList.add('invalid-feedback');
    block.innerText = error;
    formInput.parentNode.appendChild(block);
  };

  var showErrorsForInput = function showErrorsForInput(input, errors) {
    resetFormInput(input);

    if (errors) {
      input.classList.add('is-invalid');
      errors.forEach(function (err) {
        addError(input, err);
      });
    }
  };

  var showErrors = function showErrors(form, errors) {
    form.querySelectorAll('input[name], select[name]').forEach(function (input) {
      showErrorsForInput(input, errors && errors[input.name]);
    });
  };

  var handleFormSubmit = function handleFormSubmit(form) {
    var errors = validate(form, constraints);

    if (!errors) {
      return true;
    }

    showErrors(form, errors || {});
    return false;
  };
  /**
   * formData
   * @returns 表單資料
   */


  var formData = function formData() {
    var data = {
      company: document.querySelector('[name=company]').value,
      name: document.querySelector('[name=name]').value,
      phone: document.querySelector('[name=phone]').value,
      email: document.querySelector('[name=email]').value,
      desc: document.querySelector('[name=desc]').value,
      total: document.querySelector('#total-price').textContent,
      items: []
    };
    document.querySelectorAll('[data-item]').forEach(function (e, index) {
      data.items.push({
        category: e.querySelector("[name*=category").value,
        item: e.querySelector("[name*=item").value,
        price: e.querySelector("[name*=price").value,
        count: e.querySelector("[name*=count").value,
        unit: e.querySelector("[name*=unit").value,
        amount: e.querySelector("[name*=amount]").value
      });
    });
    return data;
  }; // document init ==============


  document.querySelectorAll('[data-item]').forEach(function (e) {
    updateItemRow(e);
    setItemFormValidate();
  });
  $inputs.forEach(function (e, i) {
    e.addEventListener('change', function (ev) {
      var errors = validate($form, constraints) || {};
      showErrorsForInput(e, errors[e.name]);
    });
  }); // add item row

  document.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    var row = document.querySelector('[data-item]');
    var newRow = row.cloneNode(true);
    newRow.querySelectorAll('input').forEach(function (e) {
      e.value = e.defaultValue;
      e.classList.remove('is-invalid');
      e.parentNode.querySelectorAll('.invalid-feedback').forEach(function (el) {
        el.remove();
      });
    });
    document.querySelector('[data-items]').append(newRow);
    updateItemRow(newRow);
    setItemFormValidate();
  }); // on preview

  $preview.addEventListener('show.bs.modal', function (e) {
    var data = formData();
    var modalTitle = this.querySelector('.modal-title');
    var modalBody = this.querySelector('.modal-body');
    modalTitle.append("".concat(data.company, " ").concat(!data.company ? '' : '-', " \u5831\u50F9\u55AE"));
    modalBody.insertAdjacentHTML('beforeend', createModal(data));
  });
  $preview.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    this.querySelector('.modal-title').textContent = '';
    this.querySelector('.modal-body').textContent = '';
  }); // on Submit

  $modal.addEventListener('show.bs.modal', function (e) {
    if (!handleFormSubmit($form)) {
      e.preventDefault();
      this.querySelector('.modal-title').textContent = '';
      this.querySelector('.modal-body').textContent = '';
    } else {
      var data = formData();
      var modalTitle = this.querySelector('.modal-title');
      var modalBody = this.querySelector('.modal-body');
      modalTitle.append(data.company + '-報價單');
      modalBody.insertAdjacentHTML('beforeend', createModal(data));
    }
  });
  $modal.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    this.querySelector('.modal-title').textContent = '';
    this.querySelector('.modal-body').textContent = '';
  }); // Export ==============

  document.querySelector('#exportImage').addEventListener('click', function () {
    var preview = document.querySelector('#modal .modal-content'); // export Image

    html2canvas(preview).then(function (canvas) {
      document.body.appendChild(canvas);
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg').replace('image/jpeg', 'image/octet-stream');
      a.download = "".concat(new Date().toLocaleString('roc', {
        hour12: false
      }), "-quotation.jpg");
      a.click();
    });
  }); // Print ==============

  var printScreen = function printScreen(print) {
    var printArea = print.innerHTML;
    var printPage = window.open('', 'Printing...', '');
    printPage.document.open();
    printPage.document.write("<html>\n        <head>\n        <meta charset=\"UTF-8\" />\n        <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\" />\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n          <title>\u5831\u50F9\u55AE\u7522\u751F\u5668</title>\n          <link rel=\"stylesheet\" href=\"https://unpkg.com/@tabler/core@latest/dist/css/tabler.min.css\"/>\n        </head>\n        <body onload='window.print();window.close()'>");
    printPage.document.write(printArea);
    printPage.document.close('</body></html>');
  };

  document.querySelector('#print').addEventListener('click', function () {
    var now = new Date().toLocaleDateString();
    var printHtml = document.querySelector('#modal .modal-dialog .modal-content');
    var newPrintHtml = printHtml.cloneNode(true);
    newPrintHtml.querySelector('.modal-footer').remove();
    newPrintHtml.insertAdjacentHTML('beforeend', "<p style=\"text-align: right;\">\u5831\u50F9\u6642\u9593\uFF1A".concat(now, "</p>"));
    printScreen(newPrintHtml);
  });
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiXSwibmFtZXMiOlsiJG1vZGFsIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiJHByZXZpZXciLCIkZm9ybSIsIiRpbnB1dHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibWFpblZhbGlkYXRlIiwiY29tcGFueSIsInByZXNlbmNlIiwibWVzc2FnZSIsIm5hbWUiLCJlbWFpbCIsInBob25lIiwiZm9ybWF0IiwicGF0dGVybiIsImNvbnN0cmFpbnRzIiwic2V0TnVtRm9ybWF0IiwibnVtIiwicmVwbGFjZSIsInNldEFtb3VudCIsInJvdyIsInByaWNlIiwidmFsdWUiLCJjb3VudCIsInNldFRvdGFsIiwidG90YWwiLCJnZXRUb3RhbCIsImZvckVhY2giLCJlIiwidGV4dENvbnRlbnQiLCJkZWxJdGVtIiwiYWRkRXZlbnRMaXN0ZW5lciIsInByZXZlbnREZWZhdWx0IiwibGVuZ3RoIiwicGFyZW50RWxlbWVudCIsInJlbW92ZSIsInNldEl0ZW1Gb3JtVmFsaWRhdGUiLCJ1cGRhdGVJdGVtUm93IiwiaSIsImV2IiwiZXJyb3JzIiwidmFsaWRhdGUiLCJzaG93RXJyb3JzRm9ySW5wdXQiLCJjcmVhdGVJdGVtIiwiZGF0YSIsIm1hcCIsImNhdGVnb3J5IiwiaXRlbSIsInVuaXQiLCJhbW91bnQiLCJjcmVhdGVNb2RhbCIsIml0ZW1zIiwiam9pbiIsImRlc2MiLCJpdGVtVmFsaWRhdGUiLCJyZXNldEZvcm1JbnB1dCIsImZvcm1JbnB1dCIsImNsYXNzTGlzdCIsInBhcmVudE5vZGUiLCJlbCIsImFkZEVycm9yIiwiZXJyb3IiLCJibG9jayIsImNyZWF0ZUVsZW1lbnQiLCJhZGQiLCJpbm5lclRleHQiLCJhcHBlbmRDaGlsZCIsImlucHV0IiwiZXJyIiwic2hvd0Vycm9ycyIsImZvcm0iLCJoYW5kbGVGb3JtU3VibWl0IiwiZm9ybURhdGEiLCJpbmRleCIsInB1c2giLCJuZXdSb3ciLCJjbG9uZU5vZGUiLCJkZWZhdWx0VmFsdWUiLCJhcHBlbmQiLCJtb2RhbFRpdGxlIiwibW9kYWxCb2R5IiwiaW5zZXJ0QWRqYWNlbnRIVE1MIiwicHJldmlldyIsImh0bWwyY2FudmFzIiwidGhlbiIsImNhbnZhcyIsImJvZHkiLCJhIiwiaHJlZiIsInRvRGF0YVVSTCIsImRvd25sb2FkIiwiRGF0ZSIsInRvTG9jYWxlU3RyaW5nIiwiaG91cjEyIiwiY2xpY2siLCJwcmludFNjcmVlbiIsInByaW50IiwicHJpbnRBcmVhIiwiaW5uZXJIVE1MIiwicHJpbnRQYWdlIiwid2luZG93Iiwib3BlbiIsIndyaXRlIiwiY2xvc2UiLCJub3ciLCJ0b0xvY2FsZURhdGVTdHJpbmciLCJwcmludEh0bWwiLCJuZXdQcmludEh0bWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsQ0FBQyxZQUFZO0FBQ1gsTUFBTUEsTUFBTSxHQUFHQyxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBZjtBQUNBLE1BQU1DLFFBQVEsR0FBR0YsUUFBUSxDQUFDQyxhQUFULENBQXVCLFVBQXZCLENBQWpCO0FBQ0EsTUFBTUUsS0FBSyxHQUFHSCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsV0FBdkIsQ0FBZDtBQUNBLE1BQU1HLE9BQU8sR0FBR0osUUFBUSxDQUFDSyxnQkFBVCxDQUEwQix5QkFBMUIsQ0FBaEIsQ0FKVyxDQU1YOztBQUNBLE1BQU1DLFlBQVksR0FBRztBQUNuQkMsSUFBQUEsT0FBTyxFQUFFO0FBQ1BDLE1BQUFBLFFBQVEsRUFBRTtBQUNSQyxRQUFBQSxPQUFPLEVBQUU7QUFERDtBQURILEtBRFU7QUFNbkJDLElBQUFBLElBQUksRUFBRTtBQUNKRixNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQ7QUFETixLQU5hO0FBV25CRSxJQUFBQSxLQUFLLEVBQUU7QUFDTEgsTUFBQUEsUUFBUSxFQUFFO0FBQ1JDLFFBQUFBLE9BQU8sRUFBRTtBQURELE9BREw7QUFJTEUsTUFBQUEsS0FBSyxFQUFFO0FBQ0xGLFFBQUFBLE9BQU8sRUFBRTtBQURKO0FBSkYsS0FY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LENBQUNuRyxRQUFWLENBQW1Cc0csS0FBbkI7QUFXQUgsSUFBQUEsU0FBUyxDQUFDbkcsUUFBVixDQUFtQnNHLEtBQW5CLENBQXlCTCxTQUF6QjtBQUNBRSxJQUFBQSxTQUFTLENBQUNuRyxRQUFWLENBQW1CdUcsS0FBbkIsQ0FBeUIsZ0JBQXpCO0FBQ0QsR0FqQkQ7O0FBbUJBdkcsRUFBQUEsUUFBUSxDQUFDQyxhQUFULENBQXVCLFFBQXZCLEVBQWlDOEIsZ0JBQWpDLENBQWtELE9BQWxELEVBQTJELFlBQVk7QUFDckUsUUFBTXlFLEdBQUcsR0FBRyxJQUFJYixJQUFKLEdBQVdjLGtCQUFYLEVBQVo7QUFDQSxRQUFNQyxTQUFTLEdBQUcxRyxRQUFRLENBQUNDLGFBQVQsQ0FDaEIscUNBRGdCLENBQWxCO0FBSUEsUUFBTTBHLFlBQVksR0FBR0QsU0FBUyxDQUFDOUIsU0FBVixDQUFvQixJQUFwQixDQUFyQjtBQUNBK0IsSUFBQUEsWUFBWSxDQUFDMUcsYUFBYixDQUEyQixlQUEzQixFQUE0Q2tDLE1BQTVDO0FBQ0F3RSxJQUFBQSxZQUFZLENBQUMxQixrQkFBYixDQUNFLFdBREYsMEVBRXdDdUIsR0FGeEM7QUFLQVQsSUFBQUEsV0FBVyxDQUFDWSxZQUFELENBQVg7QUFDRCxHQWREO0FBZUQsQ0FqWEQiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKCkge1xyXG4gIGNvbnN0ICRtb2RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2RhbCcpO1xyXG4gIGNvbnN0ICRwcmV2aWV3ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByZXZpZXcnKTtcclxuICBjb25zdCAkZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Zvcm0jZm9ybScpO1xyXG4gIGNvbnN0ICRpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpO1xyXG5cclxuICAvLyB2YWxpZGF0ZVxyXG4gIGNvbnN0IG1haW5WYWxpZGF0ZSA9IHtcclxuICAgIGNvbXBhbnk6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpealreS4u+WQjeeosScsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgbmFtZToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl5aCx5YO55Lq65ZOhJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBlbWFpbDoge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWlIEUtTWFpbCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVtYWlsOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ+agvOW8j+mMr+iqpCcsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcGhvbmU6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpeiBr+e1oembu+ipsScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGZvcm1hdDoge1xyXG4gICAgICAgIHBhdHRlcm46ICdeMDlbMC05XXs4fSQnLFxyXG4gICAgICAgIG1lc3NhZ2U6ICde5omL5qmf5qC85byP6Yyv6KqkJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxuICBsZXQgY29uc3RyYWludHMgPSB7fTtcclxuXHJcbiAgY29uc3Qgc2V0TnVtRm9ybWF0ID0gKG51bSkgPT4ge1xyXG4gICAgbnVtID0gbnVtICsgJyc7XHJcbiAgICByZXR1cm4gbnVtLnJlcGxhY2UoL1xcQig/PSg/OlxcZHszfSkrKD8hXFxkKSkvZywgJywnKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzZXRBbW91bnQgPSAocm93KSA9PiB7XHJcbiAgICBjb25zdCBwcmljZSA9IHJvdy5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9cHJpY2VdYCkudmFsdWUgfHwgMDtcclxuICAgIGNvbnN0IGNvdW50ID0gcm93LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudF1gKS52YWx1ZSB8fCAxO1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWFtb3VudF0nKS52YWx1ZSA9IHByaWNlICogY291bnQ7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2V0VG90YWwgPSAoKSA9PiB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tuYW1lPWFtb3VudF0nKTtcclxuICAgIGxldCBnZXRUb3RhbCA9IDA7XHJcbiAgICB0b3RhbC5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICAgIGdldFRvdGFsICs9ICtlLnZhbHVlO1xyXG4gICAgfSk7XHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdG90YWwtcHJpY2UnKS50ZXh0Q29udGVudCA9IHNldE51bUZvcm1hdChnZXRUb3RhbCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZGVsSXRlbSA9IChyb3cpID0+IHtcclxuICAgIHJvdy5xdWVyeVNlbGVjdG9yKCcuZGVsSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBpZiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICAgICAgc2V0VG90YWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRJdGVtRm9ybVZhbGlkYXRlKCk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVJdGVtUm93ID0gKHJvdykgPT4ge1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgICBlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChldikgPT4ge1xyXG4gICAgICAgIHNldEFtb3VudChyb3cpO1xyXG4gICAgICAgIHNldFRvdGFsKCk7XHJcbiAgICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgICBzaG93RXJyb3JzRm9ySW5wdXQoZSwgZXJyb3JzW2UubmFtZV0pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgZGVsSXRlbShyb3cpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGNyZWF0ZUl0ZW0gPSAoZGF0YSkgPT4ge1xyXG4gICAgcmV0dXJuIGRhdGEubWFwKFxyXG4gICAgICAoZSkgPT5cclxuICAgICAgICBgXHJcbiAgICAgICAgPHRyPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwidGV4dC1sZWZ0XCI+JHtlLmNhdGVnb3J5fTwvdGQ+XHJcbiAgICAgICAgICA8dGQgY2xhc3M9XCJ0ZXh0LWxlZnRcIj4ke2UuaXRlbX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5wcmljZX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5jb3VudH0gJHshIWUudW5pdCA/ICcvJyA6ICcnfSAke2UudW5pdH08L3RkPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwidGV4dC1lbmQgcHJpY2VcIj5OVCQgJHtzZXROdW1Gb3JtYXQoZS5hbW91bnQpfTwvdGQ+XHJcbiAgICAgICAgPC90cj4gXHJcbiAgICAgIGBcclxuICAgICk7XHJcbiAgfTtcclxuICBjb25zdCBjcmVhdGVNb2RhbCA9IChkYXRhKSA9PiB7XHJcbiAgICByZXR1cm4gYFxyXG4gICAgICA8ZGl2IGNsYXNzPVwidGFibGUtcmVzcG9uc2l2ZVwiPlxyXG4gICAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLXZjZW50ZXJcIj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuWgseWDueS6uuWToTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEubmFtZX08L3RkPlxyXG4gICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuiBr+e1oembu+ipsTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEucGhvbmV9PC90ZD5cclxuICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgIDx0aD5FLU1haWw8L3RoPlxyXG4gICAgICAgICAgICA8dGQ+JHtkYXRhLmVtYWlsfTwvdGQ+XHJcbiAgICAgICAgICA8L3RyPlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgPHRhYmxlIGNsYXNzPVwidGFibGUgdGFibGUtdmNlbnRlclwiPlxyXG4gICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgPHRoPumhnuWIpTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPumgheebrjwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuWWruWDuTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuaVuOmHjzwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoIGNsYXNzPVwidGV4dC1lbmRcIj7ph5HpoY08L3RoPlxyXG4gICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgPC90aGVhZD5cclxuICAgICAgICAgIDx0Ym9keT5cclxuICAgICAgICAgICAgJHtjcmVhdGVJdGVtKGRhdGEuaXRlbXMpLmpvaW4oJycpfVxyXG4gICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgPHRkIGNvbHNwYW49XCI1XCIgY2xhc3M9XCJ0ZXh0LWVuZFwiPlxyXG4gICAgICAgICAgICAgICDlkIjoqIjvvJpOVCQgPHNwYW4gY2xhc3M9XCJmcy0yIGZ3LWJvbGQgdGV4dC1kYW5nZXJcIj4ke1xyXG4gICAgICAgICAgICAgICAgIGRhdGEudG90YWxcclxuICAgICAgICAgICAgICAgfTwvc3Bhbj4g5YWD5pW0XHJcbiAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgPC90YWJsZT5cclxuICAgICAgICA8dGFibGUgY2xhc3M9XCJ0YWJsZSB0YWJsZS12Y2VudGVyXCI+XHJcbiAgICAgICAgICA8dGhlYWQ+XHJcbiAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICA8dGg+5YKZ6Ki7PC90aD5cclxuICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICA8dGQ+XHJcbiAgICAgICAgICAgICAgICAkeyhkYXRhLmRlc2MgKyAnJykucmVwbGFjZSgvXFxyXFxuL2csICc8YnIgLz4nKX1cclxuICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgPC90aGVhZD5cclxuICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgPC90YWJsZT5cclxuICAgICAgPC9kaXY+XHJcbiAgICBgO1xyXG4gIH07XHJcblxyXG4gIC8vIHNldCB2YWxpZGF0ZVxyXG4gIGNvbnN0IHNldEl0ZW1Gb3JtVmFsaWRhdGUgPSAoKSA9PiB7XHJcbiAgICBsZXQgaXRlbVZhbGlkYXRlID0ge307XHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUsIGkpID0+IHtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9Y2F0ZWdvcnldJykubmFtZSA9IGBjYXRlZ29yeSR7aX1gO1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj1pdGVtXScpLm5hbWUgPSBgaXRlbSR7aX1gO1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj1wcmljZV0nKS5uYW1lID0gYHByaWNlJHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPWNvdW50XScpLm5hbWUgPSBgY291bnQke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9dW5pdF0nKS5uYW1lID0gYHVuaXQke2l9YDtcclxuXHJcbiAgICAgIGl0ZW1WYWxpZGF0ZSA9IHtcclxuICAgICAgICAuLi5pdGVtVmFsaWRhdGUsXHJcbiAgICAgICAgW2BpdGVtJHtpfWBdOiB7XHJcbiAgICAgICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgICAgICBtZXNzYWdlOiAnXumgheebruWQjeeoseS4jeW+l+eCuuepuicsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgW2BwcmljZSR7aX1gXToge1xyXG4gICAgICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICAgICAgbWVzc2FnZTogJ17llq7lg7nlkI3nqLHkuI3lvpfngrrnqbonLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9O1xyXG4gICAgfSk7XHJcbiAgICBjb25zdHJhaW50cyA9IHtcclxuICAgICAgLi4ubWFpblZhbGlkYXRlLFxyXG4gICAgICAuLi5pdGVtVmFsaWRhdGUsXHJcbiAgICB9O1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJlc2V0Rm9ybUlucHV0ID0gKGZvcm1JbnB1dCkgPT4ge1xyXG4gICAgZm9ybUlucHV0LmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcclxuICAgIGZvcm1JbnB1dC5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbnZhbGlkLWZlZWRiYWNrJykuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgZWwucmVtb3ZlKCk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBhZGRFcnJvciA9IChmb3JtSW5wdXQsIGVycm9yKSA9PiB7XHJcbiAgICBjb25zdCBibG9jayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgYmxvY2suY2xhc3NMaXN0LmFkZCgnaW52YWxpZC1mZWVkYmFjaycpO1xyXG4gICAgYmxvY2suaW5uZXJUZXh0ID0gZXJyb3I7XHJcbiAgICBmb3JtSW5wdXQucGFyZW50Tm9kZS5hcHBlbmRDaGlsZChibG9jayk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2hvd0Vycm9yc0ZvcklucHV0ID0gKGlucHV0LCBlcnJvcnMpID0+IHtcclxuICAgIHJlc2V0Rm9ybUlucHV0KGlucHV0KTtcclxuICAgIGlmIChlcnJvcnMpIHtcclxuICAgICAgaW5wdXQuY2xhc3NMaXN0LmFkZCgnaXMtaW52YWxpZCcpO1xyXG5cclxuICAgICAgZXJyb3JzLmZvckVhY2goKGVycikgPT4ge1xyXG4gICAgICAgIGFkZEVycm9yKGlucHV0LCBlcnIpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBzaG93RXJyb3JzID0gKGZvcm0sIGVycm9ycykgPT4ge1xyXG4gICAgZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lXSwgc2VsZWN0W25hbWVdJykuZm9yRWFjaCgoaW5wdXQpID0+IHtcclxuICAgICAgc2hvd0Vycm9yc0ZvcklucHV0KGlucHV0LCBlcnJvcnMgJiYgZXJyb3JzW2lucHV0Lm5hbWVdKTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZUZvcm1TdWJtaXQgPSAoZm9ybSkgPT4ge1xyXG4gICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoZm9ybSwgY29uc3RyYWludHMpO1xyXG4gICAgaWYgKCFlcnJvcnMpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBzaG93RXJyb3JzKGZvcm0sIGVycm9ycyB8fCB7fSk7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogZm9ybURhdGFcclxuICAgKiBAcmV0dXJucyDooajllq7os4fmlplcclxuICAgKi9cclxuICBjb25zdCBmb3JtRGF0YSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnN0IGRhdGEgPSB7XHJcbiAgICAgIGNvbXBhbnk6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWNvbXBhbnldJykudmFsdWUsXHJcbiAgICAgIG5hbWU6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPW5hbWVdJykudmFsdWUsXHJcbiAgICAgIHBob25lOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1waG9uZV0nKS52YWx1ZSxcclxuICAgICAgZW1haWw6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWVtYWlsXScpLnZhbHVlLFxyXG4gICAgICBkZXNjOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1kZXNjXScpLnZhbHVlLFxyXG4gICAgICB0b3RhbDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RvdGFsLXByaWNlJykudGV4dENvbnRlbnQsXHJcbiAgICAgIGl0ZW1zOiBbXSxcclxuICAgIH07XHJcblxyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlLCBpbmRleCkgPT4ge1xyXG4gICAgICBkYXRhLml0ZW1zLnB1c2goe1xyXG4gICAgICAgIGNhdGVnb3J5OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jYXRlZ29yeWApLnZhbHVlLFxyXG4gICAgICAgIGl0ZW06IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWl0ZW1gKS52YWx1ZSxcclxuICAgICAgICBwcmljZTogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9cHJpY2VgKS52YWx1ZSxcclxuICAgICAgICBjb3VudDogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9Y291bnRgKS52YWx1ZSxcclxuICAgICAgICB1bml0OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj11bml0YCkudmFsdWUsXHJcbiAgICAgICAgYW1vdW50OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1hbW91bnRdYCkudmFsdWUsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gZGF0YTtcclxuICB9O1xyXG5cclxuICAvLyBkb2N1bWVudCBpbml0ID09PT09PT09PT09PT09XHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICB1cGRhdGVJdGVtUm93KGUpO1xyXG4gICAgc2V0SXRlbUZvcm1WYWxpZGF0ZSgpO1xyXG4gIH0pO1xyXG5cclxuICAkaW5wdXRzLmZvckVhY2goKGUsIGkpID0+IHtcclxuICAgIGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7XHJcbiAgICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKCRmb3JtLCBjb25zdHJhaW50cykgfHwge307XHJcbiAgICAgIHNob3dFcnJvcnNGb3JJbnB1dChlLCBlcnJvcnNbZS5uYW1lXSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgLy8gYWRkIGl0ZW0gcm93XHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FkZEl0ZW0nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBjb25zdCByb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pdGVtXScpO1xyXG4gICAgY29uc3QgbmV3Um93ID0gcm93LmNsb25lTm9kZSh0cnVlKTtcclxuICAgIG5ld1Jvdy5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCcpLmZvckVhY2goKGUpID0+IHtcclxuICAgICAgZS52YWx1ZSA9IGUuZGVmYXVsdFZhbHVlO1xyXG4gICAgICBlLmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcclxuICAgICAgZS5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbnZhbGlkLWZlZWRiYWNrJykuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgICBlbC5yZW1vdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pdGVtc10nKS5hcHBlbmQobmV3Um93KTtcclxuICAgIHVwZGF0ZUl0ZW1Sb3cobmV3Um93KTtcclxuICAgIHNldEl0ZW1Gb3JtVmFsaWRhdGUoKTtcclxuICB9KTtcclxuXHJcbiAgLy8gb24gcHJldmlld1xyXG4gICRwcmV2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3Nob3cuYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgY29uc3QgZGF0YSA9IGZvcm1EYXRhKCk7XHJcbiAgICBjb25zdCBtb2RhbFRpdGxlID0gdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKTtcclxuICAgIGNvbnN0IG1vZGFsQm9keSA9IHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKTtcclxuICAgIG1vZGFsVGl0bGUuYXBwZW5kKGAke2RhdGEuY29tcGFueX0gJHshZGF0YS5jb21wYW55ID8gJycgOiAnLSd9IOWgseWDueWWrmApO1xyXG4gICAgbW9kYWxCb2R5Lmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgY3JlYXRlTW9kYWwoZGF0YSkpO1xyXG4gIH0pO1xyXG4gICRwcmV2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ2hpZGRlbi5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1ib2R5JykudGV4dENvbnRlbnQgPSAnJztcclxuICB9KTtcclxuXHJcbiAgLy8gb24gU3VibWl0XHJcbiAgJG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ3Nob3cuYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgaWYgKCFoYW5kbGVGb3JtU3VibWl0KCRmb3JtKSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSAnJztcclxuICAgICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBkYXRhID0gZm9ybURhdGEoKTtcclxuICAgICAgY29uc3QgbW9kYWxUaXRsZSA9IHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJyk7XHJcbiAgICAgIGNvbnN0IG1vZGFsQm9keSA9IHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKTtcclxuICAgICAgbW9kYWxUaXRsZS5hcHBlbmQoZGF0YS5jb21wYW55ICsgJy3loLHlg7nllq4nKTtcclxuICAgICAgbW9kYWxCb2R5Lmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgY3JlYXRlTW9kYWwoZGF0YSkpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICAkbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignaGlkZGVuLmJzLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSAnJztcclxuICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gIH0pO1xyXG5cclxuICAvLyBFeHBvcnQgPT09PT09PT09PT09PT1cclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZXhwb3J0SW1hZ2UnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnN0IHByZXZpZXcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbW9kYWwgLm1vZGFsLWNvbnRlbnQnKTtcclxuXHJcbiAgICAvLyBleHBvcnQgSW1hZ2VcclxuICAgIGh0bWwyY2FudmFzKHByZXZpZXcpLnRoZW4oZnVuY3Rpb24gKGNhbnZhcykge1xyXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNhbnZhcyk7XHJcbiAgICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICAgIGEuaHJlZiA9IGNhbnZhc1xyXG4gICAgICAgIC50b0RhdGFVUkwoJ2ltYWdlL2pwZWcnKVxyXG4gICAgICAgIC5yZXBsYWNlKCdpbWFnZS9qcGVnJywgJ2ltYWdlL29jdGV0LXN0cmVhbScpO1xyXG4gICAgICBhLmRvd25sb2FkID0gYCR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygncm9jJywge1xyXG4gICAgICAgIGhvdXIxMjogZmFsc2UsXHJcbiAgICAgIH0pfS1xdW90YXRpb24uanBnYDtcclxuICAgICAgYS5jbGljaygpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFByaW50ID09PT09PT09PT09PT09XHJcbiAgY29uc3QgcHJpbnRTY3JlZW4gPSAocHJpbnQpID0+IHtcclxuICAgIGNvbnN0IHByaW50QXJlYSA9IHByaW50LmlubmVySFRNTDtcclxuICAgIGNvbnN0IHByaW50UGFnZSA9IHdpbmRvdy5vcGVuKCcnLCAnUHJpbnRpbmcuLi4nLCAnJyk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQub3BlbigpO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LndyaXRlKFxyXG4gICAgICBgPGh0bWw+XHJcbiAgICAgICAgPGhlYWQ+XHJcbiAgICAgICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCIgLz5cclxuICAgICAgICA8bWV0YSBodHRwLWVxdWl2PVwiWC1VQS1Db21wYXRpYmxlXCIgY29udGVudD1cIklFPWVkZ2VcIiAvPlxyXG4gICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCIgLz5cclxuICAgICAgICAgIDx0aXRsZT7loLHlg7nllq7nlKLnlJ/lmag8L3RpdGxlPlxyXG4gICAgICAgICAgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCJodHRwczovL3VucGtnLmNvbS9AdGFibGVyL2NvcmVAbGF0ZXN0L2Rpc3QvY3NzL3RhYmxlci5taW4uY3NzXCIvPlxyXG4gICAgICAgIDwvaGVhZD5cclxuICAgICAgICA8Ym9keSBvbmxvYWQ9J3dpbmRvdy5wcmludCgpO3dpbmRvdy5jbG9zZSgpJz5gXHJcbiAgICApO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LndyaXRlKHByaW50QXJlYSk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQuY2xvc2UoJzwvYm9keT48L2h0bWw+Jyk7XHJcbiAgfTtcclxuXHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByaW50JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlRGF0ZVN0cmluZygpO1xyXG4gICAgY29uc3QgcHJpbnRIdG1sID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcclxuICAgICAgJyNtb2RhbCAubW9kYWwtZGlhbG9nIC5tb2RhbC1jb250ZW50J1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBuZXdQcmludEh0bWwgPSBwcmludEh0bWwuY2xvbmVOb2RlKHRydWUpO1xyXG4gICAgbmV3UHJpbnRIdG1sLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1mb290ZXInKS5yZW1vdmUoKTtcclxuICAgIG5ld1ByaW50SHRtbC5pbnNlcnRBZGphY2VudEhUTUwoXHJcbiAgICAgICdiZWZvcmVlbmQnLFxyXG4gICAgICBgPHAgc3R5bGU9XCJ0ZXh0LWFsaWduOiByaWdodDtcIj7loLHlg7nmmYLplpPvvJoke25vd308L3A+YFxyXG4gICAgKTtcclxuXHJcbiAgICBwcmludFNjcmVlbihuZXdQcmludEh0bWwpO1xyXG4gIH0pO1xyXG59KSgpO1xyXG4iXSwiZmlsZSI6Im1haW4uanMifQ==
