"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {
  var $modal = document.querySelector('#modal');
  var $form = document.querySelector('form#form');
  var $inputs = document.querySelectorAll('input, textarea, select');

  var setNumFormat = function setNumFormat(num) {
    num = num + '';
    return num.replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
  };

  var setAmount = function setAmount(item, index) {
    var price = item.querySelector("[name=price".concat(index, "]")).value || 0;
    var count = item.querySelector("[name=count".concat(index, "]")).value || 1;
    item.querySelector('[name=amount]').value = price * count;
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
      if (document.querySelectorAll('[data-item]').length > 2) {
        this.parentElement.parentElement.remove();
        setTotal();
      }
    });
  };

  var updateItemRow = function updateItemRow(row, index) {
    var _objectSpread2;

    row.querySelector('[name=category]').name = "category".concat(index);
    row.querySelector('[name=item]').name = "item".concat(index);
    row.querySelector('[name=price]').name = "price".concat(index);
    row.querySelector('[name=count]').name = "count".concat(index);
    row.querySelector('[name=unit]').name = "unit".concat(index);
    constraints = _objectSpread(_objectSpread({}, constraints), {}, (_objectSpread2 = {}, _defineProperty(_objectSpread2, "item".concat(index), {
      presence: {
        message: '^項目名稱不得為空'
      }
    }), _defineProperty(_objectSpread2, "price".concat(index), {
      presence: {
        message: '^單價名稱不得為空'
      }
    }), _objectSpread2));
    row.querySelector("[name=item".concat(index, "]")).addEventListener('change', function () {
      var errors = validate($form, constraints) || {};
      showErrorsForInput(this, errors[this.name]);
    });
    row.querySelector("[name=price".concat(index, "]")).addEventListener('change', function () {
      setAmount(row, index);
      setTotal();
      var errors = validate($form, constraints) || {};
      showErrorsForInput(this, errors[this.name]);
    });
    row.querySelector("[name=count".concat(index, "]")).addEventListener('change', function () {
      setAmount(row, index);
      setTotal();
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
  }; // validate form


  var constraints = {
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
    },
    item: {
      presence: {
        message: '^項目名稱不得為空'
      }
    },
    price: {
      presence: {
        message: '^單價名稱不得為空'
      }
    }
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

  var handleFormSubmit = function handleFormSubmit(form, input) {
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
    document.querySelectorAll('[data-item]').forEach(function (element, index) {
      if (index === 0) {
        return;
      }

      if (index === 1) {
        data.items.push({
          category: element.querySelector("[name=category").value,
          item: element.querySelector("[name=item").value,
          price: element.querySelector("[name=price").value,
          count: element.querySelector("[name=count").value,
          unit: element.querySelector("[name=unit").value,
          amount: element.querySelector("[name=amount]").value
        });
      } else {
        data.items.push({
          category: element.querySelector("[name=category".concat(index - 1, "]")).value,
          item: element.querySelector("[name=item".concat(index - 1, "]")).value,
          price: element.querySelector("[name=price".concat(index - 1, "]")).value,
          count: element.querySelector("[name=count".concat(index - 1, "]")).value,
          unit: element.querySelector("[name=unit".concat(index - 1, "]")).value,
          amount: element.querySelector("[name=amount]").value
        });
      }
    });
    return data;
  }; // document init ==============


  $inputs.forEach(function (e, i) {
    e.addEventListener('change', function (ev) {
      var errors = validate($form, constraints) || {};
      showErrorsForInput(e, errors[e.name]);
    });
  });
  document.querySelectorAll('[data-item]').forEach(function (e) {
    updateItemRow(e, '');
  }); // add item row

  document.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    var row = document.querySelector('[data-item]');
    var newRow = row.cloneNode(true);
    var itemLength = document.querySelectorAll('[data-item]').length - 1;
    newRow.style.display = 'flex';
    document.querySelector('[data-items]').append(newRow);
    updateItemRow(newRow, itemLength);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiXSwibmFtZXMiOlsiJG1vZGFsIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiJGZvcm0iLCIkaW5wdXRzIiwicXVlcnlTZWxlY3RvckFsbCIsInNldE51bUZvcm1hdCIsIm51bSIsInJlcGxhY2UiLCJzZXRBbW91bnQiLCJpdGVtIiwiaW5kZXgiLCJwcmljZSIsInZhbHVlIiwiY291bnQiLCJzZXRUb3RhbCIsInRvdGFsIiwiZ2V0VG90YWwiLCJmb3JFYWNoIiwiZSIsInRleHRDb250ZW50IiwiZGVsSXRlbSIsInJvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJsZW5ndGgiLCJwYXJlbnRFbGVtZW50IiwicmVtb3ZlIiwidXBkYXRlSXRlbVJvdyIsIm5hbWUiLCJjb25zdHJhaW50cyIsInByZXNlbmNlIiwibWVzc2FnZSIsImVycm9ycyIsInZhbGlkYXRlIiwic2hvd0Vycm9yc0ZvcklucHV0IiwiY3JlYXRlSXRlbSIsImRhdGEiLCJtYXAiLCJjYXRlZ29yeSIsInVuaXQiLCJhbW91bnQiLCJjcmVhdGVNb2RhbCIsInBob25lIiwiZW1haWwiLCJpdGVtcyIsImpvaW4iLCJjb21wYW55IiwiZm9ybWF0IiwicGF0dGVybiIsInJlc2V0Rm9ybUlucHV0IiwiZm9ybUlucHV0IiwiY2xhc3NMaXN0IiwicGFyZW50Tm9kZSIsImVsIiwiYWRkRXJyb3IiLCJlcnJvciIsImJsb2NrIiwiY3JlYXRlRWxlbWVudCIsImFkZCIsImlubmVyVGV4dCIsImFwcGVuZENoaWxkIiwiaW5wdXQiLCJlcnIiLCJzaG93RXJyb3JzIiwiZm9ybSIsImhhbmRsZUZvcm1TdWJtaXQiLCJmb3JtRGF0YSIsImRlc2NyaXB0aW9uIiwiZWxlbWVudCIsInB1c2giLCJpIiwiZXYiLCJwcmV2ZW50RGVmYXVsdCIsIm5ld1JvdyIsImNsb25lTm9kZSIsIml0ZW1MZW5ndGgiLCJzdHlsZSIsImRpc3BsYXkiLCJhcHBlbmQiLCJtb2RhbFRpdGxlIiwibW9kYWxCb2R5IiwiaW5zZXJ0QWRqYWNlbnRIVE1MIiwicHJpbnRTY3JlZW4iLCJwcmludCIsInByaW50QXJlYSIsImlubmVySFRNTCIsInByaW50UGFnZSIsIndpbmRvdyIsIm9wZW4iLCJ3cml0ZSIsImNsb3NlIiwibm93IiwiRGF0ZSIsInRvTG9jYWxlRGF0ZVN0cmluZyIsInByaW50SHRtbCIsIm5ld1ByaW50SHRtbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxDQUFDLFlBQVk7QUFDWCxNQUFNQSxNQUFNLEdBQUdDLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QixRQUF2QixDQUFmO0FBQ0EsTUFBTUMsS0FBSyxHQUFHRixRQUFRLENBQUNDLGFBQVQsQ0FBdUIsV0FBdkIsQ0FBZDtBQUNBLE1BQU1FLE9BQU8sR0FBR0gsUUFBUSxDQUFDSSxnQkFBVCxDQUEwQix5QkFBMUIsQ0FBaEI7O0FBRUEsTUFBTUMsWUFBWSxHQUFHLFNBQWZBLFlBQWUsQ0FBQ0MsR0FBRCxFQUFTO0FBQzVCQSxJQUFBQSxHQUFHLEdBQUdBLEdBQUcsR0FBRyxFQUFaO0FBQ0EsV0FBT0EsR0FBRyxDQUFDQyxPQUFKLENBQVkseUJBQVosRUFBdUMsR0FBdkMsQ0FBUDtBQUNELEdBSEQ7O0FBS0EsTUFBTUMsU0FBUyxHQUFHLFNBQVpBLFNBQVksQ0FBQ0MsSUFBRCxFQUFPQyxLQUFQLEVBQWlCO0FBQ2pDLFFBQU1DLEtBQUssR0FBR0YsSUFBSSxDQUFDUixhQUFMLHNCQUFpQ1MsS0FBakMsUUFBMkNFLEtBQTNDLElBQW9ELENBQWxFO0FBQ0EsUUFBTUMsS0FBSyxHQUFHSixJQUFJLENBQUNSLGFBQUwsc0JBQWlDUyxLQUFqQyxRQUEyQ0UsS0FBM0MsSUFBb0QsQ0FBbEU7QUFDQUgsSUFBQUEsSUFBSSxDQUFDUixhQUFMLENBQW1CLGVBQW5CLEVBQW9DVyxLQUFwQyxHQUE0Q0QsS0FBSyxHQUFHRSxLQUFwRDtBQUNELEdBSkQ7O0FBS0EsTUFBTUMsUUFBUSxHQUFHLFNBQVhBLFFBQVcsR0FBTTtBQUNyQixRQUFNQyxLQUFLLEdBQUdmLFFBQVEsQ0FBQ0ksZ0JB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RixFQUFBQSxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsRUFBaUNxQixnQkFBakMsQ0FBa0QsT0FBbEQsRUFBMkQsWUFBWTtBQUNyRSxRQUFNb0UsR0FBRyxHQUFHLElBQUlDLElBQUosR0FBV0Msa0JBQVgsRUFBWjtBQUNBLFFBQU1DLFNBQVMsR0FBRzdGLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1Qiw4QkFBdkIsQ0FBbEI7QUFFQSxRQUFNNkYsWUFBWSxHQUFHRCxTQUFTLENBQUNwQixTQUFWLENBQW9CLElBQXBCLENBQXJCO0FBQ0FxQixJQUFBQSxZQUFZLENBQUM3RixhQUFiLENBQTJCLGVBQTNCLEVBQTRDd0IsTUFBNUM7QUFDQXFFLElBQUFBLFlBQVksQ0FBQ2Qsa0JBQWIsQ0FDRSxXQURGLDBFQUV3Q1UsR0FGeEM7QUFLQVQsSUFBQUEsV0FBVyxDQUFDYSxZQUFELENBQVg7QUFDRCxHQVpEO0FBYUQsQ0F4VUQiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKCkge1xyXG4gIGNvbnN0ICRtb2RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2RhbCcpO1xyXG4gIGNvbnN0ICRmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZm9ybSNmb3JtJyk7XHJcbiAgY29uc3QgJGlucHV0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0Jyk7XHJcblxyXG4gIGNvbnN0IHNldE51bUZvcm1hdCA9IChudW0pID0+IHtcclxuICAgIG51bSA9IG51bSArICcnO1xyXG4gICAgcmV0dXJuIG51bS5yZXBsYWNlKC9cXEIoPz0oPzpcXGR7M30pKyg/IVxcZCkpL2csICcsJyk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2V0QW1vdW50ID0gKGl0ZW0sIGluZGV4KSA9PiB7XHJcbiAgICBjb25zdCBwcmljZSA9IGl0ZW0ucXVlcnlTZWxlY3RvcihgW25hbWU9cHJpY2Uke2luZGV4fV1gKS52YWx1ZSB8fCAwO1xyXG4gICAgY29uc3QgY291bnQgPSBpdGVtLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPWNvdW50JHtpbmRleH1dYCkudmFsdWUgfHwgMTtcclxuICAgIGl0ZW0ucXVlcnlTZWxlY3RvcignW25hbWU9YW1vdW50XScpLnZhbHVlID0gcHJpY2UgKiBjb3VudDtcclxuICB9O1xyXG4gIGNvbnN0IHNldFRvdGFsID0gKCkgPT4ge1xyXG4gICAgY29uc3QgdG90YWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbbmFtZT1hbW91bnRdJyk7XHJcbiAgICBsZXQgZ2V0VG90YWwgPSAwO1xyXG4gICAgdG90YWwuZm9yRWFjaCgoZSkgPT4ge1xyXG4gICAgICBnZXRUb3RhbCArPSArZS52YWx1ZTtcclxuICAgIH0pO1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RvdGFsLXByaWNlJykudGV4dENvbnRlbnQgPSBzZXROdW1Gb3JtYXQoZ2V0VG90YWwpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGRlbEl0ZW0gPSAocm93KSA9PiB7XHJcbiAgICByb3cucXVlcnlTZWxlY3RvcignLmRlbEl0ZW0nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgIGlmIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmxlbmd0aCA+IDIpIHtcclxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5yZW1vdmUoKTtcclxuICAgICAgICBzZXRUb3RhbCgpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVJdGVtUm93ID0gKHJvdywgaW5kZXgpID0+IHtcclxuICAgIHJvdy5xdWVyeVNlbGVjdG9yKCdbbmFtZT1jYXRlZ29yeV0nKS5uYW1lID0gYGNhdGVnb3J5JHtpbmRleH1gO1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWl0ZW1dJykubmFtZSA9IGBpdGVtJHtpbmRleH1gO1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPXByaWNlXScpLm5hbWUgPSBgcHJpY2Uke2luZGV4fWA7XHJcbiAgICByb3cucXVlcnlTZWxlY3RvcignW25hbWU9Y291bnRdJykubmFtZSA9IGBjb3VudCR7aW5kZXh9YDtcclxuICAgIHJvdy5xdWVyeVNlbGVjdG9yKCdbbmFtZT11bml0XScpLm5hbWUgPSBgdW5pdCR7aW5kZXh9YDtcclxuXHJcbiAgICBjb25zdHJhaW50cyA9IHtcclxuICAgICAgLi4uY29uc3RyYWludHMsXHJcbiAgICAgIFtgaXRlbSR7aW5kZXh9YF06IHtcclxuICAgICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgICAgbWVzc2FnZTogJ17poIXnm67lkI3nqLHkuI3lvpfngrrnqbonLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIFtgcHJpY2Uke2luZGV4fWBdOiB7XHJcbiAgICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICAgIG1lc3NhZ2U6ICde5Zau5YO55ZCN56ix5LiN5b6X54K656m6JyxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfTtcclxuXHJcbiAgICByb3dcclxuICAgICAgLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPWl0ZW0ke2luZGV4fV1gKVxyXG4gICAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKCRmb3JtLCBjb25zdHJhaW50cykgfHwge307XHJcbiAgICAgICAgc2hvd0Vycm9yc0ZvcklucHV0KHRoaXMsIGVycm9yc1t0aGlzLm5hbWVdKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgcm93XHJcbiAgICAgIC5xdWVyeVNlbGVjdG9yKGBbbmFtZT1wcmljZSR7aW5kZXh9XWApXHJcbiAgICAgIC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgc2V0QW1vdW50KHJvdywgaW5kZXgpO1xyXG4gICAgICAgIHNldFRvdGFsKCk7XHJcbiAgICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgICBzaG93RXJyb3JzRm9ySW5wdXQodGhpcywgZXJyb3JzW3RoaXMubmFtZV0pO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICByb3dcclxuICAgICAgLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPWNvdW50JHtpbmRleH1dYClcclxuICAgICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBzZXRBbW91bnQocm93LCBpbmRleCk7XHJcbiAgICAgICAgc2V0VG90YWwoKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgZGVsSXRlbShyb3cpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGNyZWF0ZUl0ZW0gPSAoZGF0YSkgPT4ge1xyXG4gICAgcmV0dXJuIGRhdGEubWFwKFxyXG4gICAgICAoZSkgPT5cclxuICAgICAgICBgXHJcbiAgICAgICAgPHRyPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwidGV4dC1sZWZ0XCI+JHtlLmNhdGVnb3J5fTwvdGQ+XHJcbiAgICAgICAgICA8dGQgY2xhc3M9XCJ0ZXh0LWxlZnRcIj4ke2UuaXRlbX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5wcmljZX08L3RkPlxyXG4gICAgICAgICAgPHRkPiR7ZS5jb3VudH0gJHshIWUudW5pdCA/ICcvJyA6ICcnfSAke2UudW5pdH08L3RkPlxyXG4gICAgICAgICAgPHRkIGNsYXNzPVwicHJpY2VcIj4ke2UuYW1vdW50fTwvdGQ+XHJcbiAgICAgICAgPC90cj4gXHJcbiAgICAgIGBcclxuICAgICk7XHJcbiAgfTtcclxuICBjb25zdCBjcmVhdGVNb2RhbCA9IChkYXRhKSA9PiB7XHJcbiAgICByZXR1cm4gYFxyXG4gICAgICA8ZGl2IGNsYXNzPVwidGFibGUtcmVzcG9uc2l2ZVwiPlxyXG4gICAgICAgIDx0YWJsZSBjbGFzcz1cInRhYmxlIHRhYmxlLXZjZW50ZXJcIj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuWgseWDueS6uuWToTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEubmFtZX08L3RkPlxyXG4gICAgICAgICAgPC90cj5cclxuICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgPHRoPuiBr+e1oembu+ipsTwvdGg+XHJcbiAgICAgICAgICAgIDx0ZD4ke2RhdGEucGhvbmV9PC90ZD5cclxuICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgIDx0aD5FLU1haWw8L3RoPlxyXG4gICAgICAgICAgICA8dGQ+JHtkYXRhLmVtYWlsfTwvdGQ+XHJcbiAgICAgICAgICA8L3RyPlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgPHRhYmxlIGNsYXNzPVwidGFibGUgdGFibGUtdmNlbnRlclwiPlxyXG4gICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgPHRoPumhnuWIpTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPumgheebrjwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuWWruWDuTwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPuaVuOmHjzwvdGg+XHJcbiAgICAgICAgICAgICAgPHRoPumHkemhjTwvdGg+XHJcbiAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAke2NyZWF0ZUl0ZW0oZGF0YS5pdGVtcykuam9pbignJyl9XHJcbiAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgIDwvdGFibGU+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgYDtcclxuICB9O1xyXG5cclxuICAvLyB2YWxpZGF0ZSBmb3JtXHJcbiAgbGV0IGNvbnN0cmFpbnRzID0ge1xyXG4gICAgY29tcGFueToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl5qWt5Li75ZCN56ixJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBuYW1lOiB7XHJcbiAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ17oq4vovLjlhaXloLHlg7nkurrlk6EnLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGVtYWlsOiB7XHJcbiAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ17oq4vovLjlhaUgRS1NYWlsJyxcclxuICAgICAgfSxcclxuICAgICAgZW1haWw6IHtcclxuICAgICAgICBtZXNzYWdlOiAn5qC85byP6Yyv6KqkJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBwaG9uZToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl6IGv57Wh6Zu76KmxJyxcclxuICAgICAgfSxcclxuICAgICAgZm9ybWF0OiB7XHJcbiAgICAgICAgcGF0dGVybjogJ14wOVswLTldezh9JCcsXHJcbiAgICAgICAgbWVzc2FnZTogJ17miYvmqZ/moLzlvI/pjK/oqqQnLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGl0ZW06IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXumgheebruWQjeeoseS4jeW+l+eCuuepuicsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcHJpY2U6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuWWruWDueWQjeeoseS4jeW+l+eCuuepuicsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJlc2V0Rm9ybUlucHV0ID0gKGZvcm1JbnB1dCkgPT4ge1xyXG4gICAgZm9ybUlucHV0LmNsYXNzTGlzdC5yZW1vdmUoJ2lzLWludmFsaWQnKTtcclxuICAgIGZvcm1JbnB1dC5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5pbnZhbGlkLWZlZWRiYWNrJykuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgICAgZWwucmVtb3ZlKCk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBhZGRFcnJvciA9IChmb3JtSW5wdXQsIGVycm9yKSA9PiB7XHJcbiAgICBjb25zdCBibG9jayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgYmxvY2suY2xhc3NMaXN0LmFkZCgnaW52YWxpZC1mZWVkYmFjaycpO1xyXG4gICAgYmxvY2suaW5uZXJUZXh0ID0gZXJyb3I7XHJcbiAgICBmb3JtSW5wdXQucGFyZW50Tm9kZS5hcHBlbmRDaGlsZChibG9jayk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2hvd0Vycm9yc0ZvcklucHV0ID0gKGlucHV0LCBlcnJvcnMpID0+IHtcclxuICAgIHJlc2V0Rm9ybUlucHV0KGlucHV0KTtcclxuICAgIGlmIChlcnJvcnMpIHtcclxuICAgICAgaW5wdXQuY2xhc3NMaXN0LmFkZCgnaXMtaW52YWxpZCcpO1xyXG5cclxuICAgICAgZXJyb3JzLmZvckVhY2goKGVycikgPT4ge1xyXG4gICAgICAgIGFkZEVycm9yKGlucHV0LCBlcnIpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBzaG93RXJyb3JzID0gKGZvcm0sIGVycm9ycykgPT4ge1xyXG4gICAgZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lXSwgc2VsZWN0W25hbWVdJykuZm9yRWFjaCgoaW5wdXQpID0+IHtcclxuICAgICAgc2hvd0Vycm9yc0ZvcklucHV0KGlucHV0LCBlcnJvcnMgJiYgZXJyb3JzW2lucHV0Lm5hbWVdKTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZUZvcm1TdWJtaXQgPSAoZm9ybSwgaW5wdXQpID0+IHtcclxuICAgIGNvbnN0IGVycm9ycyA9IHZhbGlkYXRlKGZvcm0sIGNvbnN0cmFpbnRzKTtcclxuICAgIGlmICghZXJyb3JzKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHNob3dFcnJvcnMoZm9ybSwgZXJyb3JzIHx8IHt9KTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9O1xyXG5cclxuICBjb25zdCBmb3JtRGF0YSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnN0IGRhdGEgPSB7XHJcbiAgICAgIGNvbXBhbnk6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWNvbXBhbnldJykudmFsdWUsXHJcbiAgICAgIG5hbWU6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPW5hbWVdJykudmFsdWUsXHJcbiAgICAgIHBob25lOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbbmFtZT1waG9uZV0nKS52YWx1ZSxcclxuICAgICAgZW1haWw6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWVtYWlsXScpLnZhbHVlLFxyXG4gICAgICBkZXNjcmlwdGlvbjogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW25hbWU9ZGVzY3JpcHRpb25dJykudmFsdWUsXHJcbiAgICAgIGl0ZW1zOiBbXSxcclxuICAgIH07XHJcblxyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5mb3JFYWNoKChlbGVtZW50LCBpbmRleCkgPT4ge1xyXG4gICAgICBpZiAoaW5kZXggPT09IDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGluZGV4ID09PSAxKSB7XHJcbiAgICAgICAgZGF0YS5pdGVtcy5wdXNoKHtcclxuICAgICAgICAgIGNhdGVnb3J5OiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPWNhdGVnb3J5YCkudmFsdWUsXHJcbiAgICAgICAgICBpdGVtOiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPWl0ZW1gKS52YWx1ZSxcclxuICAgICAgICAgIHByaWNlOiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPXByaWNlYCkudmFsdWUsXHJcbiAgICAgICAgICBjb3VudDogZWxlbWVudC5xdWVyeVNlbGVjdG9yKGBbbmFtZT1jb3VudGApLnZhbHVlLFxyXG4gICAgICAgICAgdW5pdDogZWxlbWVudC5xdWVyeVNlbGVjdG9yKGBbbmFtZT11bml0YCkudmFsdWUsXHJcbiAgICAgICAgICBhbW91bnQ6IGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW25hbWU9YW1vdW50XWApLnZhbHVlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRhdGEuaXRlbXMucHVzaCh7XHJcbiAgICAgICAgICBjYXRlZ29yeTogZWxlbWVudC5xdWVyeVNlbGVjdG9yKGBbbmFtZT1jYXRlZ29yeSR7aW5kZXggLSAxfV1gKS52YWx1ZSxcclxuICAgICAgICAgIGl0ZW06IGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW25hbWU9aXRlbSR7aW5kZXggLSAxfV1gKS52YWx1ZSxcclxuICAgICAgICAgIHByaWNlOiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPXByaWNlJHtpbmRleCAtIDF9XWApLnZhbHVlLFxyXG4gICAgICAgICAgY291bnQ6IGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW25hbWU9Y291bnQke2luZGV4IC0gMX1dYCkudmFsdWUsXHJcbiAgICAgICAgICB1bml0OiBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lPXVuaXQke2luZGV4IC0gMX1dYCkudmFsdWUsXHJcbiAgICAgICAgICBhbW91bnQ6IGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW25hbWU9YW1vdW50XWApLnZhbHVlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gZGF0YTtcclxuICB9O1xyXG5cclxuICAvLyBkb2N1bWVudCBpbml0ID09PT09PT09PT09PT09XHJcblxyXG4gICRpbnB1dHMuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZXYpID0+IHtcclxuICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgc2hvd0Vycm9yc0ZvcklucHV0KGUsIGVycm9yc1tlLm5hbWVdKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUpID0+IHtcclxuICAgIHVwZGF0ZUl0ZW1Sb3coZSwgJycpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBhZGQgaXRlbSByb3dcclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWRkSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGNvbnN0IHJvdyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWl0ZW1dJyk7XHJcbiAgICBjb25zdCBuZXdSb3cgPSByb3cuY2xvbmVOb2RlKHRydWUpO1xyXG4gICAgY29uc3QgaXRlbUxlbmd0aCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWl0ZW1dJykubGVuZ3RoIC0gMTtcclxuICAgIG5ld1Jvdy5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtaXRlbXNdJykuYXBwZW5kKG5ld1Jvdyk7XHJcbiAgICB1cGRhdGVJdGVtUm93KG5ld1JvdywgaXRlbUxlbmd0aCk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIG9uIFN1Ym1pdFxyXG4gICRtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdzaG93LmJzLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGlmICghaGFuZGxlRm9ybVN1Ym1pdCgkZm9ybSkpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICAgIHRoaXMucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKS50ZXh0Q29udGVudCA9ICcnO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc3QgZGF0YSA9IGZvcm1EYXRhKCk7XHJcbiAgICAgIGNvbnN0IG1vZGFsVGl0bGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtdGl0bGUnKTtcclxuICAgICAgY29uc3QgbW9kYWxCb2R5ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1vZGFsLWJvZHknKTtcclxuXHJcbiAgICAgIG1vZGFsVGl0bGUuYXBwZW5kKGRhdGEuY29tcGFueSArICct5aCx5YO55ZauJyk7XHJcbiAgICAgIG1vZGFsQm9keS5pbnNlcnRBZGphY2VudEhUTUwoJ2JlZm9yZWVuZCcsIGNyZWF0ZU1vZGFsKGRhdGEpKTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgJG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2hpZGRlbi5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gJyc7XHJcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1ib2R5JykudGV4dENvbnRlbnQgPSAnJztcclxuICB9KTtcclxuXHJcbiAgLy8gUHJpbnQgPT09PT09PT09PT09PT1cclxuICBjb25zdCBwcmludFNjcmVlbiA9IChwcmludCkgPT4ge1xyXG4gICAgY29uc3QgcHJpbnRBcmVhID0gcHJpbnQuaW5uZXJIVE1MO1xyXG4gICAgY29uc3QgcHJpbnRQYWdlID0gd2luZG93Lm9wZW4oJycsICdQcmludGluZy4uLicsICcnKTtcclxuICAgIHByaW50UGFnZS5kb2N1bWVudC5vcGVuKCk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQud3JpdGUoXHJcbiAgICAgIGA8aHRtbD5cclxuICAgICAgICA8aGVhZD5cclxuICAgICAgICA8bWV0YSBjaGFyc2V0PVwiVVRGLThcIiAvPlxyXG4gICAgICAgIDxtZXRhIGh0dHAtZXF1aXY9XCJYLVVBLUNvbXBhdGlibGVcIiBjb250ZW50PVwiSUU9ZWRnZVwiIC8+XHJcbiAgICAgICAgPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjBcIiAvPlxyXG4gICAgICAgICAgPHRpdGxlPuWgseWDueWWrueUoueUn+WZqDwvdGl0bGU+XHJcbiAgICAgICAgICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cImh0dHBzOi8vdW5wa2cuY29tL0B0YWJsZXIvY29yZUBsYXRlc3QvZGlzdC9jc3MvdGFibGVyLm1pbi5jc3NcIi8+XHJcbiAgICAgICAgPC9oZWFkPlxyXG4gICAgICAgIDxib2R5IG9ubG9hZD0nd2luZG93LnByaW50KCk7d2luZG93LmNsb3NlKCknPmBcclxuICAgICk7XHJcbiAgICBwcmludFBhZ2UuZG9jdW1lbnQud3JpdGUocHJpbnRBcmVhKTtcclxuICAgIHByaW50UGFnZS5kb2N1bWVudC5jbG9zZSgnPC9ib2R5PjwvaHRtbD4nKTtcclxuICB9O1xyXG5cclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJpbnQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcclxuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9Mb2NhbGVEYXRlU3RyaW5nKCk7XHJcbiAgICBjb25zdCBwcmludEh0bWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtZGlhbG9nIC5tb2RhbC1jb250ZW50Jyk7XHJcblxyXG4gICAgY29uc3QgbmV3UHJpbnRIdG1sID0gcHJpbnRIdG1sLmNsb25lTm9kZSh0cnVlKTtcclxuICAgIG5ld1ByaW50SHRtbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtZm9vdGVyJykucmVtb3ZlKCk7XHJcbiAgICBuZXdQcmludEh0bWwuaW5zZXJ0QWRqYWNlbnRIVE1MKFxyXG4gICAgICAnYmVmb3JlZW5kJyxcclxuICAgICAgYDxwIHN0eWxlPVwidGV4dC1hbGlnbjogcmlnaHQ7XCI+5aCx5YO55pmC6ZaT77yaJHtub3d9PC9wPmBcclxuICAgICk7XHJcblxyXG4gICAgcHJpbnRTY3JlZW4obmV3UHJpbnRIdG1sKTtcclxuICB9KTtcclxufSkoKTtcclxuIl0sImZpbGUiOiJtYWluLmpzIn0=
