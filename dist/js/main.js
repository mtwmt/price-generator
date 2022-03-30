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
    return "\n      <div class=\"table-responsive\">\n        <table class=\"table table-vcenter\">\n          <tr>\n            <th>\u5831\u50F9\u4EBA\u54E1</th>\n            <td>".concat(data.name, "</td>\n          </tr>\n          <tr>\n            <th>\u806F\u7D61\u96FB\u8A71</th>\n            <td>").concat(data.phone, "</td>\n          </tr>\n          <tr>\n            <th>E-Mail</th>\n            <td>").concat(data.email, "</td>\n          </tr>\n        </table>\n        <table class=\"table table-vcenter\">\n          <thead>\n            <tr>\n              <th>\u985E\u5225</th>\n              <th>\u9805\u76EE</th>\n              <th>\u55AE\u50F9</th>\n              <th>\u6578\u91CF</th>\n              <th class=\"text-end\">\u91D1\u984D</th>\n            </tr>\n          </thead>\n          <tbody>\n            ").concat(createItem(data.items).join(''), "\n            <tr>\n              <td colspan=\"5\" class=\"text-end\">\n               \u5408\u8A08\uFF1ANT$ <span class=\"fs-2 fw-bold text-danger\">").concat(data.total, "</span> \u5143\u6574\n              </td>\n            </tr>\n          </tbody>\n        </table>\n        <table class=\"table table-vcenter\">\n          <thead>\n            <tr>\n              <th>\u5099\u8A3B</th>\n            </tr>\n          </thead>\n          <tbody>\n            <tr>\n              <td>\n                ").concat((data.description + '').replace(/\r\n/g, '<br />'), "\n              </td>\n            </tr>\n          </thead>\n          </tbody>\n        </table>\n      </div>\n    ");
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
      description: document.querySelector('[name=description]').value,
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiXSwibmFtZXMiOlsiJG1vZGFsIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiJHByZXZpZXciLCIkZm9ybSIsIiRpbnB1dHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibWFpblZhbGlkYXRlIiwiY29tcGFueSIsInByZXNlbmNlIiwibWVzc2FnZSIsIm5hbWUiLCJlbWFpbCIsInBob25lIiwiZm9ybWF0IiwicGF0dGVybiIsImNvbnN0cmFpbnRzIiwic2V0TnVtRm9ybWF0IiwibnVtIiwicmVwbGFjZSIsInNldEFtb3VudCIsInJvdyIsInByaWNlIiwidmFsdWUiLCJjb3VudCIsInNldFRvdGFsIiwidG90YWwiLCJnZXRUb3RhbCIsImZvckVhY2giLCJlIiwidGV4dENvbnRlbnQiLCJkZWxJdGVtIiwiYWRkRXZlbnRMaXN0ZW5lciIsInByZXZlbnREZWZhdWx0IiwibGVuZ3RoIiwicGFyZW50RWxlbWVudCIsInJlbW92ZSIsInNldEl0ZW1Gb3JtVmFsaWRhdGUiLCJ1cGRhdGVJdGVtUm93IiwiaSIsImV2IiwiZXJyb3JzIiwidmFsaWRhdGUiLCJzaG93RXJyb3JzRm9ySW5wdXQiLCJjcmVhdGVJdGVtIiwiZGF0YSIsIm1hcCIsImNhdGVnb3J5IiwiaXRlbSIsInVuaXQiLCJhbW91bnQiLCJjcmVhdGVNb2RhbCIsIml0ZW1zIiwiam9pbiIsImRlc2NyaXB0aW9uIiwiaXRlbVZhbGlkYXRlIiwicmVzZXRGb3JtSW5wdXQiLCJmb3JtSW5wdXQiLCJjbGFzc0xpc3QiLCJwYXJlbnROb2RlIiwiZWwiLCJhZGRFcnJvciIsImVycm9yIiwiYmxvY2siLCJjcmVhdGVFbGVtZW50IiwiYWRkIiwiaW5uZXJUZXh0IiwiYXBwZW5kQ2hpbGQiLCJpbnB1dCIsImVyciIsInNob3dFcnJvcnMiLCJmb3JtIiwiaGFuZGxlRm9ybVN1Ym1pdCIsImZvcm1EYXRhIiwiaW5kZXgiLCJwdXNoIiwibmV3Um93IiwiY2xvbmVOb2RlIiwiZGVmYXVsdFZhbHVlIiwiYXBwZW5kIiwibW9kYWxUaXRsZSIsIm1vZGFsQm9keSIsImluc2VydEFkamFjZW50SFRNTCIsInByaW50U2NyZWVuIiwicHJpbnQiLCJwcmludEFyZWEiLCJpbm5lckhUTUwiLCJwcmludFBhZ2UiLCJ3aW5kb3ciLCJvcGVuIiwid3JpdGUiLCJjbG9zZSIsIm5vdyIsIkRhdGUiLCJ0b0xvY2FsZURhdGVTdHJpbmciLCJwcmludEh0bWwiLCJuZXdQcmludEh0bWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsQ0FBQyxZQUFZO0FBQ1gsTUFBTUEsTUFBTSxHQUFHQyxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBZjtBQUNBLE1BQU1DLFFBQVEsR0FBR0YsUUFBUSxDQUFDQyxhQUFULENBQXVCLFVBQXZCLENBQWpCO0FBQ0EsTUFBTUUsS0FBSyxHQUFHSCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsV0FBdkIsQ0FBZDtBQUNBLE1BQU1HLE9BQU8sR0FBR0osUUFBUSxDQUFDSyxnQkFBVCxDQUEwQix5QkFBMUIsQ0FBaEIsQ0FKVyxDQU1YOztBQUNBLE1BQU1DLFlBQVksR0FBRztBQUNuQkMsSUFBQUEsT0FBTyxFQUFFO0FBQ1BDLE1BQUFBLFFBQVEsRUFBRTtBQUNSQyxRQUFBQSxPQUFPLEVBQUU7QUFERDtBQURILEtBRFU7QUFNbkJDLElBQUFBLElBQUksRUFBRTtBQUNKRixNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQ7QUFETixLQU5hO0FBV25CRSxJQUFBQSxLQUFLLEVBQUU7QUFDTEgsTUFBQUEsUUFBUSxFQUFFO0FBQ1JDLFFBQUFBLE9BQU8sRUFBRTtBQURELE9BREw7QUFJTEUsTUFBQUEsS0FBSyxFQUFFO0FBQ0xGLFFBQUFBLE9BQU8sRUFBRTtBQURKO0FBSkYsS0FYWTtBQW1CbkJHLElBQUFBLEtBQUssRUFBRTtBQUNMSixNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQsT0FETDtBQUlMSSxNQUFBQSxNQUFNLEVBQUU7QUFDTkMsUUFBQUEsT0FBTyxFQUFFLGNBREg7QUFFTkwsUUFBQUEsT0FBTyxFQUFFO0FBRkg7QUFKSDtBQW5CWSxHQUFyQjtBQTZCQSxNQUFJTSxXQUFXLEdBQUcsRUFBbEI7O0FBRUEsTUFBTUMsWUFBWSxHQUFHLFNBQWZBLFlBQWUsQ0FBQ0MsR0FBRCxFQUFTO0FBQzVCQSxJQUFBQSxHQUFHLEdBQUdBLEdBQUcsR0FBRyxFQUFaO0FBQ0EsV0FBT0EsR0FBRyxDQUFDQyxPQUFKLENBQVkseUJBQVosRUFBdUMsR0FBdkMsQ0FBUDtBQUNELEdBSEQ7O0FBS0EsTUFBTUMsU0FBUyxHQUFHLFNBQVpBLFNBQVksQ0FBQ0MsR0FBRCxFQUFTO0FBQ3pCLFFBQU1DLEtBQUssR0FBR0QsR0FBRyxDQUFDbkIsYUFBSixrQkFBbUNxQixLQUFuQyxJQUE0QyxDQUExRDtBQUNBLFFBQU1DLEtBQUssR0FBR0gsR0FBRyxDQUFDbkIsYUFBSixrQkFBbUNxQixLQUFuQyxJQUE0QyxDQUExRDtBQUNBRixJQUFBQSxHQUFHLENBQUNuQixhQUFKLENBQWtCLGVBQWxCLEVBQW1DcUIsS0FBbkMsR0FBMkNELEtBQUssR0FBR0UsS0FBbkQ7QUFDRCxHQUpEOztBQU1BLE1BQU1DLFFBQVEsR0FBRyxTQUFYQSxRQUFXLEdBQU07QUFDckIsUUFBTUMsS0FBSyxHQUFHekIsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixlQUExQixDQUFkO0FBQ0EsUUFBSXFCLFFBQVEsR0FBRyxDQUFmO0FBQ0FELElBQUFBLEtBQUssQ0FBQ0UsT0FBTixDQUFjLFVBQUNDLENBQUQsRUFBTztBQUNuQkYsTUFBQUEsUUFBUSxJQUFJLENBQUNFLENBQUMsQ0FBQ04sS0FBZjtBQUNELEtBRkQ7QUFHQXRCLElBQUFBLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixjQUF2QixFQUF1QzRCLFdBQXZDLEdBQXFEYixZQUFZLENBQUNVLFFBQUQsQ0FBakU7QUFDRCxHQVBEOztBQVNBLE1BQU1JLE9BQU8sR0FBRyxTQUFWQSxPQUFVLENBQUNWLEdBQUQsRUFBUztBQUN2QkEsSUFBQUEsR0FBRyxDQUFDbkIsYUFBSixDQUFrQixVQUFsQixFQUE4QjhCLGdCQUE5QixDQUErQyxPQUEvQyxFQUF3RCxVQUFVSCxDQUFWLEVBQWE7QUFDbkVBLE1BQUFBLENBQUMsQ0FBQ0ksY0FBRjs7QUFDQSxVQUFJaEMsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5QzRCLE1BQXpDLEdBQWtELENBQXRELEVBQXlEO0FBQ3ZELGFBQUtDLGFBQUwsQ0FBbUJBLGFBQW5CLENBQWlDQyxNQUFqQztBQUNBWCxRQUFBQSxRQUFRO0FBQ1Q7O0FBQ0RZLE1BQUFBLG1CQUFtQjtBQUNwQixLQVBEO0FBUUQsR0FURDs7QUFXQSxNQUFNQyxhQUFhLEdBQUcsU0FBaEJBLGFBQWdCLENBQUNqQixHQUFELEVBQVM7QUFDN0JBLElBQUFBLEdBQUcsQ0FBQ2YsZ0JBQUosQ0FBcUIsT0FBckIsRUFBOEJzQixPQUE5QixDQUFzQyxVQUFDQyxDQUFELEVBQUlVLENBQUosRUFBVTtBQUM5Q1YsTUFBQUEsQ0FBQyxDQUFDRyxnQkFBRixDQUFtQixRQUFuQixFQUE2QixVQUFDUSxFQUFELEVBQVE7QUFDbkNwQixRQUFBQSxTQUFTLENBQUNDLEdBQUQsQ0FBVDtBQUNBSSxRQUFBQSxRQUFRO0FBQ1IsWUFBTWdCLE1BQU0sR0FBR0MsUUFBUSxDQUFDdEMsS0FBRCxFQUFRWSxXQUFSLENBQVIsSUFBZ0MsRUFBL0M7QUFDQTJCLFFBQUFBLGtCQUFrQixDQUFDZCxDQUFELEVBQUlZLE1BQU0sQ0FBQ1osQ0FBQyxDQUFDbEIsSUFBSCxDQUFWLENBQWxCO0FBQ0QsT0FMRDtBQU1ELEtBUEQ7QUFRQW9CLElBQUFBLE9BQU8sQ0FBQ1YsR0FBRCxDQUFQO0FBQ0QsR0FWRDs7QUFZQSxNQUFNdUIsVUFBVSxHQUFHLFNBQWJBLFVBQWEsQ0FBQ0MsSUFBRCxFQUFVO0FBQzNCLFdBQU9BLElBQUksQ0FBQ0MsR0FBTCxDQUNMLFVBQUNqQixDQUFEO0FBQUEseUVBRzRCQSxDQUFDLENBQUNrQixRQUg5QixzREFJNEJsQixDQUFDLENBQUNtQixJQUo5QixrQ0FLVW5CLENBQUMsQ0FBQ1AsS0FMWixrQ0FNVU8sQ0FBQyxDQUFDTCxLQU5aLGNBTXFCLENBQUMsQ0FBQ0ssQ0FBQyxDQUFDb0IsSUFBSixHQUFXLEdBQVgsR0FBaUIsRUFOdEMsY0FNNENwQixDQUFDLENBQUNvQixJQU45QywrREFPcUNoQyxZQUFZLENBQUNZLENBQUMsQ0FBQ3FCLE1BQUgsQ0FQakQ7QUFBQSxLQURLLENBQVA7QUFZRCxHQWJEOztBQWNBLE1BQU1DLFdBQVcsR0FBRyxTQUFkQSxXQUFjLENBQUNOLElBQUQsRUFBVTtBQUM1Qiw2TEFLY0EsSUFBSSxDQUFDbEMsSUFMbkIsb0hBU2NrQyxJQUFJLENBQUNoQyxLQVRuQixrR0FhY2dDLElBQUksQ0FBQ2pDLEtBYm5CLDZaQTJCVWdDLFVBQVUsQ0FBQ0MsSUFBSSxDQUFDTyxLQUFOLENBQVYsQ0FBdUJDLElBQXZCLENBQTRCLEVBQTVCLENBM0JWLG9LQStCYVIsSUFBSSxDQUFDbkIsS0EvQmxCLDBWQThDYyxDQUFDbUIsSUFBSSxDQUFDUyxXQUFMLEdBQW1CLEVBQXBCLEVBQXdCbkMsT0FBeEIsQ0FBZ0MsT0FBaEMsRUFBeUMsUUFBekMsQ0E5Q2Q7QUFzREQsR0F2REQsQ0EvRlcsQ0F3Slg7OztBQUNBLE1BQU1rQixtQkFBbUIsR0FBRyxTQUF0QkEsbUJBQXNCLEdBQU07QUFDaEMsUUFBSWtCLFlBQVksR0FBRyxFQUFuQjtBQUNBdEQsSUFBQUEsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBSVUsQ0FBSixFQUFVO0FBQUE7O0FBQ3pEVixNQUFBQSxDQUFDLENBQUMzQixhQUFGLENBQWdCLGtCQUFoQixFQUFvQ1MsSUFBcEMscUJBQXNENEIsQ0FBdEQ7QUFDQVYsTUFBQUEsQ0FBQyxDQUFDM0IsYUFBRixDQUFnQixjQUFoQixFQUFnQ1MsSUFBaEMsaUJBQThDNEIsQ0FBOUM7QUFDQVYsTUFBQUEsQ0FBQyxDQUFDM0IsYUFBRixDQUFnQixlQUFoQixFQUFpQ1MsSUFBakMsa0JBQWdENEIsQ0FBaEQ7QUFDQVYsTUFBQUEsQ0FBQyxDQUFDM0IsYUFBRixDQUFnQixlQUFoQixFQUFpQ1MsSUFBakMsa0JBQWdENEIsQ0FBaEQ7QUFDQVYsTUFBQUEsQ0FBQyxDQUFDM0IsYUFBRixDQUFnQixjQUFoQixFQUFnQ1MsSUFBaEMsaUJBQThDNEIsQ0FBOUM7QUFFQWdCLE1BQUFBLFlBQVksbUNBQ1BBLFlBRE8sMkVBRUZoQixDQUZFLEdBRUk7QUFDWjlCLFFBQUFBLFFBQVEsRUFBRTtBQUNSQyxVQUFBQSxPQUFPLEVBQUU7QUFERDtBQURFLE9BRkosa0RBT0Q2QixDQVBDLEdBT0s7QUFDYjlCLFFBQUFBLFFBQVEsRUFBRTtBQUNSQyxVQUFBQSxPQUFPLEVBQUU7QUFERDtBQURHLE9BUEwsbUJBQVo7QUFhRCxLQXBCRDtBQXFCQU0sSUFBQUEsV0FBVyxtQ0FDTlQsWUFETSxHQUVOZ0QsWUFGTSxDQUFYO0FBSUQsR0EzQkQ7O0FBNkJBLE1BQU1DLGNBQWMsR0FBRyxTQUFqQkEsY0FBaUIsQ0FBQ0MsU0FBRCxFQUFlO0FBQ3BDQSxJQUFBQSxTQUFTLENBQUNDLFNBQVYsQ0FBb0J0QixNQUFwQixDQUEyQixZQUEzQjtBQUNBcUIsSUFBQUEsU0FBUyxDQUFDRSxVQUFWLENBQXFCckQsZ0JBQXJCLENBQXNDLG1CQUF0QyxFQUEyRHNCLE9BQTNELENBQW1FLFVBQUNnQyxFQUFELEVBQVE7QUFDekVBLE1BQUFBLEVBQUUsQ0FBQ3hCLE1BQUg7QUFDRCxLQUZEO0FBR0QsR0FMRDs7QUFPQSxNQUFNeUIsUUFBUSxHQUFHLFNBQVhBLFFBQVcsQ0FBQ0osU0FBRCxFQUFZSyxLQUFaLEVBQXNCO0FBQ3JDLFFBQU1DLEtBQUssR0FBRzlELFFBQVEsQ0FBQytELGFBQVQsQ0FBdUIsS0FBdkIsQ0FBZDtBQUNBRCxJQUFBQSxLQUFLLENBQUNMLFNBQU4sQ0FBZ0JPLEdBQWhCLENBQW9CLGtCQUFwQjtBQUNBRixJQUFBQSxLQUFLLENBQUNHLFNBQU4sR0FBa0JKLEtBQWxCO0FBQ0FMLElBQUFBLFNBQVMsQ0FBQ0UsVUFBVixDQUFxQlEsV0FBckIsQ0FBaUNKLEtBQWpDO0FBQ0QsR0FMRDs7QUFPQSxNQUFNcEIsa0JBQWtCLEdBQUcsU0FBckJBLGtCQUFxQixDQUFDeUIsS0FBRCxFQUFRM0IsTUFBUixFQUFtQjtBQUM1Q2UsSUFBQUEsY0FBYyxDQUFDWSxLQUFELENBQWQ7O0FBQ0EsUUFBSTNCLE1BQUosRUFBWTtBQUNWMkIsTUFBQUEsS0FBSyxDQUFDVixTQUFOLENBQWdCTyxHQUFoQixDQUFvQixZQUFwQjtBQUVBeEIsTUFBQUEsTUFBTSxDQUFDYixPQUFQLENBQWUsVUFBQ3lDLEdBQUQsRUFBUztBQUN0QlIsUUFBQUEsUUFBUSxDQUFDTyxLQUFELEVBQVFDLEdBQVIsQ0FBUjtBQUNELE9BRkQ7QUFHRDtBQUNGLEdBVEQ7O0FBV0EsTUFBTUMsVUFBVSxHQUFHLFNBQWJBLFVBQWEsQ0FBQ0MsSUFBRCxFQUFPOUIsTUFBUCxFQUFrQjtBQUNuQzhCLElBQUFBLElBQUksQ0FBQ2pFLGdCQUFMLENBQXNCLDJCQUF0QixFQUFtRHNCLE9BQW5ELENBQTJELFVBQUN3QyxLQUFELEVBQVc7QUFDcEV6QixNQUFBQSxrQkFBa0IsQ0FBQ3lCLEtBQUQsRUFBUTNCLE1BQU0sSUFBSUEsTUFBTSxDQUFDMkIsS0FBSyxDQUFDekQsSUFBUCxDQUF4QixDQUFsQjtBQUNELEtBRkQ7QUFHRCxHQUpEOztBQU1BLE1BQU02RCxnQkFBZ0IsR0FBRyxTQUFuQkEsZ0JBQW1CLENBQUNELElBQUQsRUFBVTtBQUNqQyxRQUFNOUIsTUFBTSxHQUFHQyxRQUFRLENBQUM2QixJQUFELEVBQU92RCxXQUFQLENBQXZCOztBQUNBLFFBQUksQ0FBQ3lCLE1BQUwsRUFBYTtBQUNYLGFBQU8sSUFBUDtBQUNEOztBQUNENkIsSUFBQUEsVUFBVSxDQUFDQyxJQUFELEVBQU85QixNQUFNLElBQUksRUFBakIsQ0FBVjtBQUNBLFdBQU8sS0FBUDtBQUNELEdBUEQ7QUFTQTtBQUNGO0FBQ0E7QUFDQTs7O0FBQ0UsTUFBTWdDLFFBQVEsR0FBRyxTQUFYQSxRQUFXLEdBQVk7QUFDM0IsUUFBTTVCLElBQUksR0FBRztBQUNYckMsTUFBQUEsT0FBTyxFQUFFUCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsZ0JBQXZCLEVBQXlDcUIsS0FEdkM7QUFFWFosTUFBQUEsSUFBSSxFQUFFVixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsYUFBdkIsRUFBc0NxQixLQUZqQztBQUdYVixNQUFBQSxLQUFLLEVBQUVaLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixjQUF2QixFQUF1Q3FCLEtBSG5DO0FBSVhYLE1BQUFBLEtBQUssRUFBRVgsUUFBUSxDQUFDQyxhQUFULENBQXVCLGNBQXZCLEVBQXVDcUIsS0FKbkM7QUFLWCtCLE1BQUFBLFdBQVcsRUFBRXJELFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixvQkFBdkIsRUFBNkNxQixLQUwvQztBQU1YRyxNQUFBQSxLQUFLLEVBQUV6QixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsY0FBdkIsRUFBdUM0QixXQU5uQztBQU9Yc0IsTUFBQUEsS0FBSyxFQUFFO0FBUEksS0FBYjtBQVVBbkQsSUFBQUEsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBSTZDLEtBQUosRUFBYztBQUM3RDdCLE1BQUFBLElBQUksQ0FBQ08sS0FBTCxDQUFXdUIsSUFBWCxDQUFnQjtBQUNkNUIsUUFBQUEsUUFBUSxFQUFFbEIsQ0FBQyxDQUFDM0IsYUFBRixvQkFBbUNxQixLQUQvQjtBQUVkeUIsUUFBQUEsSUFBSSxFQUFFbkIsQ0FBQyxDQUFDM0IsYUFBRixnQkFBK0JxQixLQUZ2QjtBQUdkRCxRQUFBQSxLQUFLLEVBQUVPLENBQUMsQ0FBQzNCLGFBQUYsaUJBQWdDcUIsS0FIekI7QUFJZEMsUUFBQUEsS0FBSyxFQUFFSyxDQUFDLENBQUMzQixhQUFGLGlCQUFnQ3FCLEtBSnpCO0FBS2QwQixRQUFBQSxJQUFJLEVBQUVwQixDQUFDLENBQUMzQixhQUFGLGdCQUErQnFCLEtBTHZCO0FBTWQyQixRQUFBQSxNQUFNLEVBQUVyQixDQUFDLENBQUMzQixhQUFGLG1CQUFrQ3FCO0FBTjVCLE9BQWhCO0FBUUQsS0FURDtBQVVBLFdBQU9zQixJQUFQO0FBQ0QsR0F0QkQsQ0FsT1csQ0EwUFg7OztBQUNBNUMsRUFBQUEsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBTztBQUN0RFMsSUFBQUEsYUFBYSxDQUFDVCxDQUFELENBQWI7QUFDQVEsSUFBQUEsbUJBQW1CO0FBQ3BCLEdBSEQ7QUFLQWhDLEVBQUFBLE9BQU8sQ0FBQ3VCLE9BQVIsQ0FBZ0IsVUFBQ0MsQ0FBRCxFQUFJVSxDQUFKLEVBQVU7QUFDeEJWLElBQUFBLENBQUMsQ0FBQ0csZ0JBQUYsQ0FBbUIsUUFBbkIsRUFBNkIsVUFBQ1EsRUFBRCxFQUFRO0FBQ25DLFVBQU1DLE1BQU0sR0FBR0MsUUFBUSxDQUFDdEMsS0FBRCxFQUFRWSxXQUFSLENBQVIsSUFBZ0MsRUFBL0M7QUFDQTJCLE1BQUFBLGtCQUFrQixDQUFDZCxDQUFELEVBQUlZLE1BQU0sQ0FBQ1osQ0FBQyxDQUFDbEIsSUFBSCxDQUFWLENBQWxCO0FBQ0QsS0FIRDtBQUlELEdBTEQsRUFoUVcsQ0F1UVg7O0FBQ0FWLEVBQUFBLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixVQUF2QixFQUFtQzhCLGdCQUFuQyxDQUFvRCxPQUFwRCxFQUE2RCxVQUFVSCxDQUFWLEVBQWE7QUFDeEVBLElBQUFBLENBQUMsQ0FBQ0ksY0FBRjtBQUNBLFFBQU1aLEdBQUcsR0FBR3BCLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixhQUF2QixDQUFaO0FBQ0EsUUFBTTBFLE1BQU0sR0FBR3ZELEdBQUcsQ0FBQ3dELFNBQUosQ0FBYyxJQUFkLENBQWY7QUFDQUQsSUFBQUEsTUFBTSxDQUFDdEUsZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUNzQixPQUFqQyxDQUF5QyxVQUFDQyxDQUFELEVBQU87QUFDOUNBLE1BQUFBLENBQUMsQ0FBQ04sS0FBRixHQUFVTSxDQUFDLENBQUNpRCxZQUFaO0FBQ0FqRCxNQUFBQSxDQUFDLENBQUM2QixTQUFGLENBQVl0QixNQUFaLENBQW1CLFlBQW5CO0FBQ0FQLE1BQUFBLENBQUMsQ0FBQzhCLFVBQUYsQ0FBYXJELGdCQUFiLENBQThCLG1CQUE5QixFQUFtRHNCLE9BQW5ELENBQTJELFVBQUNnQyxFQUFELEVBQVE7QUFDakVBLFFBQUFBLEVBQUUsQ0FBQ3hCLE1BQUg7QUFDRCxPQUZEO0FBR0QsS0FORDtBQVFBbkMsSUFBQUEsUUFBUSxDQUFDQyxhQUFULENBQXVCLGNBQXZCLEVBQXVDNkUsTUFBdkMsQ0FBOENILE1BQTlDO0FBQ0F0QyxJQUFBQSxhQUFhLENBQUNzQyxNQUFELENBQWI7QUFDQXZDLElBQUFBLG1CQUFtQjtBQUNwQixHQWZELEVBeFFXLENBeVJYOztBQUNBbEMsRUFBQUEsUUFBUSxDQUFDNkIsZ0JBQVQsQ0FBMEIsZUFBMUIsRUFBMkMsVUFBVUgsQ0FBVixFQUFhO0FBQ3RELFFBQU1nQixJQUFJLEdBQUc0QixRQUFRLEVBQXJCO0FBQ0EsUUFBTU8sVUFBVSxHQUFHLEtBQUs5RSxhQUFMLENBQW1CLGNBQW5CLENBQW5CO0FBQ0EsUUFBTStFLFNBQVMsR0FBRyxLQUFLL0UsYUFBTCxDQUFtQixhQUFuQixDQUFsQjtBQUNBOEUsSUFBQUEsVUFBVSxDQUFDRCxNQUFYLFdBQXFCbEMsSUFBSSxDQUFDckMsT0FBMUIsY0FBcUMsQ0FBQ3FDLElBQUksQ0FBQ3JDLE9BQU4sR0FBZ0IsRUFBaEIsR0FBcUIsR0FBMUQ7QUFDQXlFLElBQUFBLFNBQVMsQ0FBQ0Msa0JBQVYsQ0FBNkIsV0FBN0IsRUFBMEMvQixXQUFXLENBQUNOLElBQUQsQ0FBckQ7QUFDRCxHQU5EO0FBT0ExQyxFQUFBQSxRQUFRLENBQUM2QixnQkFBVCxDQUEwQixpQkFBMUIsRUFBNkMsVUFBVUgsQ0FBVixFQUFhO0FBQ3hEQSxJQUFBQSxDQUFDLENBQUNJLGNBQUY7QUFDQSxTQUFLL0IsYUFBTCxDQUFtQixjQUFuQixFQUFtQzRCLFdBQW5DLEdBQWlELEVBQWpEO0FBQ0EsU0FBSzVCLGFBQUwsQ0FBbUIsYUFBbkIsRUFBa0M0QixXQUFsQyxHQUFnRCxFQUFoRDtBQUNELEdBSkQsRUFqU1csQ0F1U1g7O0FBQ0E5QixFQUFBQSxNQUFNLENBQUNnQyxnQkFBUCxDQUF3QixlQUF4QixFQUF5QyxVQUFVSCxDQUFWLEVBQWE7QUFDcEQsUUFBSSxDQUFDMkMsZ0JBQWdCLENBQUNwRSxLQUFELENBQXJCLEVBQThCO0FBQzVCeUIsTUFBQUEsQ0FBQyxDQUFDSSxjQUFGO0FBQ0EsV0FBSy9CLGFBQUwsQ0FBbUIsY0FBbkIsRUFBbUM0QixXQUFuQyxHQUFpRCxFQUFqRDtBQUNBLFdBQUs1QixhQUFMLENBQW1CLGFBQW5CLEVBQWtDNEIsV0FBbEMsR0FBZ0QsRUFBaEQ7QUFDRCxLQUpELE1BSU87QUFDTCxVQUFNZSxJQUFJLEdBQUc0QixRQUFRLEVBQXJCO0FBQ0EsVUFBTU8sVUFBVSxHQUFHLEtBQUs5RSxhQUFMLENBQW1CLGNBQW5CLENBQW5CO0FBQ0EsVUFBTStFLFNBQVMsR0FBRyxLQUFLL0UsYUFBTCxDQUFtQixhQUFuQixDQUFsQjtBQUNBOEUsTUFBQUEsVUFBVSxDQUFDRCxNQUFYLENBQWtCbEMsSUFBSSxDQUFDckMsT0FBTCxHQUFlLE1BQWpDO0FBQ0F5RSxNQUFBQSxTQUFTLENBQUNDLGtCQUFWLENBQTZCLFdBQTdCLEVBQTBDL0IsV0FBVyxDQUFDTixJQUFELENBQXJEO0FBQ0Q7QUFDRixHQVpEO0FBY0E3QyxFQUFBQSxNQUFNLENBQUNnQyxnQkFBUCxDQUF3QixpQkFBeEIsRUFBMkMsVUFBVUgsQ0FBVixFQUFhO0FBQ3REQSxJQUFBQSxDQUFDLENBQUNJLGNBQUY7QUFDQSxTQUFLL0IsYUFBTCxDQUFtQixjQUFuQixFQUFtQzRCLFdBQW5DLEdBQWlELEVBQWpEO0FBQ0EsU0FBSzVCLGFBQUwsQ0FBbUIsYUFBbkIsRUFBa0M0QixXQUFsQyxHQUFnRCxFQUFoRDtBQUNELEdBSkQsRUF0VFcsQ0E0VFg7O0FBQ0EsTUFBTXFELFdBQVcsR0FBRyxTQUFkQSxXQUFjLENBQUNDLEtBQUQsRUFBVztBQUM3QixRQUFNQyxTQUFTLEdBQUdELEtBQUssQ0FBQ0UsU0FBeEI7QUFDQSxRQUFNQyxTQUFTLEdBQUdDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLEVBQVosRUFBZ0IsYUFBaEIsRUFBK0IsRUFBL0IsQ0FBbEI7QUFDQUYsSUFBQUEsU0FBUyxDQUFDdEYsUUFBVixDQUFtQndGLElBQW5CO0FBQ0FGLElBQUFBLFNBQVMsQ0FBQ3RGLFFBQVYsQ0FBbUJ5RixLQUFuQjtBQVdBSCxJQUFBQSxTQUFTLENBQUN0RixRQUFWLENBQW1CeUYsS0FBbkIsQ0FBeUJMLFNBQXpCO0FBQ0FFLElBQUFBLFNBQVMsQ0FBQ3RGLFFBQVYsQ0FBbUIwRixLQUFuQixDQUF5QixnQkFBekI7QUFDRCxHQWpCRDs7QUFtQkExRixFQUFBQSxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsRUFBaUM4QixnQkFBakMsQ0FBa0QsT0FBbEQsRUFBMkQsWUFBWTtBQUNyRSxRQUFNNEQsR0FBRyxHQUFHLElBQUlDLElBQUosR0FBV0Msa0JBQVgsRUFBWjtBQUNBLFFBQU1DLFNBQVMsR0FBRzlGLFFBQVEsQ0FBQ0MsYUFBVCxDQUNoQixxQ0FEZ0IsQ0FBbEI7QUFJQSxRQUFNOEYsWUFBWSxHQUFHRCxTQUFTLENBQUNsQixTQUFWLENBQW9CLElBQXBCLENBQXJCO0FBQ0FtQixJQUFBQSxZQUFZLENBQUM5RixhQUFiLENBQTJCLGVBQTNCLEVBQTRDa0MsTUFBNUM7QUFDQTRELElBQUFBLFlBQVksQ0FBQ2Qsa0JBQWIsQ0FDRSxXQURGLDBFQUV3Q1UsR0FGeEM7QUFLQVQsSUFBQUEsV0FBVyxDQUFDYSxZQUFELENBQVg7QUFDRCxHQWREO0FBZUQsQ0EvVkQiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKCkge1xyXG4gIGNvbnN0ICRtb2RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2RhbCcpO1xyXG4gIGNvbnN0ICRwcmV2aWV3ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByZXZpZXcnKTtcclxuICBjb25zdCAkZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Zvcm0jZm9ybScpO1xyXG4gIGNvbnN0ICRpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpO1xyXG5cclxuICAvLyB2YWxpZGF0ZVxyXG4gIGNvbnN0IG1haW5WYWxpZGF0ZSA9IHtcclxuICAgIGNvbXBhbnk6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpealreS4u+WQjeeosScsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgbmFtZToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl5aCx5YO55Lq65ZOhJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBlbWFpbDoge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWlIEUtTWFpbCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVtYWlsOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ+agvOW8j+mMr+iqpCcsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcGhvbmU6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpeiBr+e1oembu+ipsScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGZvcm1hdDoge1xyXG4gICAgICAgIHBhdHRlcm46ICdeMDlbMC05XXs4fSQnLFxyXG4gICAgICAgIG1lc3NhZ2U6ICde5omL5qmf5qC85byP6Yyv6KqkJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxuICBsZXQgY29uc3RyYWludHMgPSB7fTtcclxuXHJcbiAgY29uc3Qgc2V0TnVtRm9ybWF0ID0gKG51bSkgPT4ge1xyXG4gICAgbnVtID0gbnVtICsgJyc7XHJcbiAgICByZXR1cm4gbnVtLnJlcGxhY2UoL1xcQig/PSg/OlxcZHszfSkrKD8hXFxkKSkvZywgJywnKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzZXRBbW91bnQgPSAocm93KSA9PiB7XHJcbiAgICBjb25zdCBwcmljZSA9IHJvdy5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9cHJpY2VdYCkudmFsdWUgfHwgMDtcclxuICAgIGNvbnN0IGNvdW50ID0gcm93LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudF1gKS52YWx1ZSB8fCAxO1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWFtb3VudF0nKS52YWx1ZSA9IHByaWNlICogY291bnQ7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2V0VG90YWwgPSAoKSA9PiB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tuYW1lPWFtb3VudF0nKTtcclxuICAgIGxldCBnZXRUb3RhbCA9IDA7XHJcbiAgICB0b3RhbC5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICAgIGdldFRvdGFsICs9ICtlLnZhbHVlO1xyXG4gICAgfSk7XHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdG90YWwtcHJpY2UnKS50ZXh0Q29udGVudCA9IHNldE51bUZvcm1hdChnZXRUb3RhbCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZGVsSXRlbSA9IChyb3cpID0+IHtcclxuICAgIHJvdy5xdWVyeVNlbGVjdG9yKCcuZGVsSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBpZiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICAgICAgc2V0VG90YWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRJdGVtRm9ybVZhbGlkYXRlKCk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVJdGVtUm93ID0gKHJvdykgPT4ge1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgICBlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChldikgPT4ge1xyXG4gICAgICAgIHNldEFtb3VudChyb3cpO1xyXG4gICAgICAgIHNldFRvdGFsKCk7XHJcbiAgICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgICBzaG93RXJyb3JzRm9ySW5wdXQoZSwgZXJyb3JzW2UubmFtZV0pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgZGVsSXRlbShyb3cpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGNyZWF0ZUl0ZW0gPSAoZGF0YSkgPT4ge1xyXG4gICAgcmV0dXJuIGRhdGEubWFwKFxyXG4gICAgICAoZSkgPT5cclxuICAgICAgICBgXHJcbiAgICAgICAgPHRyPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwidGV4dC1sZWZ0XCI+JHtlLmNhdGVnb3J5fTwvdGQ+XHJcbiAgICAgICAgICA8dGQgY2xhc3M9XCJ0ZXh0LWxlZnRcIj4ke2UuaXRlbX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5wcmljZX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5jb3VudH0gJHshIWUudW5pdCA/ICcvJyA6ICcnfSAke2UudW5pdH08L3RkPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwidGV4dC1lbmQgcHJpY2VcIj5OVCQgJHtzZXROdW1Gb3JtYXQoZS5hbW91bnQpfTwvdGQ+XHJcbiAgICAgICAgPC90cj4gXHJcbiAgICAgIGBcclxuICAgICk7XHJcbiAgfTtcclxuICBjb25zdCBjcmVhdGVNb2RhbCA9IChkYXRhKSA9PiB7XHJcbiAgICByZXR1cm4gYFxyXG4gICAgICA8ZGl2IGNsYXNzPVwidGFibGUtcmVzcG9uc2l2ZVwiPlxyXG4gICAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLXZjZW50ZXJcIj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuWgseWDueS6uuWToTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEubmFtZX08L3RkPlxyXG4gICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuiBr+e1oembu+ipsTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEucGhvbmV9PC90ZD5cclxuICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgIDx0aD5FLU1haWw8L3RoPlxyXG4gICAgICAgICAgICA8dGQ+JHtkYXRhLmVtYWlsfTwvdGQ+XHJcbiAgICAgICAgICA8L3RyPlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgPHRhYmxlIGNsYXNzPVwidGFibGUgdGFibGUtdmNlbnRlclwiPlxyXG4gICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgPHRoPumhnuWIpTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPumgheebrjwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuWWruWDuTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuaVuOmHjzwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoIGNsYXNzPVwidGV4dC1lbmRcIj7ph5HpoY08L3RoPlxyXG4gICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgPC90aGVhZD5cclxuICAgICAgICAgIDx0Ym9keT5cclxuICAgICAgICAgICAgJHtjcmVhdGVJdGVtKGRhdGEuaXRlbXMpLmpvaW4oJycpfVxyXG4gICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgPHRkIGNvbHNwYW49XCI1XCIgY2xhc3M9XCJ0ZXh0LWVuZFwiPlxyXG4gICAgICAgICAgICAgICDlkIjoqIjvvJpOVCQgPHNwYW4gY2xhc3M9XCJmcy0yIGZ3LWJvbGQgdGV4dC1kYW5nZXJcIj4ke1xyXG4gICAgICAgICAgICAgICAgIGRhdGEudG90YWxcclxuICAgICAgICAgICAgICAgfTwvc3Bhbj4g5YWD5pW0XHJcbiAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgPC90YWJsZT5cclxuICAgICAgICA8dGFibGUgY2xhc3M9XCJ0YWJsZSB0YWJsZS12Y2VudGVyXCI+XHJcbiAgICAgICAgICA8dGhlYWQ+XHJcbiAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICA8dGg+5YKZ6Ki7PC90aD5cclxuICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICA8dGQ+XHJcbiAgICAgICAgICAgICAgICAkeyhkYXRhLmRlc2NyaXB0aW9uICsgJycpLnJlcGxhY2UoL1xcclxcbi9nLCAnPGJyIC8+Jyl9XHJcbiAgICAgICAgICAgICAgPC90ZD5cclxuICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgYDtcclxuICB9O1xyXG5cclxuICAvLyBzZXQgdmFsaWRhdGVcclxuICBjb25zdCBzZXRJdGVtRm9ybVZhbGlkYXRlID0gKCkgPT4ge1xyXG4gICAgbGV0IGl0ZW1WYWxpZGF0ZSA9IHt9O1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlLCBpKSA9PiB7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPWNhdGVnb3J5XScpLm5hbWUgPSBgY2F0ZWdvcnkke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9aXRlbV0nKS5uYW1lID0gYGl0ZW0ke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9cHJpY2VdJykubmFtZSA9IGBwcmljZSR7aX1gO1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj1jb3VudF0nKS5uYW1lID0gYGNvdW50JHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPXVuaXRdJykubmFtZSA9IGB1bml0JHtpfWA7XHJcblxyXG4gICAgICBpdGVtVmFsaWRhdGUgPSB7XHJcbiAgICAgICAgLi4uaXRlbVZhbGlkYXRlLFxyXG4gICAgICAgIFtgaXRlbSR7aX1gXToge1xyXG4gICAgICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICAgICAgbWVzc2FnZTogJ17poIXnm67lkI3nqLHkuI3lvpfngrrnqbonLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIFtgcHJpY2Uke2l9YF06IHtcclxuICAgICAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICde5Zau5YO55ZCN56ix5LiN5b6X54K656m6JyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG4gICAgY29uc3RyYWludHMgPSB7XHJcbiAgICAgIC4uLm1haW5WYWxpZGF0ZSxcclxuICAgICAgLi4uaXRlbVZhbGlkYXRlLFxyXG4gICAgfTtcclxuICB9O1xyXG5cclxuICBjb25zdCByZXNldEZvcm1JbnB1dCA9IChmb3JtSW5wdXQpID0+IHtcclxuICAgIGZvcm1JbnB1dC5jbGFzc0xpc3QucmVtb3ZlKCdpcy1pbnZhbGlkJyk7XHJcbiAgICBmb3JtSW5wdXQucGFyZW50Tm9kZS5xdWVyeVNlbGVjdG9yQWxsKCcuaW52YWxpZC1mZWVkYmFjaycpLmZvckVhY2goKGVsKSA9PiB7XHJcbiAgICAgIGVsLnJlbW92ZSgpO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYWRkRXJyb3IgPSAoZm9ybUlucHV0LCBlcnJvcikgPT4ge1xyXG4gICAgY29uc3QgYmxvY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGJsb2NrLmNsYXNzTGlzdC5hZGQoJ2ludmFsaWQtZmVlZGJhY2snKTtcclxuICAgIGJsb2NrLmlubmVyVGV4dCA9IGVycm9yO1xyXG4gICAgZm9ybUlucHV0LnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQoYmxvY2spO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNob3dFcnJvcnNGb3JJbnB1dCA9IChpbnB1dCwgZXJyb3JzKSA9PiB7XHJcbiAgICByZXNldEZvcm1JbnB1dChpbnB1dCk7XHJcbiAgICBpZiAoZXJyb3JzKSB7XHJcbiAgICAgIGlucHV0LmNsYXNzTGlzdC5hZGQoJ2lzLWludmFsaWQnKTtcclxuXHJcbiAgICAgIGVycm9ycy5mb3JFYWNoKChlcnIpID0+IHtcclxuICAgICAgICBhZGRFcnJvcihpbnB1dCwgZXJyKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2hvd0Vycm9ycyA9IChmb3JtLCBlcnJvcnMpID0+IHtcclxuICAgIGZvcm0ucXVlcnlTZWxlY3RvckFsbCgnaW5wdXRbbmFtZV0sIHNlbGVjdFtuYW1lXScpLmZvckVhY2goKGlucHV0KSA9PiB7XHJcbiAgICAgIHNob3dFcnJvcnNGb3JJbnB1dChpbnB1dCwgZXJyb3JzICYmIGVycm9yc1tpbnB1dC5uYW1lXSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVGb3JtU3VibWl0ID0gKGZvcm0pID0+IHtcclxuICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKGZvcm0sIGNvbnN0cmFpbnRzKTtcclxuICAgIGlmICghZXJyb3JzKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgc2hvd0Vycm9ycyhmb3JtLCBlcnJvcnMgfHwge30pO1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIGZvcm1EYXRhXHJcbiAgICogQHJldHVybnMg6KGo5Zau6LOH5paZXHJcbiAgICovXHJcbiAgY29uc3QgZm9ybURhdGEgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBkYXRhID0ge1xyXG4gICAgICBjb21wYW55OiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1jb21wYW55XScpLnZhbHVlLFxyXG4gICAgICBuYW1lOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1uYW1lXScpLnZhbHVlLFxyXG4gICAgICBwaG9uZTogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9cGhvbmVdJykudmFsdWUsXHJcbiAgICAgIGVtYWlsOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1lbWFpbF0nKS52YWx1ZSxcclxuICAgICAgZGVzY3JpcHRpb246IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWRlc2NyaXB0aW9uXScpLnZhbHVlLFxyXG4gICAgICB0b3RhbDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RvdGFsLXByaWNlJykudGV4dENvbnRlbnQsXHJcbiAgICAgIGl0ZW1zOiBbXSxcclxuICAgIH07XHJcblxyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlLCBpbmRleCkgPT4ge1xyXG4gICAgICBkYXRhLml0ZW1zLnB1c2goe1xyXG4gICAgICAgIGNhdGVnb3J5OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jYXRlZ29yeWApLnZhbHVlLFxyXG4gICAgICAgIGl0ZW06IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWl0ZW1gKS52YWx1ZSxcclxuICAgICAgICBwcmljZTogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9cHJpY2VgKS52YWx1ZSxcclxuICAgICAgICBjb3VudDogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9Y291bnRgKS52YWx1ZSxcclxuICAgICAgICB1bml0OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj11bml0YCkudmFsdWUsXHJcbiAgICAgICAgYW1vdW50OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1hbW91bnRdYCkudmFsdWUsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gZGF0YTtcclxuICB9O1xyXG5cclxuICAvLyBkb2N1bWVudCBpbml0ID09PT09PT09PT09PT09XHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICB1cGRhdGVJdGVtUm93KGUpO1xyXG4gICAgc2V0SXRlbUZvcm1WYWxpZGF0ZSgpO1xyXG4gIH0pO1xyXG5cclxuICAkaW5wdXRzLmZvckVhY2goKGUsIGkpID0+IHtcclxuICAgIGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7XHJcbiAgICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKCRmb3JtLCBjb25zdHJhaW50cykgfHwge307XHJcbiAgICAgIHNob3dFcnJvcnNGb3JJbnB1dChlLCBlcnJvcnNbZS5uYW1lXSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgLy8gYWRkIGl0ZW0gcm93XHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FkZEl0ZW0nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBjb25zdCByb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pdGVtXScpO1xyXG4gICAgY29uc3QgbmV3Um93ID0gcm93LmNsb25lTm9kZSh0cnVlKTtcclxuICAgIG5ld1Jvdy5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCcpLmZvckVhY2goKGUpID0+IHtcclxuICAgICAgZS52YWx1ZSA9IGUuZGVmYXVsdFZhbHVlO1xyXG4gICAgICBlLmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcclxuICAgICAgZS5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbnZhbGlkLWZlZWRiYWNrJykuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgICBlbC5yZW1vdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pdGVtc10nKS5hcHBlbmQobmV3Um93KTtcclxuICAgIHVwZGF0ZUl0ZW1Sb3cobmV3Um93KTtcclxuICAgIHNldEl0ZW1Gb3JtVmFsaWRhdGUoKTtcclxuICB9KTtcclxuXHJcbiAgLy8gb24gcHJldmlld1xyXG4gICRwcmV2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ3Nob3cuYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgY29uc3QgZGF0YSA9IGZvcm1EYXRhKCk7XHJcbiAgICBjb25zdCBtb2RhbFRpdGxlID0gdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKTtcclxuICAgIGNvbnN0IG1vZGFsQm9keSA9IHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKTtcclxuICAgIG1vZGFsVGl0bGUuYXBwZW5kKGAke2RhdGEuY29tcGFueX0gJHshZGF0YS5jb21wYW55ID8gJycgOiAnLSd9IOWgseWDueWWrmApO1xyXG4gICAgbW9kYWxCb2R5Lmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgY3JlYXRlTW9kYWwoZGF0YSkpO1xyXG4gIH0pO1xyXG4gICRwcmV2aWV3LmFkZEV2ZW50TGlzdGVuZXIoJ2hpZGRlbi5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1ib2R5JykudGV4dENvbnRlbnQgPSAnJztcclxuICB9KTtcclxuXHJcbiAgLy8gb24gU3VibWl0XHJcbiAgJG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ3Nob3cuYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgaWYgKCFoYW5kbGVGb3JtU3VibWl0KCRmb3JtKSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSAnJztcclxuICAgICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBkYXRhID0gZm9ybURhdGEoKTtcclxuICAgICAgY29uc3QgbW9kYWxUaXRsZSA9IHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJyk7XHJcbiAgICAgIGNvbnN0IG1vZGFsQm9keSA9IHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKTtcclxuICAgICAgbW9kYWxUaXRsZS5hcHBlbmQoZGF0YS5jb21wYW55ICsgJy3loLHlg7nllq4nKTtcclxuICAgICAgbW9kYWxCb2R5Lmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgY3JlYXRlTW9kYWwoZGF0YSkpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICAkbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignaGlkZGVuLmJzLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSAnJztcclxuICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gIH0pO1xyXG5cclxuICAvLyBQcmludCA9PT09PT09PT09PT09PVxyXG4gIGNvbnN0IHByaW50U2NyZWVuID0gKHByaW50KSA9PiB7XHJcbiAgICBjb25zdCBwcmludEFyZWEgPSBwcmludC5pbm5lckhUTUw7XHJcbiAgICBjb25zdCBwcmludFBhZ2UgPSB3aW5kb3cub3BlbignJywgJ1ByaW50aW5nLi4uJywgJycpO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50Lm9wZW4oKTtcclxuICAgIHByaW50UGFnZS5kb2N1bWVudC53cml0ZShcclxuICAgICAgYDxodG1sPlxyXG4gICAgICAgIDxoZWFkPlxyXG4gICAgICAgIDxtZXRhIGNoYXJzZXQ9XCJVVEYtOFwiIC8+XHJcbiAgICAgICAgPG1ldGEgaHR0cC1lcXVpdj1cIlgtVUEtQ29tcGF0aWJsZVwiIGNvbnRlbnQ9XCJJRT1lZGdlXCIgLz5cclxuICAgICAgICA8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwid2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMFwiIC8+XHJcbiAgICAgICAgICA8dGl0bGU+5aCx5YO55Zau55Si55Sf5ZmoPC90aXRsZT5cclxuICAgICAgICAgIDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiBocmVmPVwiaHR0cHM6Ly91bnBrZy5jb20vQHRhYmxlci9jb3JlQGxhdGVzdC9kaXN0L2Nzcy90YWJsZXIubWluLmNzc1wiLz5cclxuICAgICAgICA8L2hlYWQ+XHJcbiAgICAgICAgPGJvZHkgb25sb2FkPSd3aW5kb3cucHJpbnQoKTt3aW5kb3cuY2xvc2UoKSc+YFxyXG4gICAgKTtcclxuICAgIHByaW50UGFnZS5kb2N1bWVudC53cml0ZShwcmludEFyZWEpO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LmNsb3NlKCc8L2JvZHk+PC9odG1sPicpO1xyXG4gIH07XHJcblxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwcmludCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuICAgIGNvbnN0IHByaW50SHRtbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXHJcbiAgICAgICcjbW9kYWwgLm1vZGFsLWRpYWxvZyAubW9kYWwtY29udGVudCdcclxuICAgICk7XHJcblxyXG4gICAgY29uc3QgbmV3UHJpbnRIdG1sID0gcHJpbnRIdG1sLmNsb25lTm9kZSh0cnVlKTtcclxuICAgIG5ld1ByaW50SHRtbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtZm9vdGVyJykucmVtb3ZlKCk7XHJcbiAgICBuZXdQcmludEh0bWwuaW5zZXJ0QWRqYWNlbnRIVE1MKFxyXG4gICAgICAnYmVmb3JlZW5kJyxcclxuICAgICAgYDxwIHN0eWxlPVwidGV4dC1hbGlnbjogcmlnaHQ7XCI+5aCx5YO55pmC6ZaT77yaJHtub3d9PC9wPmBcclxuICAgICk7XHJcblxyXG4gICAgcHJpbnRTY3JlZW4obmV3UHJpbnRIdG1sKTtcclxuICB9KTtcclxufSkoKTtcclxuIl0sImZpbGUiOiJtYWluLmpzIn0=
