"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {
  var $modal = document.querySelector('#modal');
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
      return "\n        <tr>\n          <td class=\"text-left\">".concat(e.category, "</td>\n          <td class=\"text-left\">").concat(e.item, "</td>\n          <td>").concat(e.price, "</td>\n          <td>").concat(e.count, " ").concat(!!e.unit ? '/' : '', " ").concat(e.unit, "</td>\n          <td class=\"price\">").concat(e.amount, "</td>\n        </tr> \n      ");
    });
  };

  var createModal = function createModal(data) {
    return "\n      <div class=\"table-responsive\">\n        <table class=\"table table-vcenter\">\n          <tr>\n            <th>\u5831\u50F9\u4EBA\u54E1</th>\n            <td>".concat(data.name, "</td>\n          </tr>\n          <tr>\n            <th>\u806F\u7D61\u96FB\u8A71</th>\n            <td>").concat(data.phone, "</td>\n          </tr>\n          <tr>\n            <th>E-Mail</th>\n            <td>").concat(data.email, "</td>\n          </tr>\n        </table>\n        <table class=\"table table-vcenter\">\n          <thead>\n            <tr>\n              <th>\u985E\u5225</th>\n              <th>\u9805\u76EE</th>\n              <th>\u55AE\u50F9</th>\n              <th>\u6578\u91CF</th>\n              <th>\u91D1\u984D</th>\n            </tr>\n          </thead>\n          <tbody>\n            ").concat(createItem(data.items).join(''), "\n          </tbody>\n        </table>\n      </div>\n    ");
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

  var formData = function formData() {
    var data = {
      company: document.querySelector('[name=company]').value,
      name: document.querySelector('[name=name]').value,
      phone: document.querySelector('[name=phone]').value,
      email: document.querySelector('[name=email]').value,
      description: document.querySelector('[name=description]').value,
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
  }); // on Submit

  $modal.addEventListener('show.bs.modal', function (e) {
    if (!handleFormSubmit($form)) {
      e.preventDefault();
      this.querySelector('.modal-title').textContent = '';
      this.querySelector('.modal-body').textContent = '';
    } else {
      var data = formData();
      var modalTitle = document.querySelector('.modal-title');
      var modalBody = document.querySelector('.modal-body');
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
    var printHtml = document.querySelector('.modal-dialog .modal-content');
    var newPrintHtml = printHtml.cloneNode(true);
    newPrintHtml.querySelector('.modal-footer').remove();
    newPrintHtml.insertAdjacentHTML('beforeend', "<p style=\"text-align: right;\">\u5831\u50F9\u6642\u9593\uFF1A".concat(now, "</p>"));
    printScreen(newPrintHtml);
  });
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiXSwibmFtZXMiOlsiJG1vZGFsIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiJGZvcm0iLCIkaW5wdXRzIiwicXVlcnlTZWxlY3RvckFsbCIsIm1haW5WYWxpZGF0ZSIsImNvbXBhbnkiLCJwcmVzZW5jZSIsIm1lc3NhZ2UiLCJuYW1lIiwiZW1haWwiLCJwaG9uZSIsImZvcm1hdCIsInBhdHRlcm4iLCJjb25zdHJhaW50cyIsInNldE51bUZvcm1hdCIsIm51bSIsInJlcGxhY2UiLCJzZXRBbW91bnQiLCJyb3ciLCJwcmljZSIsInZhbHVlIiwiY291bnQiLCJzZXRUb3RhbCIsInRvdGFsIiwiZ2V0VG90YWwiLCJmb3JFYWNoIiwiZSIsInRleHRDb250ZW50IiwiZGVsSXRlbSIsImFkZEV2ZW50TGlzdGVuZXIiLCJwcmV2ZW50RGVmYXVsdCIsImxlbmd0aCIsInBhcmVudEVsZW1lbnQiLCJyZW1vdmUiLCJzZXRJdGVtRm9ybVZhbGlkYXRlIiwidXBkYXRlSXRlbVJvdyIsImkiLCJldiIsImVycm9ycyIsInZhbGlkYXRlIiwic2hvd0Vycm9yc0ZvcklucHV0IiwiY3JlYXRlSXRlbSIsImRhdGEiLCJtYXAiLCJjYXRlZ29yeSIsIml0ZW0iLCJ1bml0IiwiYW1vdW50IiwiY3JlYXRlTW9kYWwiLCJpdGVtcyIsImpvaW4iLCJpdGVtVmFsaWRhdGUiLCJyZXNldEZvcm1JbnB1dCIsImZvcm1JbnB1dCIsImNsYXNzTGlzdCIsInBhcmVudE5vZGUiLCJlbCIsImFkZEVycm9yIiwiZXJyb3IiLCJibG9jayIsImNyZWF0ZUVsZW1lbnQiLCJhZGQiLCJpbm5lclRleHQiLCJhcHBlbmRDaGlsZCIsImlucHV0IiwiZXJyIiwic2hvd0Vycm9ycyIsImZvcm0iLCJoYW5kbGVGb3JtU3VibWl0IiwiZm9ybURhdGEiLCJkZXNjcmlwdGlvbiIsImluZGV4IiwicHVzaCIsIm5ld1JvdyIsImNsb25lTm9kZSIsImRlZmF1bHRWYWx1ZSIsImFwcGVuZCIsIm1vZGFsVGl0bGUiLCJtb2RhbEJvZHkiLCJpbnNlcnRBZGphY2VudEhUTUwiLCJwcmludFNjcmVlbiIsInByaW50IiwicHJpbnRBcmVhIiwiaW5uZXJIVE1MIiwicHJpbnRQYWdlIiwid2luZG93Iiwib3BlbiIsIndyaXRlIiwiY2xvc2UiLCJub3ciLCJEYXRlIiwidG9Mb2NhbGVEYXRlU3RyaW5nIiwicHJpbnRIdG1sIiwibmV3UHJpbnRIdG1sIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBLENBQUMsWUFBWTtBQUNYLE1BQU1BLE1BQU0sR0FBR0MsUUFBUSxDQUFDQyxhQUFULENBQXVCLFFBQXZCLENBQWY7QUFDQSxNQUFNQyxLQUFLLEdBQUdGLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixXQUF2QixDQUFkO0FBQ0EsTUFBTUUsT0FBTyxHQUFHSCxRQUFRLENBQUNJLGdCQUFULENBQTBCLHlCQUExQixDQUFoQixDQUhXLENBS1g7O0FBQ0EsTUFBTUMsWUFBWSxHQUFHO0FBQ25CQyxJQUFBQSxPQUFPLEVBQUU7QUFDUEMsTUFBQUEsUUFBUSxFQUFFO0FBQ1JDLFFBQUFBLE9BQU8sRUFBRTtBQUREO0FBREgsS0FEVTtBQU1uQkMsSUFBQUEsSUFBSSxFQUFFO0FBQ0pGLE1BQUFBLFFBQVEsRUFBRTtBQUNSQyxRQUFBQSxPQUFPLEVBQUU7QUFERDtBQUROLEtBTmE7QUFXbkJFLElBQUFBLEtBQUssRUFBRTtBQUNMSCxNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQsT0FETDtBQUlMRSxNQUFBQSxLQUFLLEVBQUU7QUFDTEYsUUFBQUEsT0FBTyxFQUFFO0FBREo7QUFKRixLQVhZO0FBbUJuQkcsSUFBQUEsS0FBSyxFQUFFO0FBQ0xKLE1BQUFBLFFBQVEsRUFBRTtBQUNSQyxRQUFBQSxPQUFPLEVBQUU7QUFERCxPQURMO0FBSUxJLE1BQUFBLE1BQU0sRUFBRTtBQUNOQyxRQUFBQSxPQUFPLEVBQUUsY0FESDtBQUVOTCxRQUFBQSxPQUFPLEVBQUU7QUFGSDtBQUpIO0FBbkJZLEdBQXJCO0FBNkJBLE1BQUlNLFdBQVcsR0FBRyxFQUFsQjs7QUFFQSxNQUFNQyxZQUFZLEdBQUcsU0FBZkEsWUFBZSxDQUFDQyxHQUFELEVBQVM7QUFDNUJBLElBQUFBLEdBQUcsR0FBR0EsR0FBRyxHQUFHLEVBQVo7QUFDQSxXQUFPQSxHQUFHLENBQUNDLE9BQUosQ0FBWSx5QkFBWixFQUF1QyxHQUF2QyxDQUFQO0FBQ0QsR0FIRDs7QUFLQSxNQUFNQyxTQUFTLEdBQUcsU0FBWkEsU0FBWSxDQUFDQyxHQUFELEVBQVM7QUFDekIsUUFBTUMsS0FBSyxHQUFHRCxHQUFHLENBQUNsQixhQUFKLGtCQUFtQ29CLEtBQW5DLElBQTRDLENBQTFEO0FBQ0EsUUFBTUMsS0FBSyxHQUFHSCxHQUFHLENBQUNsQixhQUFKLGtCQUFtQ29CLEtBQW5DLElBQTRDLENBQTFEO0FBQ0FGLElBQUFBLEdBQUcsQ0FBQ2xCLGFBQUosQ0FBa0IsZUFBbEIsRUFBbUNvQixLQUFuQyxHQUEyQ0QsS0FBSyxHQUFHRSxLQUFuRDtBQUNELEdBSkQ7O0FBTUEsTUFBTUMsUUFBUSxHQUFHLFNBQVhBLFFBQVcsR0FBTTtBQUNyQixRQUFNQyxLQUFLLEdBQUd4QixRQUFRLENBQUNJLGdCQUFULENBQTBCLGVBQTFCLENBQWQ7QUFDQSxRQUFJcUIsUUFBUSxHQUFHLENBQWY7QUFDQUQsSUFBQUEsS0FBSyxDQUFDRSxPQUFOLENBQWMsVUFBQ0MsQ0FBRCxFQUFPO0FBQ25CRixNQUFBQSxRQUFRLElBQUksQ0FBQ0UsQ0FBQyxDQUFDTixLQUFmO0FBQ0QsS0FGRDtBQUdBckIsSUFBQUEsUUFBUSxDQUFDQyxhQUFULENBQXVCLGNBQXZCLEVBQXVDMkIsV0FBdkMsR0FBcURiLFlBQVksQ0FBQ1UsUUFBRCxDQUFqRTtBQUNELEdBUEQ7O0FBU0EsTUFBTUksT0FBTyxHQUFHLFNBQVZBLE9BQVUsQ0FBQ1YsR0FBRCxFQUFTO0FBQ3ZCQSxJQUFBQSxHQUFHLENBQUNsQixhQUFKLENBQWtCLFVBQWxCLEVBQThCNkIsZ0JBQTlCLENBQStDLE9BQS9DLEVBQXdELFVBQVVILENBQVYsRUFBYTtBQUNuRUEsTUFBQUEsQ0FBQyxDQUFDSSxjQUFGOztBQUNBLFVBQUkvQixRQUFRLENBQUNJLGdCQUFULENBQTBCLGFBQTFCLEVBQXlDNEIsTUFBekMsR0FBa0QsQ0FBdEQsRUFBeUQ7QUFDdkQsYUFBS0MsYUFBTCxDQUFtQkEsYUFBbkIsQ0FBaUNDLE1BQWpDO0FBQ0FYLFFBQUFBLFFBQVE7QUFDVDs7QUFDRFksTUFBQUEsbUJBQW1CO0FBQ3BCLEtBUEQ7QUFRRCxHQVREOztBQVdBLE1BQU1DLGFBQWEsR0FBRyxTQUFoQkEsYUFBZ0IsQ0FBQ2pCLEdBQUQsRUFBUztBQUM3QkEsSUFBQUEsR0FBRyxDQUFDZixnQkFBSixDQUFxQixPQUFyQixFQUE4QnNCLE9BQTlCLENBQXNDLFVBQUNDLENBQUQsRUFBSVUsQ0FBSixFQUFVO0FBQzlDVixNQUFBQSxDQUFDLENBQUNHLGdCQUFGLENBQW1CLFFBQW5CLEVBQTZCLFVBQUNRLEVBQUQsRUFBUTtBQUNuQ3BCLFFBQUFBLFNBQVMsQ0FBQ0MsR0FBRCxDQUFUO0FBQ0FJLFFBQUFBLFFBQVE7QUFDUixZQUFNZ0IsTUFBTSxHQUFHQyxRQUFRLENBQUN0QyxLQUFELEVBQVFZLFdBQVIsQ0FBUixJQUFnQyxFQUEvQztBQUNBMkIsUUFBQUEsa0JBQWtCLENBQUNkLENBQUQsRUFBSVksTUFBTSxDQUFDWixDQUFDLENBQUNsQixJQUFILENBQVYsQ0FBbEI7QUFDRCxPQUxEO0FBTUQsS0FQRDtBQVFBb0IsSUFBQUEsT0FBTyxDQUFDVixHQUFELENBQVA7QUFDRCxHQVZEOztBQVlBLE1BQU11QixVQUFVLEdBQUcsU0FBYkEsVUFBYSxDQUFDQyxJQUFELEVBQVU7QUFDM0IsV0FBT0EsSUFBSSxDQUFDQyxHQUFMLENBQ0wsVUFBQ2pCLENBQUQ7QUFBQSx5RUFHNEJBLENBQUMsQ0FBQ2tCLFFBSDlCLHNEQUk0QmxCLENBQUMsQ0FBQ21CLElBSjlCLGtDQUtVbkIsQ0FBQyxDQUFDUCxLQUxaLGtDQU1VTyxDQUFDLENBQUNMLEtBTlosY0FNcUIsQ0FBQyxDQUFDSyxDQUFDLENBQUNvQixJQUFKLEdBQVcsR0FBWCxHQUFpQixFQU50QyxjQU00Q3BCLENBQUMsQ0FBQ29CLElBTjlDLGtEQU93QnBCLENBQUMsQ0FBQ3FCLE1BUDFCO0FBQUEsS0FESyxDQUFQO0FBWUQsR0FiRDs7QUFjQSxNQUFNQyxXQUFXLEdBQUcsU0FBZEEsV0FBYyxDQUFDTixJQUFELEVBQVU7QUFDNUIsNkxBS2NBLElBQUksQ0FBQ2xDLElBTG5CLG9IQVNja0MsSUFBSSxDQUFDaEMsS0FUbkIsa0dBYWNnQyxJQUFJLENBQUNqQyxLQWJuQiwwWUEyQlVnQyxVQUFVLENBQUNDLElBQUksQ0FBQ08sS0FBTixDQUFWLENBQXVCQyxJQUF2QixDQUE0QixFQUE1QixDQTNCVjtBQWdDRCxHQWpDRCxDQTlGVyxDQWlJWDs7O0FBQ0EsTUFBTWhCLG1CQUFtQixHQUFHLFNBQXRCQSxtQkFBc0IsR0FBTTtBQUNoQyxRQUFJaUIsWUFBWSxHQUFHLEVBQW5CO0FBQ0FwRCxJQUFBQSxRQUFRLENBQUNJLGdCQUFULENBQTBCLGFBQTFCLEVBQXlDc0IsT0FBekMsQ0FBaUQsVUFBQ0MsQ0FBRCxFQUFJVSxDQUFKLEVBQVU7QUFBQTs7QUFDekRWLE1BQUFBLENBQUMsQ0FBQzFCLGFBQUYsQ0FBZ0Isa0JBQWhCLEVBQW9DUSxJQUFwQyxxQkFBc0Q0QixDQUF0RDtBQUNBVixNQUFBQSxDQUFDLENBQUMxQixhQUFGLENBQWdCLGNBQWhCLEVBQWdDUSxJQUFoQyxpQkFBOEM0QixDQUE5QztBQUNBVixNQUFBQSxDQUFDLENBQUMxQixhQUFGLENBQWdCLGVBQWhCLEVBQWlDUSxJQUFqQyxrQkFBZ0Q0QixDQUFoRDtBQUNBVixNQUFBQSxDQUFDLENBQUMxQixhQUFGLENBQWdCLGVBQWhCLEVBQWlDUSxJQUFqQyxrQkFBZ0Q0QixDQUFoRDtBQUNBVixNQUFBQSxDQUFDLENBQUMxQixhQUFGLENBQWdCLGNBQWhCLEVBQWdDUSxJQUFoQyxpQkFBOEM0QixDQUE5QztBQUVBZSxNQUFBQSxZQUFZLG1DQUNQQSxZQURPLDJFQUVGZixDQUZFLEdBRUk7QUFDWjlCLFFBQUFBLFFBQVEsRUFBRTtBQUNSQyxVQUFBQSxPQUFPLEVBQUU7QUFERDtBQURFLE9BRkosa0RBT0Q2QixDQVBDLEdBT0s7QUFDYjlCLFFBQUFBLFFBQVEsRUFBRTtBQUNSQyxVQUFBQSxPQUFPLEVBQUU7QUFERDtBQURHLE9BUEwsbUJBQVo7QUFhRCxLQXBCRDtBQXFCQU0sSUFBQUEsV0FBVyxtQ0FDTlQsWUFETSxHQUVOK0MsWUFGTSxDQUFYO0FBSUQsR0EzQkQ7O0FBNkJBLE1BQU1DLGNBQWMsR0FBRyxTQUFqQkEsY0FBaUIsQ0FBQ0MsU0FBRCxFQUFlO0FBQ3BDQSxJQUFBQSxTQUFTLENBQUNDLFNBQVYsQ0FBb0JyQixNQUFwQixDQUEyQixZQUEzQjtBQUNBb0IsSUFBQUEsU0FBUyxDQUFDRSxVQUFWLENBQXFCcEQsZ0JBQXJCLENBQXNDLG1CQUF0QyxFQUEyRHNCLE9BQTNELENBQW1FLFVBQUMrQixFQUFELEVBQVE7QUFDekVBLE1BQUFBLEVBQUUsQ0FBQ3ZCLE1BQUg7QUFDRCxLQUZEO0FBR0QsR0FMRDs7QUFPQSxNQUFNd0IsUUFBUSxHQUFHLFNBQVhBLFFBQVcsQ0FBQ0osU0FBRCxFQUFZSyxLQUFaLEVBQXNCO0FBQ3JDLFFBQU1DLEtBQUssR0FBRzVELFFBQVEsQ0FBQzZELGFBQVQsQ0FBdUIsS0FBdkIsQ0FBZDtBQUNBRCxJQUFBQSxLQUFLLENBQUNMLFNBQU4sQ0FBZ0JPLEdBQWhCLENBQW9CLGtCQUFwQjtBQUNBRixJQUFBQSxLQUFLLENBQUNHLFNBQU4sR0FBa0JKLEtBQWxCO0FBQ0FMLElBQUFBLFNBQVMsQ0FBQ0UsVUFBVixDQUFxQlEsV0FBckIsQ0FBaUNKLEtBQWpDO0FBQ0QsR0FMRDs7QUFPQSxNQUFNbkIsa0JBQWtCLEdBQUcsU0FBckJBLGtCQUFxQixDQUFDd0IsS0FBRCxFQUFRMUIsTUFBUixFQUFtQjtBQUM1Q2MsSUFBQUEsY0FBYyxDQUFDWSxLQUFELENBQWQ7O0FBQ0EsUUFBSTFCLE1BQUosRUFBWTtBQUNWMEIsTUFBQUEsS0FBSyxDQUFDVixTQUFOLENBQWdCTyxHQUFoQixDQUFvQixZQUFwQjtBQUVBdkIsTUFBQUEsTUFBTSxDQUFDYixPQUFQLENBQWUsVUFBQ3dDLEdBQUQsRUFBUztBQUN0QlIsUUFBQUEsUUFBUSxDQUFDTyxLQUFELEVBQVFDLEdBQVIsQ0FBUjtBQUNELE9BRkQ7QUFHRDtBQUNGLEdBVEQ7O0FBV0EsTUFBTUMsVUFBVSxHQUFHLFNBQWJBLFVBQWEsQ0FBQ0MsSUFBRCxFQUFPN0IsTUFBUCxFQUFrQjtBQUNuQzZCLElBQUFBLElBQUksQ0FBQ2hFLGdCQUFMLENBQXNCLDJCQUF0QixFQUFtRHNCLE9BQW5ELENBQTJELFVBQUN1QyxLQUFELEVBQVc7QUFDcEV4QixNQUFBQSxrQkFBa0IsQ0FBQ3dCLEtBQUQsRUFBUTFCLE1BQU0sSUFBSUEsTUFBTSxDQUFDMEIsS0FBSyxDQUFDeEQsSUFBUCxDQUF4QixDQUFsQjtBQUNELEtBRkQ7QUFHRCxHQUpEOztBQU1BLE1BQU00RCxnQkFBZ0IsR0FBRyxTQUFuQkEsZ0JBQW1CLENBQUNELElBQUQsRUFBVTtBQUNqQyxRQUFNN0IsTUFBTSxHQUFHQyxRQUFRLENBQUM0QixJQUFELEVBQU90RCxXQUFQLENBQXZCOztBQUNBLFFBQUksQ0FBQ3lCLE1BQUwsRUFBYTtBQUNYLGFBQU8sSUFBUDtBQUNEOztBQUNENEIsSUFBQUEsVUFBVSxDQUFDQyxJQUFELEVBQU83QixNQUFNLElBQUksRUFBakIsQ0FBVjtBQUNBLFdBQU8sS0FBUDtBQUNELEdBUEQ7O0FBU0EsTUFBTStCLFFBQVEsR0FBRyxTQUFYQSxRQUFXLEdBQVk7QUFDM0IsUUFBTTNCLElBQUksR0FBRztBQUNYckMsTUFBQUEsT0FBTyxFQUFFTixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsZ0JBQXZCLEVBQXlDb0IsS0FEdkM7QUFFWFosTUFBQUEsSUFBSSxFQUFFVCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsYUFBdkIsRUFBc0NvQixLQUZqQztBQUdYVixNQUFBQSxLQUFLLEVBQUVYLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixjQUF2QixFQUF1Q29CLEtBSG5DO0FBSVhYLE1BQUFBLEtBQUssRUFBRVYsUUFBUSxDQUFDQyxhQUFULENBQXVCLGNBQXZCLEVBQXVDb0IsS0FKbkM7QUFLWGtELE1BQUFBLFdBQVcsRUFBRXZFLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixvQkFBdkIsRUFBNkNvQixLQUwvQztBQU1YNkIsTUFBQUEsS0FBSyxFQUFFO0FBTkksS0FBYjtBQVNBbEQsSUFBQUEsUUFBUSxDQUFDSSxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBSTZDLEtBQUosRUFBYztBQUM3RDdCLE1BQUFBLElBQUksQ0FBQ08sS0FBTCxDQUFXdUIsSUFBWCxDQUFnQjtBQUNkNUIsUUFBQUEsUUFBUSxFQUFFbEIsQ0FBQyxDQUFDMUIsYUFBRixvQkFBbUNvQixLQUQvQjtBQUVkeUIsUUFBQUEsSUFBSSxFQUFFbkIsQ0FBQyxDQUFDMUIsYUFBRixnQkFBK0JvQixLQUZ2QjtBQUdkRCxRQUFBQSxLQUFLLEVBQUVPLENBQUMsQ0FBQzFCLGFBQUYsaUJBQWdDb0IsS0FIekI7QUFJZEMsUUFBQUEsS0FBSyxFQUFFSyxDQUFDLENBQUMxQixhQUFGLGlCQUFnQ29CLEtBSnpCO0FBS2QwQixRQUFBQSxJQUFJLEVBQUVwQixDQUFDLENBQUMxQixhQUFGLGdCQUErQm9CLEtBTHZCO0FBTWQyQixRQUFBQSxNQUFNLEVBQUVyQixDQUFDLENBQUMxQixhQUFGLG1CQUFrQ29CO0FBTjVCLE9BQWhCO0FBUUQsS0FURDtBQVdBLFdBQU9zQixJQUFQO0FBQ0QsR0F0QkQsQ0F2TVcsQ0ErTlg7OztBQUNBM0MsRUFBQUEsUUFBUSxDQUFDSSxnQkFBVCxDQUEwQixhQUExQixFQUF5Q3NCLE9BQXpDLENBQWlELFVBQUNDLENBQUQsRUFBTztBQUN0RFMsSUFBQUEsYUFBYSxDQUFDVCxDQUFELENBQWI7QUFDQVEsSUFBQUEsbUJBQW1CO0FBQ3BCLEdBSEQ7QUFLQWhDLEVBQUFBLE9BQU8sQ0FBQ3VCLE9BQVIsQ0FBZ0IsVUFBQ0MsQ0FBRCxFQUFJVSxDQUFKLEVBQVU7QUFDeEJWLElBQUFBLENBQUMsQ0FBQ0csZ0JBQUYsQ0FBbUIsUUFBbkIsRUFBNkIsVUFBQ1EsRUFBRCxFQUFRO0FBQ25DLFVBQU1DLE1BQU0sR0FBR0MsUUFBUSxDQUFDdEMsS0FBRCxFQUFRWSxXQUFSLENBQVIsSUFBZ0MsRUFBL0M7QUFDQTJCLE1BQUFBLGtCQUFrQixDQUFDZCxDQUFELEVBQUlZLE1BQU0sQ0FBQ1osQ0FBQyxDQUFDbEIsSUFBSCxDQUFWLENBQWxCO0FBQ0QsS0FIRDtBQUlELEdBTEQsRUFyT1csQ0E0T1g7O0FBQ0FULEVBQUFBLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixVQUF2QixFQUFtQzZCLGdCQUFuQyxDQUFvRCxPQUFwRCxFQUE2RCxVQUFVSCxDQUFWLEVBQWE7QUFDeEVBLElBQUFBLENBQUMsQ0FBQ0ksY0FBRjtBQUNBLFFBQU1aLEdBQUcsR0FBR25CLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixhQUF2QixDQUFaO0FBQ0EsUUFBTXlFLE1BQU0sR0FBR3ZELEdBQUcsQ0FBQ3dELFNBQUosQ0FBYyxJQUFkLENBQWY7QUFDQUQsSUFBQUEsTUFBTSxDQUFDdEUsZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUNzQixPQUFqQyxDQUF5QyxVQUFDQyxDQUFELEVBQU87QUFDOUNBLE1BQUFBLENBQUMsQ0FBQ04sS0FBRixHQUFVTSxDQUFDLENBQUNpRCxZQUFaO0FBQ0FqRCxNQUFBQSxDQUFDLENBQUM0QixTQUFGLENBQVlyQixNQUFaLENBQW1CLFlBQW5CO0FBQ0FQLE1BQUFBLENBQUMsQ0FBQzZCLFVBQUYsQ0FBYXBELGdCQUFiLENBQThCLG1CQUE5QixFQUFtRHNCLE9BQW5ELENBQTJELFVBQUMrQixFQUFELEVBQVE7QUFDakVBLFFBQUFBLEVBQUUsQ0FBQ3ZCLE1BQUg7QUFDRCxPQUZEO0FBR0QsS0FORDtBQVFBbEMsSUFBQUEsUUFBUSxDQUFDQyxhQUFULENBQXVCLGNBQXZCLEVBQXVDNEUsTUFBdkMsQ0FBOENILE1BQTlDO0FBQ0F0QyxJQUFBQSxhQUFhLENBQUNzQyxNQUFELENBQWI7QUFDQXZDLElBQUFBLG1CQUFtQjtBQUNwQixHQWZELEVBN09XLENBOFBYOztBQUNBcEMsRUFBQUEsTUFBTSxDQUFDK0IsZ0JBQVAsQ0FBd0IsZUFBeEIsRUFBeUMsVUFBVUgsQ0FBVixFQUFhO0FBQ3BELFFBQUksQ0FBQzBDLGdCQUFnQixDQUFDbkUsS0FBRCxDQUFyQixFQUE4QjtBQUM1QnlCLE1BQUFBLENBQUMsQ0FBQ0ksY0FBRjtBQUNBLFdBQUs5QixhQUFMLENBQW1CLGNBQW5CLEVBQW1DMkIsV0FBbkMsR0FBaUQsRUFBakQ7QUFDQSxXQUFLM0IsYUFBTCxDQUFtQixhQUFuQixFQUFrQzJCLFdBQWxDLEdBQWdELEVBQWhEO0FBQ0QsS0FKRCxNQUlPO0FBQ0wsVUFBTWUsSUFBSSxHQUFHMkIsUUFBUSxFQUFyQjtBQUNBLFVBQU1RLFVBQVUsR0FBRzlFLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixjQUF2QixDQUFuQjtBQUNBLFVBQU04RSxTQUFTLEdBQUcvRSxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsYUFBdkIsQ0FBbEI7QUFDQTZFLE1BQUFBLFVBQVUsQ0FBQ0QsTUFBWCxDQUFrQmxDLElBQUksQ0FBQ3JDLE9BQUwsR0FBZSxNQUFqQztBQUNBeUUsTUFBQUEsU0FBUyxDQUFDQyxrQkFBVixDQUE2QixXQUE3QixFQUEwQy9CLFdBQVcsQ0FBQ04sSUFBRCxDQUFyRDtBQUNEO0FBQ0YsR0FaRDtBQWNBNUMsRUFBQUEsTUFBTSxDQUFDK0IsZ0JBQVAsQ0FBd0IsaUJBQXhCLEVBQTJDLFVBQVVILENBQVYsRUFBYTtBQUN0REEsSUFBQUEsQ0FBQyxDQUFDSSxjQUFGO0FBQ0EsU0FBSzlCLGFBQUwsQ0FBbUIsY0FBbkIsRUFBbUMyQixXQUFuQyxHQUFpRCxFQUFqRDtBQUNBLFNBQUszQixhQUFMLENBQW1CLGFBQW5CLEVBQWtDMkIsV0FBbEMsR0FBZ0QsRUFBaEQ7QUFDRCxHQUpELEVBN1FXLENBbVJYOztBQUNBLE1BQU1xRCxXQUFXLEdBQUcsU0FBZEEsV0FBYyxDQUFDQyxLQUFELEVBQVc7QUFDN0IsUUFBTUMsU0FBUyxHQUFHRCxLQUFLLENBQUNFLFNBQXhCO0FBQ0EsUUFBTUMsU0FBUyxHQUFHQyxNQUFNLENBQUNDLElBQVAsQ0FBWSxFQUFaLEVBQWdCLGFBQWhCLEVBQStCLEVBQS9CLENBQWxCO0FBQ0FGLElBQUFBLFNBQVMsQ0FBQ3JGLFFBQVYsQ0FBbUJ1RixJQUFuQjtBQUNBRixJQUFBQSxTQUFTLENBQUNyRixRQUFWLENBQW1Cd0YsS0FBbkI7QUFXQUgsSUFBQUEsU0FBUyxDQUFDckYsUUFBVixDQUFtQndGLEtBQW5CLENBQXlCTCxTQUF6QjtBQUNBRSxJQUFBQSxTQUFTLENBQUNyRixRQUFWLENBQW1CeUYsS0FBbkIsQ0FBeUIsZ0JBQXpCO0FBQ0QsR0FqQkQ7O0FBbUJBekYsRUFBQUEsUUFBUSxDQUFDQyxhQUFULENBQXVCLFFBQXZCLEVBQWlDNkIsZ0JBQWpDLENBQWtELE9BQWxELEVBQTJELFlBQVk7QUFDckUsUUFBTTRELEdBQUcsR0FBRyxJQUFJQyxJQUFKLEdBQVdDLGtCQUFYLEVBQVo7QUFDQSxRQUFNQyxTQUFTLEdBQUc3RixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsOEJBQXZCLENBQWxCO0FBRUEsUUFBTTZGLFlBQVksR0FBR0QsU0FBUyxDQUFDbEIsU0FBVixDQUFvQixJQUFwQixDQUFyQjtBQUNBbUIsSUFBQUEsWUFBWSxDQUFDN0YsYUFBYixDQUEyQixlQUEzQixFQUE0Q2lDLE1BQTVDO0FBQ0E0RCxJQUFBQSxZQUFZLENBQUNkLGtCQUFiLENBQ0UsV0FERiwwRUFFd0NVLEdBRnhDO0FBS0FULElBQUFBLFdBQVcsQ0FBQ2EsWUFBRCxDQUFYO0FBQ0QsR0FaRDtBQWFELENBcFREIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uICgpIHtcclxuICBjb25zdCAkbW9kYWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbW9kYWwnKTtcclxuICBjb25zdCAkZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Zvcm0jZm9ybScpO1xyXG4gIGNvbnN0ICRpbnB1dHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpO1xyXG5cclxuICAvLyB2YWxpZGF0ZVxyXG4gIGNvbnN0IG1haW5WYWxpZGF0ZSA9IHtcclxuICAgIGNvbXBhbnk6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpealreS4u+WQjeeosScsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgbmFtZToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl5aCx5YO55Lq65ZOhJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBlbWFpbDoge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWlIEUtTWFpbCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVtYWlsOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ+agvOW8j+mMr+iqpCcsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcGhvbmU6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpeiBr+e1oembu+ipsScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGZvcm1hdDoge1xyXG4gICAgICAgIHBhdHRlcm46ICdeMDlbMC05XXs4fSQnLFxyXG4gICAgICAgIG1lc3NhZ2U6ICde5omL5qmf5qC85byP6Yyv6KqkJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxuICBsZXQgY29uc3RyYWludHMgPSB7fTtcclxuXHJcbiAgY29uc3Qgc2V0TnVtRm9ybWF0ID0gKG51bSkgPT4ge1xyXG4gICAgbnVtID0gbnVtICsgJyc7XHJcbiAgICByZXR1cm4gbnVtLnJlcGxhY2UoL1xcQig/PSg/OlxcZHszfSkrKD8hXFxkKSkvZywgJywnKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzZXRBbW91bnQgPSAocm93KSA9PiB7XHJcbiAgICBjb25zdCBwcmljZSA9IHJvdy5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9cHJpY2VdYCkudmFsdWUgfHwgMDtcclxuICAgIGNvbnN0IGNvdW50ID0gcm93LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudF1gKS52YWx1ZSB8fCAxO1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWFtb3VudF0nKS52YWx1ZSA9IHByaWNlICogY291bnQ7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2V0VG90YWwgPSAoKSA9PiB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tuYW1lPWFtb3VudF0nKTtcclxuICAgIGxldCBnZXRUb3RhbCA9IDA7XHJcbiAgICB0b3RhbC5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICAgIGdldFRvdGFsICs9ICtlLnZhbHVlO1xyXG4gICAgfSk7XHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdG90YWwtcHJpY2UnKS50ZXh0Q29udGVudCA9IHNldE51bUZvcm1hdChnZXRUb3RhbCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZGVsSXRlbSA9IChyb3cpID0+IHtcclxuICAgIHJvdy5xdWVyeVNlbGVjdG9yKCcuZGVsSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBpZiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICAgICAgc2V0VG90YWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRJdGVtRm9ybVZhbGlkYXRlKCk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVJdGVtUm93ID0gKHJvdykgPT4ge1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgICBlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChldikgPT4ge1xyXG4gICAgICAgIHNldEFtb3VudChyb3cpO1xyXG4gICAgICAgIHNldFRvdGFsKCk7XHJcbiAgICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgICBzaG93RXJyb3JzRm9ySW5wdXQoZSwgZXJyb3JzW2UubmFtZV0pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgZGVsSXRlbShyb3cpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGNyZWF0ZUl0ZW0gPSAoZGF0YSkgPT4ge1xyXG4gICAgcmV0dXJuIGRhdGEubWFwKFxyXG4gICAgICAoZSkgPT5cclxuICAgICAgICBgXHJcbiAgICAgICAgPHRyPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwidGV4dC1sZWZ0XCI+JHtlLmNhdGVnb3J5fTwvdGQ+XHJcbiAgICAgICAgICA8dGQgY2xhc3M9XCJ0ZXh0LWxlZnRcIj4ke2UuaXRlbX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5wcmljZX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5jb3VudH0gJHshIWUudW5pdCA/ICcvJyA6ICcnfSAke2UudW5pdH08L3RkPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwicHJpY2VcIj4ke2UuYW1vdW50fTwvdGQ+XHJcbiAgICAgICAgPC90cj4gXHJcbiAgICAgIGBcclxuICAgICk7XHJcbiAgfTtcclxuICBjb25zdCBjcmVhdGVNb2RhbCA9IChkYXRhKSA9PiB7XHJcbiAgICByZXR1cm4gYFxyXG4gICAgICA8ZGl2IGNsYXNzPVwidGFibGUtcmVzcG9uc2l2ZVwiPlxyXG4gICAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLXZjZW50ZXJcIj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuWgseWDueS6uuWToTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEubmFtZX08L3RkPlxyXG4gICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuiBr+e1oembu+ipsTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEucGhvbmV9PC90ZD5cclxuICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgIDx0aD5FLU1haWw8L3RoPlxyXG4gICAgICAgICAgICA8dGQ+JHtkYXRhLmVtYWlsfTwvdGQ+XHJcbiAgICAgICAgICA8L3RyPlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgPHRhYmxlIGNsYXNzPVwidGFibGUgdGFibGUtdmNlbnRlclwiPlxyXG4gICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgPHRoPumhnuWIpTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPumgheebrjwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuWWruWDuTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuaVuOmHjzwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPumHkemhjTwvdGg+XHJcbiAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAke2NyZWF0ZUl0ZW0oZGF0YS5pdGVtcykuam9pbignJyl9XHJcbiAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgYDtcclxuICB9O1xyXG5cclxuICAvLyBzZXQgdmFsaWRhdGVcclxuICBjb25zdCBzZXRJdGVtRm9ybVZhbGlkYXRlID0gKCkgPT4ge1xyXG4gICAgbGV0IGl0ZW1WYWxpZGF0ZSA9IHt9O1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlLCBpKSA9PiB7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPWNhdGVnb3J5XScpLm5hbWUgPSBgY2F0ZWdvcnkke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9aXRlbV0nKS5uYW1lID0gYGl0ZW0ke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9cHJpY2VdJykubmFtZSA9IGBwcmljZSR7aX1gO1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj1jb3VudF0nKS5uYW1lID0gYGNvdW50JHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPXVuaXRdJykubmFtZSA9IGB1bml0JHtpfWA7XHJcblxyXG4gICAgICBpdGVtVmFsaWRhdGUgPSB7XHJcbiAgICAgICAgLi4uaXRlbVZhbGlkYXRlLFxyXG4gICAgICAgIFtgaXRlbSR7aX1gXToge1xyXG4gICAgICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICAgICAgbWVzc2FnZTogJ17poIXnm67lkI3nqLHkuI3lvpfngrrnqbonLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIFtgcHJpY2Uke2l9YF06IHtcclxuICAgICAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICde5Zau5YO55ZCN56ix5LiN5b6X54K656m6JyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG4gICAgY29uc3RyYWludHMgPSB7XHJcbiAgICAgIC4uLm1haW5WYWxpZGF0ZSxcclxuICAgICAgLi4uaXRlbVZhbGlkYXRlLFxyXG4gICAgfTtcclxuICB9O1xyXG5cclxuICBjb25zdCByZXNldEZvcm1JbnB1dCA9IChmb3JtSW5wdXQpID0+IHtcclxuICAgIGZvcm1JbnB1dC5jbGFzc0xpc3QucmVtb3ZlKCdpcy1pbnZhbGlkJyk7XHJcbiAgICBmb3JtSW5wdXQucGFyZW50Tm9kZS5xdWVyeVNlbGVjdG9yQWxsKCcuaW52YWxpZC1mZWVkYmFjaycpLmZvckVhY2goKGVsKSA9PiB7XHJcbiAgICAgIGVsLnJlbW92ZSgpO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYWRkRXJyb3IgPSAoZm9ybUlucHV0LCBlcnJvcikgPT4ge1xyXG4gICAgY29uc3QgYmxvY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgIGJsb2NrLmNsYXNzTGlzdC5hZGQoJ2ludmFsaWQtZmVlZGJhY2snKTtcclxuICAgIGJsb2NrLmlubmVyVGV4dCA9IGVycm9yO1xyXG4gICAgZm9ybUlucHV0LnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQoYmxvY2spO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNob3dFcnJvcnNGb3JJbnB1dCA9IChpbnB1dCwgZXJyb3JzKSA9PiB7XHJcbiAgICByZXNldEZvcm1JbnB1dChpbnB1dCk7XHJcbiAgICBpZiAoZXJyb3JzKSB7XHJcbiAgICAgIGlucHV0LmNsYXNzTGlzdC5hZGQoJ2lzLWludmFsaWQnKTtcclxuXHJcbiAgICAgIGVycm9ycy5mb3JFYWNoKChlcnIpID0+IHtcclxuICAgICAgICBhZGRFcnJvcihpbnB1dCwgZXJyKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2hvd0Vycm9ycyA9IChmb3JtLCBlcnJvcnMpID0+IHtcclxuICAgIGZvcm0ucXVlcnlTZWxlY3RvckFsbCgnaW5wdXRbbmFtZV0sIHNlbGVjdFtuYW1lXScpLmZvckVhY2goKGlucHV0KSA9PiB7XHJcbiAgICAgIHNob3dFcnJvcnNGb3JJbnB1dChpbnB1dCwgZXJyb3JzICYmIGVycm9yc1tpbnB1dC5uYW1lXSk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVGb3JtU3VibWl0ID0gKGZvcm0pID0+IHtcclxuICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKGZvcm0sIGNvbnN0cmFpbnRzKTtcclxuICAgIGlmICghZXJyb3JzKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgc2hvd0Vycm9ycyhmb3JtLCBlcnJvcnMgfHwge30pO1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGZvcm1EYXRhID0gZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc3QgZGF0YSA9IHtcclxuICAgICAgY29tcGFueTogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9Y29tcGFueV0nKS52YWx1ZSxcclxuICAgICAgbmFtZTogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9bmFtZV0nKS52YWx1ZSxcclxuICAgICAgcGhvbmU6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPXBob25lXScpLnZhbHVlLFxyXG4gICAgICBlbWFpbDogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9ZW1haWxdJykudmFsdWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1kZXNjcmlwdGlvbl0nKS52YWx1ZSxcclxuICAgICAgaXRlbXM6IFtdLFxyXG4gICAgfTtcclxuXHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUsIGluZGV4KSA9PiB7XHJcbiAgICAgIGRhdGEuaXRlbXMucHVzaCh7XHJcbiAgICAgICAgY2F0ZWdvcnk6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWNhdGVnb3J5YCkudmFsdWUsXHJcbiAgICAgICAgaXRlbTogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9aXRlbWApLnZhbHVlLFxyXG4gICAgICAgIHByaWNlOiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1wcmljZWApLnZhbHVlLFxyXG4gICAgICAgIGNvdW50OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudGApLnZhbHVlLFxyXG4gICAgICAgIHVuaXQ6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPXVuaXRgKS52YWx1ZSxcclxuICAgICAgICBhbW91bnQ6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWFtb3VudF1gKS52YWx1ZSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gZGF0YTtcclxuICB9O1xyXG5cclxuICAvLyBkb2N1bWVudCBpbml0ID09PT09PT09PT09PT09XHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICB1cGRhdGVJdGVtUm93KGUpO1xyXG4gICAgc2V0SXRlbUZvcm1WYWxpZGF0ZSgpO1xyXG4gIH0pO1xyXG5cclxuICAkaW5wdXRzLmZvckVhY2goKGUsIGkpID0+IHtcclxuICAgIGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2KSA9PiB7XHJcbiAgICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKCRmb3JtLCBjb25zdHJhaW50cykgfHwge307XHJcbiAgICAgIHNob3dFcnJvcnNGb3JJbnB1dChlLCBlcnJvcnNbZS5uYW1lXSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgLy8gYWRkIGl0ZW0gcm93XHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FkZEl0ZW0nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBjb25zdCByb3cgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pdGVtXScpO1xyXG4gICAgY29uc3QgbmV3Um93ID0gcm93LmNsb25lTm9kZSh0cnVlKTtcclxuICAgIG5ld1Jvdy5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dCcpLmZvckVhY2goKGUpID0+IHtcclxuICAgICAgZS52YWx1ZSA9IGUuZGVmYXVsdFZhbHVlO1xyXG4gICAgICBlLmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcclxuICAgICAgZS5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbnZhbGlkLWZlZWRiYWNrJykuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgICBlbC5yZW1vdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pdGVtc10nKS5hcHBlbmQobmV3Um93KTtcclxuICAgIHVwZGF0ZUl0ZW1Sb3cobmV3Um93KTtcclxuICAgIHNldEl0ZW1Gb3JtVmFsaWRhdGUoKTtcclxuICB9KTtcclxuXHJcbiAgLy8gb24gU3VibWl0XHJcbiAgJG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ3Nob3cuYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgaWYgKCFoYW5kbGVGb3JtU3VibWl0KCRmb3JtKSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSAnJztcclxuICAgICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBkYXRhID0gZm9ybURhdGEoKTtcclxuICAgICAgY29uc3QgbW9kYWxUaXRsZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC10aXRsZScpO1xyXG4gICAgICBjb25zdCBtb2RhbEJvZHkgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpO1xyXG4gICAgICBtb2RhbFRpdGxlLmFwcGVuZChkYXRhLmNvbXBhbnkgKyAnLeWgseWDueWWricpO1xyXG4gICAgICBtb2RhbEJvZHkuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCBjcmVhdGVNb2RhbChkYXRhKSk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gICRtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdoaWRkZW4uYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gICAgdGhpcy5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYm9keScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgfSk7XHJcblxyXG4gIC8vIFByaW50ID09PT09PT09PT09PT09XHJcbiAgY29uc3QgcHJpbnRTY3JlZW4gPSAocHJpbnQpID0+IHtcclxuICAgIGNvbnN0IHByaW50QXJlYSA9IHByaW50LmlubmVySFRNTDtcclxuICAgIGNvbnN0IHByaW50UGFnZSA9IHdpbmRvdy5vcGVuKCcnLCAnUHJpbnRpbmcuLi4nLCAnJyk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQub3BlbigpO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LndyaXRlKFxyXG4gICAgICBgPGh0bWw+XHJcbiAgICAgICAgPGhlYWQ+XHJcbiAgICAgICAgPG1ldGEgY2hhcnNldD1cIlVURi04XCIgLz5cclxuICAgICAgICA8bWV0YSBodHRwLWVxdWl2PVwiWC1VQS1Db21wYXRpYmxlXCIgY29udGVudD1cIklFPWVkZ2VcIiAvPlxyXG4gICAgICAgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wXCIgLz5cclxuICAgICAgICAgIDx0aXRsZT7loLHlg7nllq7nlKLnlJ/lmag8L3RpdGxlPlxyXG4gICAgICAgICAgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCJodHRwczovL3VucGtnLmNvbS9AdGFibGVyL2NvcmVAbGF0ZXN0L2Rpc3QvY3NzL3RhYmxlci5taW4uY3NzXCIvPlxyXG4gICAgICAgIDwvaGVhZD5cclxuICAgICAgICA8Ym9keSBvbmxvYWQ9J3dpbmRvdy5wcmludCgpO3dpbmRvdy5jbG9zZSgpJz5gXHJcbiAgICApO1xyXG4gICAgcHJpbnRQYWdlLmRvY3VtZW50LndyaXRlKHByaW50QXJlYSk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQuY2xvc2UoJzwvYm9keT48L2h0bWw+Jyk7XHJcbiAgfTtcclxuXHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3ByaW50JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlRGF0ZVN0cmluZygpO1xyXG4gICAgY29uc3QgcHJpbnRIdG1sID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1vZGFsLWRpYWxvZyAubW9kYWwtY29udGVudCcpO1xyXG5cclxuICAgIGNvbnN0IG5ld1ByaW50SHRtbCA9IHByaW50SHRtbC5jbG9uZU5vZGUodHJ1ZSk7XHJcbiAgICBuZXdQcmludEh0bWwucXVlcnlTZWxlY3RvcignLm1vZGFsLWZvb3RlcicpLnJlbW92ZSgpO1xyXG4gICAgbmV3UHJpbnRIdG1sLmluc2VydEFkamFjZW50SFRNTChcclxuICAgICAgJ2JlZm9yZWVuZCcsXHJcbiAgICAgIGA8cCBzdHlsZT1cInRleHQtYWxpZ246IHJpZ2h0O1wiPuWgseWDueaZgumWk++8miR7bm93fTwvcD5gXHJcbiAgICApO1xyXG5cclxuICAgIHByaW50U2NyZWVuKG5ld1ByaW50SHRtbCk7XHJcbiAgfSk7XHJcbn0pKCk7XHJcbiJdLCJmaWxlIjoibWFpbi5qcyJ9
