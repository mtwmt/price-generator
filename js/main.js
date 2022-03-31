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
    var preview = document.querySelector('#modal .modal-content');
    var previewHeight = preview.offsetHeight;
    var previewFooterHeight = preview.querySelector('.modal-footer').offsetHeight;
    var captureHeight = previewHeight - previewFooterHeight; // export Image

    html2canvas(preview, {
      height: captureHeight
    }).then(function (canvas) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiXSwibmFtZXMiOlsiJG1vZGFsIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiJHByZXZpZXciLCIkZm9ybSIsIiRpbnB1dHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibWFpblZhbGlkYXRlIiwiY29tcGFueSIsInByZXNlbmNlIiwibWVzc2FnZSIsIm5hbWUiLCJlbWFpbCIsInBob25lIiwiZm9ybWF0IiwicGF0dGVybiIsImNvbnN0cmFpbnRzIiwic2V0TnVtRm9ybWF0IiwibnVtIiwicmVwbGFjZSIsInNldEFtb3VudCIsInJvdyIsInByaWNlIiwidmFsdWUiLCJjb3VudCIsInNldFRvdGFsIiwidG90YWwiLCJnZXRUb3RhbCIsImZvckVhY2giLCJlIiwidGV4dENvbnRlbnQiLCJkZWxJdGVtIiwiYWRkRXZlbnRMaXN0ZW5lciIsInByZXZlbnREZWZhdWx0IiwibGVuZ3RoIiwicGFyZW50RWxlbWVudCIsInJlbW92ZSIsInNldEl0ZW1Gb3JtVmFsaWRhdGUiLCJ1cGRhdGVJdGVtUm93IiwiaSIsImV2IiwiZXJyb3JzIiwidmFsaWRhdGUiLCJzaG93RXJyb3JzRm9ySW5wdXQiLCJjcmVhdGVJdGVtIiwiZGF0YSIsIm1hcCIsImNhdGVnb3J5IiwiaXRlbSIsInVuaXQiLCJhbW91bnQiLCJjcmVhdGVNb2RhbCIsIml0ZW1zIiwiam9pbiIsImRlc2MiLCJpdGVtVmFsaWRhdGUiLCJyZXNldEZvcm1JbnB1dCIsImZvcm1JbnB1dCIsImNsYXNzTGlzdCIsInBhcmVudE5vZGUiLCJlbCIsImFkZEVycm9yIiwiZXJyb3IiLCJibG9jayIsImNyZWF0ZUVsZW1lbnQiLCJhZGQiLCJpbm5lclRleHQiLCJhcHBlbmRDaGlsZCIsImlucHV0IiwiZXJyIiwic2hvd0Vycm9ycyIsImZvcm0iLCJoYW5kbGVGb3JtU3VibWl0IiwiZm9ybURhdGEiLCJpbmRleCIsInB1c2giLCJuZXdSb3ciLCJjbG9uZU5vZGUiLCJkZWZhdWx0VmFsdWUiLCJhcHBlbmQiLCJtb2RhbFRpdGxlIiwibW9kYWxCb2R5IiwiaW5zZXJ0QWRqYWNlbnRIVE1MIiwicHJldmlldyIsInByZXZpZXdIZWlnaHQiLCJvZmZzZXRIZWlnaHQiLCJwcmV2aWV3Rm9vdGVySGVpZ2h0IiwiY2FwdHVyZUhlaWdodCIsImh0bWwyY2FudmFzIiwiaGVpZ2h0IiwidGhlbiIsImNhbnZhcyIsImJvZHkiLCJhIiwiaHJlZiIsInRvRGF0YVVSTCIsImRvd25sb2FkIiwiRGF0ZSIsInRvTG9jYWxlU3RyaW5nIiwiaG91cjEyIiwiY2xpY2siLCJwcmludFNjcmVlbiIsInByaW50IiwicHJpbnRBcmVhIiwiaW5uZXJIVE1MIiwicHJpbnRQYWdlIiwid2luZG93Iiwib3BlbiIsIndyaXRlIiwiY2xvc2UiLCJub3ciLCJ0b0xvY2FsZURhdGVTdHJpbmciLCJwcmludEh0bWwiLCJuZXdQcmludEh0bWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsQ0FBQyxZQUFZO0FBQ1gsTUFBTUEsTUFBTSxHQUFHQyxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBZjtBQUNBLE1BQU1DLFFBQVEsR0FBR0YsUUFBUSxDQUFDQyxhQUFULENBQXVCLFVBQXZCLENBQWpCO0FBQ0EsTUFBTUUsS0FBSyxHQUFHSCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsV0FBdkIsQ0FBZDtBQUNBLE1BQU1HLE9BQU8sR0FBR0osUUFBUSxDQUFDSyxnQkFBVCxDQUEwQix5QkFBMUIsQ0FBaEIsQ0FKVyxDQU1YOztBQUNBLE1BQU1DLFlBQVksR0FBRztBQUNuQkMsSUFBQUEsT0FBTyxFQUFFO0FBQ1BDLE1BQUFBLFFBQVEsRUFBRTtBQUNSQyxRQUFBQSxPQUFPLEVBQUU7QUFERDtBQURILEtBRFU7QUFNbkJDLElBQUFBLElBQUksRUFBRTtBQUNKRixNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQ7QUFETixLQU5hO0FBV25CRSxJQUFBQSxLQUFLLEVBQUU7QUFDTEgsTUFBQUEsUUFBUSxFQUFFO0FBQ1JDLFFBQUFBLE9BQU8sRUFBRTtBQURELE9BREw7QUFJTEUsTUFBQUEsS0FBSyxFQUFFO0FBQ0xGLFFBQUFBLE9BQU8sRUFBRTtBQURKO0FBSkYsS0FYWTtBQW1CbkJHLElBQUFBLEtBQUssRUFBRTtBQUNMSixNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQsT0FETDtBQUlMSSxNQUFBQSxNQUFNLEVBQUU7QUFDTkMsUUFBQUEsT0FBTyxFQUFFLGNBREg7QUFFTkwsUUFBQUEsT0FBTyxFQUFFO0FBRkg7QUFKSDtBQW5CWSxHQUFyQjtBQTZCQSxNQUFJTSxXQUFXLEdBQUcsRUFBbEI7O0FBRUEsTUFBTUMsWUFBWSxHQUFHLFNBQWZBLFlBQWUsQ0FBQ0MsR0FBRCxFQUFTO0FBQzVCQSxJQUFBQSxHQUFHLEdBQUdBLEdBQUcsR0FBRyxFQUFaO0FBQ0EsV0FBT0EsR0FBRyxDQUFDQyxPQUFKLENBQVkseUJBQVosRUFBdUMsR0FBdkMsQ0FBUDtBQUNELEdBSEQ7O0FBS0EsTUFBTUMsU0FBUyxHQUFHLFNBQVpBLFNBQVksQ0FBQ0MsR0FBRCxFQUFTO0FBQ3pCLFFBQU1DLEtBQUssR0FBR0QsR0FBRyxDQUFDbkIsYUFBSixrQkFBbUNxQixLQUFuQyxJQUE0QyxDQUExRDtBQUNBLFFBQU1DLEtBQUssR0FBR0gsR0FBRyxDQUFDbkIsYUFBSixrQkFBbUNxQixLQUFuQyxJQUE0QyxDQUExRDtBQUNBRixJQUFBQSxHQUFHLENBQUNuQixhQUFKLENBQWtCLGVBQWxCLEVBQW1DcUIsS0FBbkMsR0FBMkNELEtBQUssR0FBR0UsS0FBbkQ7QUFDRCxHQUpEOztBQU1BLE1BQU1DLFFBQVEsR0FBRyxTQUFYQSxRQUFXLEdBQU07QUFDckIsUUFBTUMsS0FBSyxHQUFHekIsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixlQUExQixDQUFkO0FBQ0EsUUFBSXFCLFFBQVEsR0FBRyxDQUFmO0FBQ0FELElBQUFBLEtBQUssQ0FBQ0UsT0FBTixDQUFjLFVBQUNDLENBQUQsRUFBTztBQUNuQkYsTUFBQUEsUUFBUSxJQUFJLENBQUNFLENBQUMsQ0FBQ04sS0FBZjtBQUNELEtBRkQ7QUFHQXRCLElBQUFBLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixjQUF2QixFQUF1QzRCLFdBQXZDLEdBQXFEYixZQUFZLENBQUNVLFFBQUQsQ0FBakU7QUFDRCxHQVBEOztBQVNBLE1BQU1JLE9BQU8sR0FBRyxTQUFWQSxPQUFVLENBQUNWLEdBQUQsRUFBUztBQUN2QkEsSUFBQUEsR0FBRyxDQUFDbkIsYUFBSixDQUFrQixVQUFsQixFQUE4QjhCLGdCQUE5QixDQUErQyxPQUEvQyxFQUF3RCxVQUFVSCxDQUFWLEVBQWE7QUFDbkVBLE1BQUFBLENBQUMsQ0FBQ0ksY0FBRjs7QUFDQSxVQUFJaEMsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5QzRCLE1BQXpDLEdBQWtELENBQXRELEVBQXlEO0FBQ3ZELGFBQUtDLGFBQUwsQ0FBbUJBLGFBQW5CLENBQWlDQyxNQUFqQztBQUNBWCxRQUFBQSxRQUFRO0FBQ1Q7O0FBQ0RZLE1BQUFBLG1CQUFtQjtBQUNwQixLQVBEO0FBUUQsR0FURDs7QUFXQSxNQUFNQyxhQUFhLEdBQUcsU0FBaEJBLGFBQWdCLENBQUNqQixHQUFELEVBQVM7QUFDN0JBLElBQUFBLEdBQUcsQ0FBQ2YsZ0JBQUosQ0FBcUIsT0FBckIsRUFBOEJzQixPQUE5QixDQUFzQyxVQUFDQyxDQUFELEVBQUlVLENBQUosRUFBVTtBQUM5Q1YsTUFBQUEsQ0FBQyxDQUFDRyxnQkFBRixDQUFtQixRQUFuQixFQUE2QixVQUFDUSxFQUFELEVBQVE7QUFDbkNwQixRQUFBQSxTQUFTLENBQUNDLEdBQUQsQ0FBVDtBQUNBSSxRQUFBQSxRQUFRO0FBQ1IsWUFBTWdCLE1BQU0sR0FBR0MsUUFBUSxDQUFDdEMsS0FBRCxFQUFRWSxXQUFSLENBQVIsSUFBZ0MsRUFBL0M7QUFDQTJCLFFBQUFBLGtCQUFrQixDQUFDZCxDQUFELEVBQUlZLE1BQU0sQ0FBQ1osQ0FBQyxDQUFDbEIsSUFBSCxDQUFWLENBQWxCO0FBQ0QsT0FMRDtBQU1ELEtBUEQ7QUFRQW9CLElBQUFBLE9BQU8sQ0FBQ1YsR0FBRCxDQUFQO0FBQ0QsR0FWRDs7QUFZQSxNQUFNdUIsVUFBVSxHQUFHLFNBQWJBLFVBQWEsQ0FBQ0MsSUFBRCxFQUFVO0FBQzNCLFdBQU9BLElBQUksQ0FBQ0MsR0FBTCxDQUNMLFVBQUNqQixDQUFEO0FBQUEseUVBRzRCQSxDQUFDLENBQUNrQixRQUg5QixzREFJNEJsQixDQUFDLENBQUNtQixJQUo5QixrQ0FLVW5CLENBQUMsQ0FBQ1AsS0FMWixrQ0FNVU8sQ0FBQyxDQUFDTCxLQU5aLGNBTXFCLENBQUMsQ0FBQ0ssQ0FBQyxDQUFDb0IsSUFBSixHQUFXLEdBQVgsR0FBaUIsRUFOdEMsY0FNNENwQixDQUFDLENBQUNvQixJQU45QywrREFPcUNoQyxZQUFZLENBQUNZLENBQUMsQ0FBQ3FCLE1BQUgsQ0FQakQ7QUFBQSxLQURLLENBQVA7QUFZRCxHQWJEOztBQWNBLE1BQU1DLFdBQVcsR0FBRyxTQUFkQSxXQUFjLENBQUNOLElBQUQsRUFBVTtBQUM1Qiw2TEFLY0EsSUFBSSxDQUFDbEMsSUFMbkIsb0hBU2NrQyxJQUFJLENBQUNoQyxLQVRuQixrR0FhY2dDLElBQUksQ0FBQ2pDLEtBYm5CLDZaQTJCVWdDLFVBQVUsQ0FBQ0MsSUFBSSxDQUFDTyxLQUFOLENBQVYsQ0FBdUJDLElBQXZCLENBQTRCLEVBQTVCLENBM0JWLG9LQStCYVIsSUFBSSxDQUFDbkIsS0EvQmxCLDBWQThDYyxDQUFDbUIsSUFBSSxDQUFDUyxJQUFMLEdBQVksRUFBYixFQUFpQm5DLE9BQWpCLENBQXlCLE9BQXpCLEVBQWtDLFFBQWxDLENBOUNkO0FBc0RELEdBdkRELENBL0ZXLENBd0pYOzs7QUFDQSxNQUFNa0IsbUJBQW1CLEdBQUcsU0FBdEJBLG1CQUFzQixHQUFNO0FBQ2hDLFFBQUlrQixZQUFZLEdBQUcsRUFBbkI7QUFDQXRELElBQUFBLFFBQVEsQ0FBQ0ssZ0JBQVQsQ0FBMEIsYUFBMUIsRUFBeUNzQixPQUF6QyxDQUFpRCxVQUFDQyxDQUFELEVBQUlVLENBQUosRUFBVTtBQUFBOztBQUN6RFYsTUFBQUEsQ0FBQyxDQUFDM0IsYUFBRixDQUFnQixrQkFBaEIsRUFBb0NTLElBQXBDLHFCQUFzRDRCLENBQXREO0FBQ0FWLE1BQUFBLENBQUMsQ0FBQzNCLGFBQUYsQ0FBZ0IsY0FBaEIsRUFBZ0NTLElBQWhDLGlCQUE4QzRCLENBQTlDO0FBQ0FWLE1BQUFBLENBQUMsQ0FBQzNCLGFBQUYsQ0FBZ0IsZUFBaEIsRUFBaUNTLElBQWpDLGtCQUFnRDRCLENBQWhEO0FBQ0FWLE1BQUFBLENBQUMsQ0FBQzNCLGFBQUYsQ0FBZ0IsZUFBaEIsRUFBaUNTLElBQWpDLGtCQUFnRDRCLENBQWhEO0FBQ0FWLE1BQUFBLENBQUMsQ0FBQzNCLGFBQUYsQ0FBZ0IsY0FBaEIsRUFBZ0NTLElBQWhDLGlCQUE4QzRCLENBQTlDO0FBRUFnQixNQUFBQSxZQUFZLG1DQUNQQSxZQURPLDJFQUVGaEIsQ0FGRSxHQUVJO0FBQ1o5QixRQUFBQSxRQUFRLEVBQUU7QUFDUkMsVUFBQUEsT0FBTyxFQUFFO0FBREQ7QUFERSxPQUZKLGtEQU9ENkIsQ0FQQyxHQU9LO0FBQ2I5QixRQUFBQSxRQUFRLEVBQUU7QUFDUkMsVUFBQUEsT0FBTyxFQUFFO0FBREQ7QUFERyxPQVBMLG1CQUFaO0FBYUQsS0FwQkQ7QUFxQkFNLElBQUFBLFdBQVcsbUNBQ05ULFlBRE0sR0FFTmdELFlBRk0sQ0FBWDtBQUlELEdBM0JEOztBQTZCQSxNQUFNQyxjQUFjLEdBQUcsU0FBakJBLGNBQWlCLENBQUNDLFNBQUQsRUFBZTtBQUNwQ0EsSUFBQUEsU0FBUyxDQUFDQyxTQUFWLENBQW9CdEIsTUFBcEIsQ0FBMkIsWUFBM0I7QUFDQXFCLElBQUFBLFNBQVMsQ0FBQ0UsVUFBVixDQUFxQnJELGdCQUFyQixDQUFzQyxtQkFBdEMsRUFBMkRzQixPQUEzRCxDQUFtRSxVQUFDZ0MsRUFBRCxFQUFRO0FBQ3pFQSxNQUFBQSxFQUFFLENBQUN4QixNQUFIO0FBQ0QsS0FGRDtBQUdELEdBTEQ7O0FBT0EsTUFBTXlCLFFBQVEsR0FBRyxTQUFYQSxRQUFXLENBQUNKLFNBQUQsRUFBWUssS0FBWixFQUFzQjtBQUNyQyxRQUFNQyxLQUFLLEdBQUc5RCxRQUFRLENBQUMrRCxhQUFULENBQXVCLEtBQXZCLENBQWQ7QUFDQUQsSUFBQUEsS0FBSyxDQUFDTCxTQUFOLENBQWdCTyxHQUFoQixDQUFvQixrQkFBcEI7QUFDQUYsSUFBQUEsS0FBSyxDQUFDRyxTQUFOLEdBQWtCSixLQUFsQjtBQUNBTCxJQUFBQSxTQUFTLENBQUNFLFVBQVYsQ0FBcUJRLFdBQXJCLENBQWlDSixLQUFqQztBQUNELEdBTEQ7O0FBT0EsTUFBTXBCLGtCQUFrQixHQUFHLFNBQXJCQSxrQkFBcUIsQ0FBQ3lCLEtBQUQsRUFBUTNCLE1BQVIsRUFBbUI7QUFDNUNlLElBQUFBLGNBQWMsQ0FBQ1ksS0FBRCxDQUFkOztBQUNBLFFBQUkzQixNQUFKLEVBQVk7QUFDVjJCLE1BQUFBLEtBQUssQ0FBQ1YsU0FBTixDQUFnQk8sR0FBaEIsQ0FBb0IsWUFBcEI7QUFFQXhCLE1BQUFBLE1BQU0sQ0FBQ2IsT0FBUCxDQUFlLFVBQUN5QyxHQUFELEVBQVM7QUFDdEJSLFFBQUFBLFFBQVEsQ0FBQ08sS0FBRCxFQUFRQyxHQUFSLENBQVI7QUFDRCxPQUZEO0FBR0Q7QUFDRixHQVREOztBQVdBLE1BQU1DLFVBQVUsR0FBRyxTQUFiQSxVQUFhLENBQUNDLElBQUQsRUFBTzlCLE1BQVAsRUFBa0I7QUFDbkM4QixJQUFBQSxJQUFJLENBQUNqRSxnQkFBTCxDQUFzQiwyQkFBdEIsRUFBbURzQixPQUFuRCxDQUEyRCxVQUFDd0MsS0FBRCxFQUFXO0FBQ3BFekIsTUFBQUEsa0JBQWtCLENBQUN5QixLQUFELEVBQVEzQixNQUFNLElBQUlBLE1BQU0sQ0FBQzJCLEtBQUssQ0FBQ3pELElBQVAsQ0FBeEIsQ0FBbEI7QUFDRCxLQUZEO0FBR0QsR0FKRDs7QUFNQSxNQUFNNkQsZ0JBQWdCLEdBQUcsU0FBbkJBLGdCQUFtQixDQUFDRCxJQUFELEVBQVU7QUFDakMsUUFBTTlCLE1BQU0sR0FBR0MsUUFBUSxDQUFDNkIsSUFBRCxFQUFPdkQsV0FBUCxDQUF2Qjs7QUFDQSxRQUFJLENBQUN5QixNQUFMLEVBQWE7QUFDWCxhQUFPLElBQVA7QUFDRDs7QUFDRDZCLElBQUFBLFVBQVUsQ0FBQ0MsSUFBRCxFQUFPOUIsTUFBTSxJQUFJLEVBQWpCLENBQVY7QUFDQSxXQUFPLEtBQVA7QUFDRCxHQVBEO0FBU0E7QUFDRjtBQUNBO0FBQ0E7OztBQUNFLE1BQU1nQyxRQUFRLEdBQUcsU0FBWEEsUUFBVyxHQUFZO0FBQzNCLFFBQU01QixJQUFJLEdBQUc7QUFDWHJDLE1BQUFBLE9BQU8sRUFBRVAsUUFBUSxDQUFDQyxhQUFULENBQXVCLGdCQUF2QixFQUF5Q3FCLEtBRHZDO0FBRVhaLE1BQUFBLElBQUksRUFBRVYsUUFBUSxDQUFDQyxhQUFULENBQXVCLGFBQXZCLEVBQXNDcUIsS0FGakM7QUFHWFYsTUFBQUEsS0FBSyxFQUFFWixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsY0FBdkIsRUFBdUNxQixLQUhuQztBQUlYWCxNQUFBQSxLQUFLLEVBQUVYLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixjQUF2QixFQUF1Q3FCLEtBSm5DO0FBS1grQixNQUFBQSxJQUFJLEVBQUVyRCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsYUFBdkIsRUFBc0NxQixLQUxqQztBQU1YRyxNQUFBQSxLQUFLLEVBQUV6QixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsY0FBdkIsRUFBdUM0QixXQU5uQztBQU9Yc0IsTUFBQUEsS0FBSyxFQUFFO0FBUEksS0FBYjtBQVVBbkQsSUFBQUEsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBSTZDLEtBQUosRUFBYztBQUM3RDdCLE1BQUFBLElBQUksQ0FBQ08sS0FBTCxDQUFXdUIsSUFBWCxDQUFnQjtBQUNkNUIsUUFBQUEsUUFBUSxFQUFFbEIsQ0FBQyxDQUFDM0IsYUFBRixvQkFBbUNxQixLQUQvQjtBQUVkeUIsUUFBQUEsSUFBSSxFQUFFbkIsQ0FBQyxDQUFDM0IsYUFBRixnQkFBK0JxQixLQUZ2QjtBQUdkRCxRQUFBQSxLQUFLLEVBQUVPLENBQUMsQ0FBQzNCLGFBQUYsaUJBQWdDcUIsS0FIekI7QUFJZEMsUUFBQUEsS0FBSyxFQUFFSyxDQUFDLENBQUMzQixhQUFGLGlCQUFnQ3FCLEtBSnpCO0FBS2QwQixRQUFBQSxJQUFJLEVBQUVwQixDQUFDLENBQUMzQixhQUFGLGdCQUErQnFCLEtBTHZCO0FBTWQyQixRQUFBQSxNQUFNLEVBQUVyQixDQUFDLENBQUMzQixhQUFGLG1CQUFrQ3FCO0FBTjVCLE9BQWhCO0FBUUQsS0FURDtBQVVBLFdBQU9zQixJQUFQO0FBQ0QsR0F0QkQsQ0FsT1csQ0EwUFg7OztBQUNBNUMsRUFBQUEsUUFBUSxDQUFDSyxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBTztBQUN0RFMsSUFBQUEsYUFBYSxDQUFDVCxDQUFELENBQWI7QUFDQVEsSUFBQUEsbUJBQW1CO0FBQ3BCLEdBSEQ7QUFLQWhDLEVBQUFBLE9BQU8sQ0FBQ3VCLE9BQVIsQ0FBZ0IsVUFBQ0MsQ0FBRCxFQUFJVSxDQUFKLEVBQVU7QUFDeEJWLElBQUFBLENBQUMsQ0FBQ0csZ0JBQUYsQ0FBbUIsUUFBbkIsRUFBNkIsVUFBQ1EsRUFBRCxFQUFRO0FBQ25DLFVBQU1DLE1BQU0sR0FBR0MsUUFBUSxDQUFDdEMsS0FBRCxFQUFRWSxXQUFSLENBQVIsSUFBZ0MsRUFBL0M7QUFDQTJCLE1BQUFBLGtCQUFrQixDQUFDZCxDQUFELEVBQUlZLE1BQU0sQ0FBQ1osQ0FBQyxDQUFDbEIsSUFBSCxDQUFWLENBQWxCO0FBQ0QsS0FIRDtBQUlELEdBTEQsRUFoUVcsQ0F1UVg7O0FBQ0FWLEVBQUFBLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixVQUF2QixFQUFtQzhCLGdCQUFuQyxDQUFvRCxPQUFwRCxFQUE2RCxVQUFVSCxDQUFWLEVBQWE7QUFDeEVBLElBQUFBLENBQUMsQ0FBQ0ksY0FBRjtBQUNBLFFBQU1aLEdBQUcsR0FBR3BCLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixhQUF2QixDQUFaO0FBQ0EsUUFBTTBFLE1BQU0sR0FBR3ZELEdBQUcsQ0FBQ3dELFNBQUosQ0FBYyxJQUFkLENBQWY7QUFDQUQsSUFBQUEsTUFBTSxDQUFDdEUsZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUNzQixPQUFqQyxDQUF5QyxVQUFDQyxDQUFELEVBQU87QUFDOUNBLE1BQUFBLENBQUMsQ0FBQ04sS0FBRixHQUFVTSxDQUFDLENBQUNpRCxZQUFaO0FBQ0FqRCxNQUFBQSxDQUFDLENBQUM2QixTQUFGLENBQVl0QixNQUFaLENBQW1CLFlBQW5CO0FBQ0FQLE1BQUFBLENBQUMsQ0FBQzhCLFVBQUYsQ0FBYXJELGdCQUFiLENBQThCLG1CQUE5QixFQUFtRHNCLE9BQW5ELENBQTJELFVBQUNnQyxFQUFELEVBQVE7QUFDakVBLFFBQUFBLEVBQUUsQ0FBQ3hCLE1BQUg7QUFDRCxPQUZEO0FBR0QsS0FORDtBQVFBbkMsSUFBQUEsUUFBUSxDQUFDQyxhQUFULENBQXVCLGNBQXZCLEVBQXVDNkUsTUFBdkMsQ0FBOENILE1BQTlDO0FBQ0F0QyxJQUFBQSxhQUFhLENBQUNzQyxNQUFELENBQWI7QUFDQXZDLElBQUFBLG1CQUFtQjtBQUNwQixHQWZELEVBeFFXLENBeVJYOztBQUNBbEMsRUFBQUEsUUFBUSxDQUFDNkIsZ0JBQVQsQ0FBMEIsZUFBMUIsRUFBMkMsVUFBVUgsQ0FBVixFQUFhO0FBQ3RELFFBQU1nQixJQUFJLEdBQUc0QixRQUFRLEVBQXJCO0FBQ0EsUUFBTU8sVUFBVSxHQUFHLEtBQUs5RSxhQUFMLENBQW1CLGNBQW5CLENBQW5CO0FBQ0EsUUFBTStFLFNBQVMsR0FBRyxLQUFLL0UsYUFBTCxDQUFtQixhQUFuQixDQUFsQjtBQUNBOEUsSUFBQUEsVUFBVSxDQUFDRCxNQUFYLFdBQXFCbEMsSUFBSSxDQUFDckMsT0FBMUIsY0FBcUMsQ0FBQ3FDLElBQUksQ0FBQ3JDLE9BQU4sR0FBZ0IsRUFBaEIsR0FBcUIsR0FBMUQ7QUFDQXlFLElBQUFBLFNBQVMsQ0FBQ0Msa0JBQVYsQ0FBNkIsV0FBN0IsRUFBMEMvQixXQUFXLENBQUNOLElBQUQsQ0FBckQ7QUFDRCxHQU5EO0FBT0ExQyxFQUFBQSxRQUFRLENBQUM2QixnQkFBVCxDQUEwQixpQkFBMUIsRUFBNkMsVUFBVUgsQ0FBVixFQUFhO0FBQ3hEQSxJQUFBQSxDQUFDLENBQUNJLGNBQUY7QUFDQSxTQUFLL0IsYUFBTCxDQUFtQixjQUFuQixFQUFtQzRCLFdBQW5DLEdBQWlELEVBQWpEO0FBQ0EsU0FBSzVCLGFBQUwsQ0FBbUIsYUFBbkIsRUFBa0M0QixXQUFsQyxHQUFnRCxFQUFoRDtBQUNELEdBSkQsRUFqU1csQ0F1U1g7O0FBQ0E5QixFQUFBQSxNQUFNLENBQUNnQyxnQkFBUCxDQUF3QixlQUF4QixFQUF5QyxVQUFVSCxDQUFWLEVBQWE7QUFDcEQsUUFBSSxDQUFDMkMsZ0JBQWdCLENBQUNwRSxLQUFELENBQXJCLEVBQThCO0FBQzVCeUIsTUFBQUEsQ0FBQyxDQUFDSSxjQUFGO0FBQ0EsV0FBSy9CLGFBQUwsQ0FBbUIsY0FBbkIsRUFBbUM0QixXQUFuQyxHQUFpRCxFQUFqRDtBQUNBLFdBQUs1QixhQUFMLENBQW1CLGFBQW5CLEVBQWtDNEIsV0FBbEMsR0FBZ0QsRUFBaEQ7QUFDRCxLQUpELE1BSU87QUFDTCxVQUFNZSxJQUFJLEdBQUc0QixRQUFRLEVBQXJCO0FBQ0EsVUFBTU8sVUFBVSxHQUFHLEtBQUs5RSxhQUFMLENBQW1CLGNBQW5CLENBQW5CO0FBQ0EsVUFBTStFLFNBQVMsR0FBRyxLQUFLL0UsYUFBTCxDQUFtQixhQUFuQixDQUFsQjtBQUNBOEUsTUFBQUEsVUFBVSxDQUFDRCxNQUFYLENBQWtCbEMsSUFBSSxDQUFDckMsT0FBTCxHQUFlLE1BQWpDO0FBQ0F5RSxNQUFBQSxTQUFTLENBQUNDLGtCQUFWLENBQTZCLFdBQTdCLEVBQTBDL0IsV0FBVyxDQUFDTixJQUFELENBQXJEO0FBQ0Q7QUFDRixHQVpEO0FBY0E3QyxFQUFBQSxNQUFNLENBQUNnQyxnQkFBUCxDQUF3QixpQkFBeEIsRUFBMkMsVUFBVUgsQ0FBVixFQUFhO0FBQ3REQSxJQUFBQSxDQUFDLENBQUNJLGNBQUY7QUFDQSxTQUFLL0IsYUFBTCxDQUFtQixjQUFuQixFQUFtQzRCLFdBQW5DLEdBQWlELEVBQWpEO0FBQ0EsU0FBSzVCLGFBQUwsQ0FBbUIsYUFBbkIsRUFBa0M0QixXQUFsQyxHQUFnRCxFQUFoRDtBQUNELEdBSkQsRUF0VFcsQ0E0VFg7O0FBQ0E3QixFQUFBQSxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsY0FBdkIsRUFBdUM4QixnQkFBdkMsQ0FBd0QsT0FBeEQsRUFBaUUsWUFBWTtBQUMzRSxRQUFNbUQsT0FBTyxHQUFHbEYsUUFBUSxDQUFDQyxhQUFULENBQXVCLHVCQUF2QixDQUFoQjtBQUNBLFFBQU1rRixhQUFhLEdBQUdELE9BQU8sQ0FBQ0UsWUFBOUI7QUFDQSxRQUFNQyxtQkFBbUIsR0FBR0gsT0FBTyxDQUFDakYsYUFBUixDQUFzQixlQUF0QixFQUN6Qm1GLFlBREg7QUFFQSxRQUFNRSxhQUFhLEdBQUdILGFBQWEsR0FBR0UsbUJBQXRDLENBTDJFLENBTzNFOztBQUNBRSxJQUFBQSxXQUFXLENBQUNMLE9BQUQsRUFBVTtBQUNuQk0sTUFBQUEsTUFBTSxFQUFFRjtBQURXLEtBQVYsQ0FBWCxDQUVHRyxJQUZILENBRVEsVUFBVUMsTUFBVixFQUFrQjtBQUN4QjFGLE1BQUFBLFFBQVEsQ0FBQzJGLElBQVQsQ0FBY3pCLFdBQWQsQ0FBMEJ3QixNQUExQjtBQUNBLFVBQU1FLENBQUMsR0FBRzVGLFFBQVEsQ0FBQytELGFBQVQsQ0FBdUIsR0FBdkIsQ0FBVjtBQUNBNkIsTUFBQUEsQ0FBQyxDQUFDQyxJQUFGLEdBQVNILE1BQU0sQ0FDWkksU0FETSxDQUNJLFlBREosRUFFTjVFLE9BRk0sQ0FFRSxZQUZGLEVBRWdCLG9CQUZoQixDQUFUO0FBR0EwRSxNQUFBQSxDQUFDLENBQUNHLFFBQUYsYUFBZ0IsSUFBSUMsSUFBSixHQUFXQyxjQUFYLENBQTBCLEtBQTFCLEVBQWlDO0FBQy9DQyxRQUFBQSxNQUFNLEVBQUU7QUFEdUMsT0FBakMsQ0FBaEI7QUFHQU4sTUFBQUEsQ0FBQyxDQUFDTyxLQUFGO0FBQ0QsS0FaRDtBQWFELEdBckJELEVBN1RXLENBb1ZYOztBQUNBLE1BQU1DLFdBQVcsR0FBRyxTQUFkQSxXQUFjLENBQUNDLEtBQUQsRUFBVztBQUM3QixRQUFNQyxTQUFTLEdBQUdELEtBQUssQ0FBQ0UsU0FBeEI7QUFDQSxRQUFNQyxTQUFTLEdBQUdDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLEVBQVosRUFBZ0IsYUFBaEIsRUFBK0IsRUFBL0IsQ0FBbEI7QUFDQUYsSUFBQUEsU0FBUyxDQUFDeEcsUUFBVixDQUFtQjBHLElBQW5CO0FBQ0FGLElBQUFBLFNBQVMsQ0FBQ3hHLFFBQVYsQ0FBbUIyRyxLQUFuQjtBQVdBSCxJQUFBQSxTQUFTLENBQUN4RyxRQUFWLENBQW1CMkcsS0FBbkIsQ0FBeUJMLFNBQXpCO0FBQ0FFLElBQUFBLFNBQVMsQ0FBQ3hHLFFBQVYsQ0FBbUI0RyxLQUFuQixDQUF5QixnQkFBekI7QUFDRCxHQWpCRDs7QUFtQkE1RyxFQUFBQSxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsRUFBaUM4QixnQkFBakMsQ0FBa0QsT0FBbEQsRUFBMkQsWUFBWTtBQUNyRSxRQUFNOEUsR0FBRyxHQUFHLElBQUliLElBQUosR0FBV2Msa0JBQVgsRUFBWjtBQUNBLFFBQU1DLFNBQVMsR0FBRy9HLFFBQVEsQ0FBQ0MsYUFBVCxDQUNoQixxQ0FEZ0IsQ0FBbEI7QUFJQSxRQUFNK0csWUFBWSxHQUFHRCxTQUFTLENBQUNuQyxTQUFWLENBQW9CLElBQXBCLENBQXJCO0FBQ0FvQyxJQUFBQSxZQUFZLENBQUMvRyxhQUFiLENBQTJCLGVBQTNCLEVBQTRDa0MsTUFBNUM7QUFDQTZFLElBQUFBLFlBQVksQ0FBQy9CLGtCQUFiLENBQ0UsV0FERiwwRUFFd0M0QixHQUZ4QztBQUtBVCxJQUFBQSxXQUFXLENBQUNZLFlBQUQsQ0FBWDtBQUNELEdBZEQ7QUFlRCxDQXZYRCIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiAoKSB7XHJcbiAgY29uc3QgJG1vZGFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI21vZGFsJyk7XHJcbiAgY29uc3QgJHByZXZpZXcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJldmlldycpO1xyXG4gIGNvbnN0ICRmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZm9ybSNmb3JtJyk7XHJcbiAgY29uc3QgJGlucHV0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0Jyk7XHJcblxyXG4gIC8vIHZhbGlkYXRlXHJcbiAgY29uc3QgbWFpblZhbGlkYXRlID0ge1xyXG4gICAgY29tcGFueToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl5qWt5Li75ZCN56ixJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBuYW1lOiB7XHJcbiAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ17oq4vovLjlhaXloLHlg7nkurrlk6EnLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGVtYWlsOiB7XHJcbiAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ17oq4vovLjlhaUgRS1NYWlsJyxcclxuICAgICAgfSxcclxuICAgICAgZW1haWw6IHtcclxuICAgICAgICBtZXNzYWdlOiAn5qC85byP6Yyv6KqkJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBwaG9uZToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl6IGv57Wh6Zu76KmxJyxcclxuICAgICAgfSxcclxuICAgICAgZm9ybWF0OiB7XHJcbiAgICAgICAgcGF0dGVybjogJ14wOVswLTldezh9JCcsXHJcbiAgICAgICAgbWVzc2FnZTogJ17miYvmqZ/moLzlvI/pjK/oqqQnLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9O1xyXG4gIGxldCBjb25zdHJhaW50cyA9IHt9O1xyXG5cclxuICBjb25zdCBzZXROdW1Gb3JtYXQgPSAobnVtKSA9PiB7XHJcbiAgICBudW0gPSBudW0gKyAnJztcclxuICAgIHJldHVybiBudW0ucmVwbGFjZSgvXFxCKD89KD86XFxkezN9KSsoPyFcXGQpKS9nLCAnLCcpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNldEFtb3VudCA9IChyb3cpID0+IHtcclxuICAgIGNvbnN0IHByaWNlID0gcm93LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1wcmljZV1gKS52YWx1ZSB8fCAwO1xyXG4gICAgY29uc3QgY291bnQgPSByb3cucXVlcnlTZWxlY3RvcihgW25hbWUqPWNvdW50XWApLnZhbHVlIHx8IDE7XHJcbiAgICByb3cucXVlcnlTZWxlY3RvcignW25hbWU9YW1vdW50XScpLnZhbHVlID0gcHJpY2UgKiBjb3VudDtcclxuICB9O1xyXG5cclxuICBjb25zdCBzZXRUb3RhbCA9ICgpID0+IHtcclxuICAgIGNvbnN0IHRvdGFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW25hbWU9YW1vdW50XScpO1xyXG4gICAgbGV0IGdldFRvdGFsID0gMDtcclxuICAgIHRvdGFsLmZvckVhY2goKGUpID0+IHtcclxuICAgICAgZ2V0VG90YWwgKz0gK2UudmFsdWU7XHJcbiAgICB9KTtcclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0b3RhbC1wcmljZScpLnRleHRDb250ZW50ID0gc2V0TnVtRm9ybWF0KGdldFRvdGFsKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBkZWxJdGVtID0gKHJvdykgPT4ge1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJy5kZWxJdGVtJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIGlmIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5yZW1vdmUoKTtcclxuICAgICAgICBzZXRUb3RhbCgpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldEl0ZW1Gb3JtVmFsaWRhdGUoKTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHVwZGF0ZUl0ZW1Sb3cgPSAocm93KSA9PiB7XHJcbiAgICByb3cucXVlcnlTZWxlY3RvckFsbCgnaW5wdXQnKS5mb3JFYWNoKChlLCBpKSA9PiB7XHJcbiAgICAgIGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7XHJcbiAgICAgICAgc2V0QW1vdW50KHJvdyk7XHJcbiAgICAgICAgc2V0VG90YWwoKTtcclxuICAgICAgICBjb25zdCBlcnJvcnMgPSB2YWxpZGF0ZSgkZm9ybSwgY29uc3RyYWludHMpIHx8IHt9O1xyXG4gICAgICAgIHNob3dFcnJvcnNGb3JJbnB1dChlLCBlcnJvcnNbZS5uYW1lXSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgICBkZWxJdGVtKHJvdyk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgY3JlYXRlSXRlbSA9IChkYXRhKSA9PiB7XHJcbiAgICByZXR1cm4gZGF0YS5tYXAoXHJcbiAgICAgIChlKSA9PlxyXG4gICAgICAgIGBcclxuICAgICAgICA8dHI+XHJcbiAgICAgICAgICA8dGQgY2xhc3M9XCJ0ZXh0LWxlZnRcIj4ke2UuY2F0ZWdvcnl9PC90ZD5cclxuICAgICAgICAgIDx0ZCBjbGFzcz1cInRleHQtbGVmdFwiPiR7ZS5pdGVtfTwvdGQ+XHJcbiAgICAgICAgICA8dGQ+JHtlLnByaWNlfTwvdGQ+XHJcbiAgICAgICAgICA8dGQ+JHtlLmNvdW50fSAkeyEhZS51bml0ID8gJy8nIDogJyd9ICR7ZS51bml0fTwvdGQ+XHJcbiAgICAgICAgICA8dGQgY2xhc3M9XCJ0ZXh0LWVuZCBwcmljZVwiPk5UJCAke3NldE51bUZvcm1hdChlLmFtb3VudCl9PC90ZD5cclxuICAgICAgICA8L3RyPiBcclxuICAgICAgYFxyXG4gICAgKTtcclxuICB9O1xyXG4gIGNvbnN0IGNyZWF0ZU1vZGFsID0gKGRhdGEpID0+IHtcclxuICAgIHJldHVybiBgXHJcbiAgICAgIDxkaXYgY2xhc3M9XCJ0YWJsZS1yZXNwb25zaXZlXCI+XHJcbiAgICAgICAgPHRhYmxlIGNsYXNzPVwidGFibGUgdGFibGUtdmNlbnRlclwiPlxyXG4gICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICA8dGg+5aCx5YO55Lq65ZOhPC90aD5cclxuICAgICAgICAgICAgPHRkPiR7ZGF0YS5uYW1lfTwvdGQ+XHJcbiAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICA8dGg+6IGv57Wh6Zu76KmxPC90aD5cclxuICAgICAgICAgICAgPHRkPiR7ZGF0YS5waG9uZX08L3RkPlxyXG4gICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPkUtTWFpbDwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEuZW1haWx9PC90ZD5cclxuICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgPC90YWJsZT5cclxuICAgICAgICA8dGFibGUgY2xhc3M9XCJ0YWJsZSB0YWJsZS12Y2VudGVyXCI+XHJcbiAgICAgICAgICA8dGhlYWQ+XHJcbiAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICA8dGg+6aGe5YilPC90aD5cclxuICAgICAgICAgICAgICA8dGg+6aCF55uuPC90aD5cclxuICAgICAgICAgICAgICA8dGg+5Zau5YO5PC90aD5cclxuICAgICAgICAgICAgICA8dGg+5pW46YePPC90aD5cclxuICAgICAgICAgICAgICA8dGggY2xhc3M9XCJ0ZXh0LWVuZFwiPumHkemhjTwvdGg+XHJcbiAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAke2NyZWF0ZUl0ZW0oZGF0YS5pdGVtcykuam9pbignJyl9XHJcbiAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICA8dGQgY29sc3Bhbj1cIjVcIiBjbGFzcz1cInRleHQtZW5kXCI+XHJcbiAgICAgICAgICAgICAgIOWQiOioiO+8mk5UJCA8c3BhbiBjbGFzcz1cImZzLTIgZnctYm9sZCB0ZXh0LWRhbmdlclwiPiR7XHJcbiAgICAgICAgICAgICAgICAgZGF0YS50b3RhbFxyXG4gICAgICAgICAgICAgICB9PC9zcGFuPiDlhYPmlbRcclxuICAgICAgICAgICAgICA8L3RkPlxyXG4gICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLXZjZW50ZXJcIj5cclxuICAgICAgICAgIDx0aGVhZD5cclxuICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgIDx0aD7lgpnoqLs8L3RoPlxyXG4gICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgPC90aGVhZD5cclxuICAgICAgICAgIDx0Ym9keT5cclxuICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgIDx0ZD5cclxuICAgICAgICAgICAgICAgICR7KGRhdGEuZGVzYyArICcnKS5yZXBsYWNlKC9cXHJcXG4vZywgJzxiciAvPicpfVxyXG4gICAgICAgICAgICAgIDwvdGQ+XHJcbiAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICA8L3RhYmxlPlxyXG4gICAgICA8L2Rpdj5cclxuICAgIGA7XHJcbiAgfTtcclxuXHJcbiAgLy8gc2V0IHZhbGlkYXRlXHJcbiAgY29uc3Qgc2V0SXRlbUZvcm1WYWxpZGF0ZSA9ICgpID0+IHtcclxuICAgIGxldCBpdGVtVmFsaWRhdGUgPSB7fTtcclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWl0ZW1dJykuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj1jYXRlZ29yeV0nKS5uYW1lID0gYGNhdGVnb3J5JHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPWl0ZW1dJykubmFtZSA9IGBpdGVtJHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPXByaWNlXScpLm5hbWUgPSBgcHJpY2Uke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9Y291bnRdJykubmFtZSA9IGBjb3VudCR7aX1gO1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj11bml0XScpLm5hbWUgPSBgdW5pdCR7aX1gO1xyXG5cclxuICAgICAgaXRlbVZhbGlkYXRlID0ge1xyXG4gICAgICAgIC4uLml0ZW1WYWxpZGF0ZSxcclxuICAgICAgICBbYGl0ZW0ke2l9YF06IHtcclxuICAgICAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICde6aCF55uu5ZCN56ix5LiN5b6X54K656m6JyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBbYHByaWNlJHtpfWBdOiB7XHJcbiAgICAgICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgICAgICBtZXNzYWdlOiAnXuWWruWDueWQjeeoseS4jeW+l+eCuuepuicsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuICAgIGNvbnN0cmFpbnRzID0ge1xyXG4gICAgICAuLi5tYWluVmFsaWRhdGUsXHJcbiAgICAgIC4uLml0ZW1WYWxpZGF0ZSxcclxuICAgIH07XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcmVzZXRGb3JtSW5wdXQgPSAoZm9ybUlucHV0KSA9PiB7XHJcbiAgICBmb3JtSW5wdXQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtaW52YWxpZCcpO1xyXG4gICAgZm9ybUlucHV0LnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLmludmFsaWQtZmVlZGJhY2snKS5mb3JFYWNoKChlbCkgPT4ge1xyXG4gICAgICBlbC5yZW1vdmUoKTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGFkZEVycm9yID0gKGZvcm1JbnB1dCwgZXJyb3IpID0+IHtcclxuICAgIGNvbnN0IGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBibG9jay5jbGFzc0xpc3QuYWRkKCdpbnZhbGlkLWZlZWRiYWNrJyk7XHJcbiAgICBibG9jay5pbm5lclRleHQgPSBlcnJvcjtcclxuICAgIGZvcm1JbnB1dC5wYXJlbnROb2RlLmFwcGVuZENoaWxkKGJsb2NrKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzaG93RXJyb3JzRm9ySW5wdXQgPSAoaW5wdXQsIGVycm9ycykgPT4ge1xyXG4gICAgcmVzZXRGb3JtSW5wdXQoaW5wdXQpO1xyXG4gICAgaWYgKGVycm9ycykge1xyXG4gICAgICBpbnB1dC5jbGFzc0xpc3QuYWRkKCdpcy1pbnZhbGlkJyk7XHJcblxyXG4gICAgICBlcnJvcnMuZm9yRWFjaCgoZXJyKSA9PiB7XHJcbiAgICAgICAgYWRkRXJyb3IoaW5wdXQsIGVycik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNob3dFcnJvcnMgPSAoZm9ybSwgZXJyb3JzKSA9PiB7XHJcbiAgICBmb3JtLnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W25hbWVdLCBzZWxlY3RbbmFtZV0nKS5mb3JFYWNoKChpbnB1dCkgPT4ge1xyXG4gICAgICBzaG93RXJyb3JzRm9ySW5wdXQoaW5wdXQsIGVycm9ycyAmJiBlcnJvcnNbaW5wdXQubmFtZV0pO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlRm9ybVN1Ym1pdCA9IChmb3JtKSA9PiB7XHJcbiAgICBjb25zdCBlcnJvcnMgPSB2YWxpZGF0ZShmb3JtLCBjb25zdHJhaW50cyk7XHJcbiAgICBpZiAoIWVycm9ycykge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHNob3dFcnJvcnMoZm9ybSwgZXJyb3JzIHx8IHt9KTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBmb3JtRGF0YVxyXG4gICAqIEByZXR1cm5zIOihqOWWruizh+aWmVxyXG4gICAqL1xyXG4gIGNvbnN0IGZvcm1EYXRhID0gZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc3QgZGF0YSA9IHtcclxuICAgICAgY29tcGFueTogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9Y29tcGFueV0nKS52YWx1ZSxcclxuICAgICAgbmFtZTogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9bmFtZV0nKS52YWx1ZSxcclxuICAgICAgcGhvbmU6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPXBob25lXScpLnZhbHVlLFxyXG4gICAgICBlbWFpbDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9ZW1haWxdJykudmFsdWUsXHJcbiAgICAgIGRlc2M6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWRlc2NdJykudmFsdWUsXHJcbiAgICAgIHRvdGFsOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdG90YWwtcHJpY2UnKS50ZXh0Q29udGVudCxcclxuICAgICAgaXRlbXM6IFtdLFxyXG4gICAgfTtcclxuXHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUsIGluZGV4KSA9PiB7XHJcbiAgICAgIGRhdGEuaXRlbXMucHVzaCh7XHJcbiAgICAgICAgY2F0ZWdvcnk6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWNhdGVnb3J5YCkudmFsdWUsXHJcbiAgICAgICAgaXRlbTogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9aXRlbWApLnZhbHVlLFxyXG4gICAgICAgIHByaWNlOiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1wcmljZWApLnZhbHVlLFxyXG4gICAgICAgIGNvdW50OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudGApLnZhbHVlLFxyXG4gICAgICAgIHVuaXQ6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPXVuaXRgKS52YWx1ZSxcclxuICAgICAgICBhbW91bnQ6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWFtb3VudF1gKS52YWx1ZSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBkYXRhO1xyXG4gIH07XHJcblxyXG4gIC8vIGRvY3VtZW50IGluaXQgPT09PT09PT09PT09PT1cclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUpID0+IHtcclxuICAgIHVwZGF0ZUl0ZW1Sb3coZSk7XHJcbiAgICBzZXRJdGVtRm9ybVZhbGlkYXRlKCk7XHJcbiAgfSk7XHJcblxyXG4gICRpbnB1dHMuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZXYpID0+IHtcclxuICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgc2hvd0Vycm9yc0ZvcklucHV0KGUsIGVycm9yc1tlLm5hbWVdKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICAvLyBhZGQgaXRlbSByb3dcclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWRkSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGNvbnN0IHJvdyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWl0ZW1dJyk7XHJcbiAgICBjb25zdCBuZXdSb3cgPSByb3cuY2xvbmVOb2RlKHRydWUpO1xyXG4gICAgbmV3Um93LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaCgoZSkgPT4ge1xyXG4gICAgICBlLnZhbHVlID0gZS5kZWZhdWx0VmFsdWU7XHJcbiAgICAgIGUuY2xhc3NMaXN0LnJlbW92ZSgnaXMtaW52YWxpZCcpO1xyXG4gICAgICBlLnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLmludmFsaWQtZmVlZGJhY2snKS5mb3JFYWNoKChlbCkgPT4ge1xyXG4gICAgICAgIGVsLnJlbW92ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWl0ZW1zXScpLmFwcGVuZChuZXdSb3cpO1xyXG4gICAgdXBkYXRlSXRlbVJvdyhuZXdSb3cpO1xyXG4gICAgc2V0SXRlbUZvcm1WYWxpZGF0ZSgpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBvbiBwcmV2aWV3XHJcbiAgJHByZXZpZXcuYWRkRXZlbnRMaXN0ZW5lcignc2hvdy5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBjb25zdCBkYXRhID0gZm9ybURhdGEoKTtcclxuICAgIGNvbnN0IG1vZGFsVGl0bGUgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC10aXRsZScpO1xyXG4gICAgY29uc3QgbW9kYWxCb2R5ID0gdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpO1xyXG4gICAgbW9kYWxUaXRsZS5hcHBlbmQoYCR7ZGF0YS5jb21wYW55fSAkeyFkYXRhLmNvbXBhbnkgPyAnJyA6ICctJ30g5aCx5YO55ZauYCk7XHJcbiAgICBtb2RhbEJvZHkuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCBjcmVhdGVNb2RhbChkYXRhKSk7XHJcbiAgfSk7XHJcbiAgJHByZXZpZXcuYWRkRXZlbnRMaXN0ZW5lcignaGlkZGVuLmJzLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSAnJztcclxuICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gIH0pO1xyXG5cclxuICAvLyBvbiBTdWJtaXRcclxuICAkbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignc2hvdy5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBpZiAoIWhhbmRsZUZvcm1TdWJtaXQoJGZvcm0pKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gICAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1ib2R5JykudGV4dENvbnRlbnQgPSAnJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IGRhdGEgPSBmb3JtRGF0YSgpO1xyXG4gICAgICBjb25zdCBtb2RhbFRpdGxlID0gdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKTtcclxuICAgICAgY29uc3QgbW9kYWxCb2R5ID0gdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpO1xyXG4gICAgICBtb2RhbFRpdGxlLmFwcGVuZChkYXRhLmNvbXBhbnkgKyAnLeWgseWDueWWricpO1xyXG4gICAgICBtb2RhbEJvZHkuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCBjcmVhdGVNb2RhbChkYXRhKSk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gICRtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdoaWRkZW4uYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgfSk7XHJcblxyXG4gIC8vIEV4cG9ydCA9PT09PT09PT09PT09PVxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNleHBvcnRJbWFnZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc3QgcHJldmlldyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2RhbCAubW9kYWwtY29udGVudCcpO1xyXG4gICAgY29uc3QgcHJldmlld0hlaWdodCA9IHByZXZpZXcub2Zmc2V0SGVpZ2h0O1xyXG4gICAgY29uc3QgcHJldmlld0Zvb3RlckhlaWdodCA9IHByZXZpZXcucXVlcnlTZWxlY3RvcignLm1vZGFsLWZvb3RlcicpXHJcbiAgICAgIC5vZmZzZXRIZWlnaHQ7XHJcbiAgICBjb25zdCBjYXB0dXJlSGVpZ2h0ID0gcHJldmlld0hlaWdodCAtIHByZXZpZXdGb290ZXJIZWlnaHQ7XHJcblxyXG4gICAgLy8gZXhwb3J0IEltYWdlXHJcbiAgICBodG1sMmNhbnZhcyhwcmV2aWV3LCB7XHJcbiAgICAgIGhlaWdodDogY2FwdHVyZUhlaWdodCxcclxuICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNhbnZhcykge1xyXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNhbnZhcyk7XHJcbiAgICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICAgIGEuaHJlZiA9IGNhbnZhc1xyXG4gICAgICAgIC50b0RhdGFVUkwoJ2ltYWdlL2pwZWcnKVxyXG4gICAgICAgIC5yZXBsYWNlKCdpbWFnZS9qcGVnJywgJ2ltYWdlL29jdGV0LXN0cmVhbScpO1xyXG4gICAgICBhLmRvd25sb2FkID0gYCR7bmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygncm9jJywge1xyXG4gICAgICAgIGhvdXIxMjogZmFsc2UsXHJcbiAgICAgIH0pfS1xdW90YXRpb24uanBnYDtcclxuICAgICAgYS5jbGljaygpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFByaW50ID09PT09PT09PT09PT09XHJcbiAgY29uc3QgcHJpbnRTY3JlZW4gPSAocHJpbnQpID0+IHtcclxuICAgIGNvbnN0IHByaW50QXJlYSA9IHByaW50LmlubmVySFRNTDtcclxuICAgIGNvbnN0IHByaW50UGFnZSA9IHdpbmRvdy5vcGVuKCcnLCAnUHJpbnRpbmcuLi4nLCAnJyk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQub3BlbigpO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LndyaXRlKFxyXG4gICAgICBgPGh0bWw+XHJcbiAgICAgICAgPGhlYWQ+XHJcbiAgICAgICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCIgLz5cclxuICAgICAgICA8bWV0YSBodHRwLWVxdWl2PVwiWC1VQS1Db21wYXRpYmxlXCIgY29udGVudD1cIklFPWVkZ2VcIiAvPlxyXG4gICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCIgLz5cclxuICAgICAgICAgIDx0aXRsZT7loLHlg7nllq7nlKLnlJ/lmag8L3RpdGxlPlxyXG4gICAgICAgICAgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCJodHRwczovL3VucGtnLmNvbS9AdGFibGVyL2NvcmVAbGF0ZXN0L2Rpc3QvY3NzL3RhYmxlci5taW4uY3NzXCIvPlxyXG4gICAgICAgIDwvaGVhZD5cclxuICAgICAgICA8Ym9keSBvbmxvYWQ9J3dpbmRvdy5wcmludCgpO3dpbmRvdy5jbG9zZSgpJz5gXHJcbiAgICApO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LndyaXRlKHByaW50QXJlYSk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQuY2xvc2UoJzwvYm9keT48L2h0bWw+Jyk7XHJcbiAgfTtcclxuXHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByaW50JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlRGF0ZVN0cmluZygpO1xyXG4gICAgY29uc3QgcHJpbnRIdG1sID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcclxuICAgICAgJyNtb2RhbCAubW9kYWwtZGlhbG9nIC5tb2RhbC1jb250ZW50J1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBuZXdQcmludEh0bWwgPSBwcmludEh0bWwuY2xvbmVOb2RlKHRydWUpO1xyXG4gICAgbmV3UHJpbnRIdG1sLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1mb290ZXInKS5yZW1vdmUoKTtcclxuICAgIG5ld1ByaW50SHRtbC5pbnNlcnRBZGphY2VudEhUTUwoXHJcbiAgICAgICdiZWZvcmVlbmQnLFxyXG4gICAgICBgPHAgc3R5bGU9XCJ0ZXh0LWFsaWduOiByaWdodDtcIj7loLHlg7nmmYLplpPvvJoke25vd308L3A+YFxyXG4gICAgKTtcclxuXHJcbiAgICBwcmludFNjcmVlbihuZXdQcmludEh0bWwpO1xyXG4gIH0pO1xyXG59KSgpO1xyXG4iXSwiZmlsZSI6Im1haW4uanMifQ==
