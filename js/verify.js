"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var verify = function verify() {
  // validate
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
  var constraints = {}; // set validate

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

  return {
    constraints: constraints,
    setItemFormValidate: setItemFormValidate,
    showErrorsForInput: showErrorsForInput,
    handleFormSubmit: handleFormSubmit
  };
};
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInZlcmlmeS5qcyJdLCJuYW1lcyI6WyJ2ZXJpZnkiLCJtYWluVmFsaWRhdGUiLCJjb21wYW55IiwicHJlc2VuY2UiLCJtZXNzYWdlIiwibmFtZSIsImVtYWlsIiwicGhvbmUiLCJmb3JtYXQiLCJwYXR0ZXJuIiwiY29uc3RyYWludHMiLCJzZXRJdGVtRm9ybVZhbGlkYXRlIiwiaXRlbVZhbGlkYXRlIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImUiLCJpIiwicXVlcnlTZWxlY3RvciIsInJlc2V0Rm9ybUlucHV0IiwiZm9ybUlucHV0IiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwicGFyZW50Tm9kZSIsImVsIiwiYWRkRXJyb3IiLCJlcnJvciIsImJsb2NrIiwiY3JlYXRlRWxlbWVudCIsImFkZCIsImlubmVyVGV4dCIsImFwcGVuZENoaWxkIiwic2hvd0Vycm9yc0ZvcklucHV0IiwiaW5wdXQiLCJlcnJvcnMiLCJlcnIiLCJzaG93RXJyb3JzIiwiZm9ybSIsImhhbmRsZUZvcm1TdWJtaXQiLCJ2YWxpZGF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxJQUFNQSxNQUFNLEdBQUcsU0FBVEEsTUFBUyxHQUFNO0FBQ25CO0FBQ0EsTUFBTUMsWUFBWSxHQUFHO0FBQ25CQyxJQUFBQSxPQUFPLEVBQUU7QUFDUEMsTUFBQUEsUUFBUSxFQUFFO0FBQ1JDLFFBQUFBLE9BQU8sRUFBRTtBQUREO0FBREgsS0FEVTtBQU1uQkMsSUFBQUEsSUFBSSxFQUFFO0FBQ0pGLE1BQUFBLFFBQVEsRUFBRTtBQUNSQyxRQUFBQSxPQUFPLEVBQUU7QUFERDtBQUROLEtBTmE7QUFXbkJFLElBQUFBLEtBQUssRUFBRTtBQUNMSCxNQUFBQSxRQUFRLEVBQUU7QUFDUkMsUUFBQUEsT0FBTyxFQUFFO0FBREQsT0FETDtBQUlMRSxNQUFBQSxLQUFLLEVBQUU7QUFDTEYsUUFBQUEsT0FBTyxFQUFFO0FBREo7QUFKRixLQVhZO0FBbUJuQkcsSUFBQUEsS0FBSyxF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QUFDQyxJQUFELEVBQU9ILE1BQVAsRUFBa0I7QUFDbkNHLElBQUFBLElBQUksQ0FBQ3ZCLGdCQUFMLENBQXNCLDJCQUF0QixFQUFtREMsT0FBbkQsQ0FBMkQsVUFBQ2tCLEtBQUQsRUFBVztBQUNwRUQsTUFBQUEsa0JBQWtCLENBQUNDLEtBQUQsRUFBUUMsTUFBTSxJQUFJQSxNQUFNLENBQUNELEtBQUssQ0FBQzVCLElBQVAsQ0FBeEIsQ0FBbEI7QUFDRCxLQUZEO0FBR0QsR0FKRDs7QUFNQSxNQUFNaUMsZ0JBQWdCLEdBQUcsU0FBbkJBLGdCQUFtQixDQUFDRCxJQUFELEVBQVU7QUFDakMsUUFBTUgsTUFBTSxHQUFHSyxRQUFRLENBQUNGLElBQUQsRUFBTzNCLFdBQVAsQ0FBdkI7O0FBQ0EsUUFBSSxDQUFDd0IsTUFBTCxFQUFhO0FBQ1gsYUFBTyxJQUFQO0FBQ0Q7O0FBQ0RFLElBQUFBLFVBQVUsQ0FBQ0MsSUFBRCxFQUFPSCxNQUFNLElBQUksRUFBakIsQ0FBVjtBQUNBLFdBQU8sS0FBUDtBQUNELEdBUEQ7O0FBU0EsU0FBTztBQUNMeEIsSUFBQUEsV0FBVyxFQUFYQSxXQURLO0FBRUxDLElBQUFBLG1CQUFtQixFQUFuQkEsbUJBRks7QUFHTHFCLElBQUFBLGtCQUFrQixFQUFsQkEsa0JBSEs7QUFJTE0sSUFBQUEsZ0JBQWdCLEVBQWhCQTtBQUpLLEdBQVA7QUFNRCxDQTdHRCIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHZlcmlmeSA9ICgpID0+IHtcclxuICAvLyB2YWxpZGF0ZVxyXG4gIGNvbnN0IG1haW5WYWxpZGF0ZSA9IHtcclxuICAgIGNvbXBhbnk6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpealreS4u+WQjeeosScsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgbmFtZToge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWl5aCx5YO55Lq65ZOhJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBlbWFpbDoge1xyXG4gICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgIG1lc3NhZ2U6ICde6KuL6Ly45YWlIEUtTWFpbCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVtYWlsOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ+agvOW8j+mMr+iqpCcsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgcGhvbmU6IHtcclxuICAgICAgcHJlc2VuY2U6IHtcclxuICAgICAgICBtZXNzYWdlOiAnXuiri+i8uOWFpeiBr+e1oembu+ipsScsXHJcbiAgICAgIH0sXHJcbiAgICAgIGZvcm1hdDoge1xyXG4gICAgICAgIHBhdHRlcm46ICdeMDlbMC05XXs4fSQnLFxyXG4gICAgICAgIG1lc3NhZ2U6ICde5omL5qmf5qC85byP6Yyv6KqkJyxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxuICBsZXQgY29uc3RyYWludHMgPSB7fTtcclxuXHJcbiAgLy8gc2V0IHZhbGlkYXRlXHJcbiAgY29uc3Qgc2V0SXRlbUZvcm1WYWxpZGF0ZSA9ICgpID0+IHtcclxuICAgIGxldCBpdGVtVmFsaWRhdGUgPSB7fTtcclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWl0ZW1dJykuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj1jYXRlZ29yeV0nKS5uYW1lID0gYGNhdGVnb3J5JHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPWl0ZW1dJykubmFtZSA9IGBpdGVtJHtpfWA7XHJcbiAgICAgIGUucXVlcnlTZWxlY3RvcignW25hbWUqPXByaWNlXScpLm5hbWUgPSBgcHJpY2Uke2l9YDtcclxuICAgICAgZS5xdWVyeVNlbGVjdG9yKCdbbmFtZSo9Y291bnRdJykubmFtZSA9IGBjb3VudCR7aX1gO1xyXG4gICAgICBlLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lKj11bml0XScpLm5hbWUgPSBgdW5pdCR7aX1gO1xyXG5cclxuICAgICAgaXRlbVZhbGlkYXRlID0ge1xyXG4gICAgICAgIC4uLml0ZW1WYWxpZGF0ZSxcclxuICAgICAgICBbYGl0ZW0ke2l9YF06IHtcclxuICAgICAgICAgIHByZXNlbmNlOiB7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICde6aCF55uu5ZCN56ix5LiN5b6X54K656m6JyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBbYHByaWNlJHtpfWBdOiB7XHJcbiAgICAgICAgICBwcmVzZW5jZToge1xyXG4gICAgICAgICAgICBtZXNzYWdlOiAnXuWWruWDueWQjeeoseS4jeW+l+eCuuepuicsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuICAgIGNvbnN0cmFpbnRzID0ge1xyXG4gICAgICAuLi5tYWluVmFsaWRhdGUsXHJcbiAgICAgIC4uLml0ZW1WYWxpZGF0ZSxcclxuICAgIH07XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcmVzZXRGb3JtSW5wdXQgPSAoZm9ybUlucHV0KSA9PiB7XHJcbiAgICBmb3JtSW5wdXQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtaW52YWxpZCcpO1xyXG4gICAgZm9ybUlucHV0LnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLmludmFsaWQtZmVlZGJhY2snKS5mb3JFYWNoKChlbCkgPT4ge1xyXG4gICAgICBlbC5yZW1vdmUoKTtcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGFkZEVycm9yID0gKGZvcm1JbnB1dCwgZXJyb3IpID0+IHtcclxuICAgIGNvbnN0IGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBibG9jay5jbGFzc0xpc3QuYWRkKCdpbnZhbGlkLWZlZWRiYWNrJyk7XHJcbiAgICBibG9jay5pbm5lclRleHQgPSBlcnJvcjtcclxuICAgIGZvcm1JbnB1dC5wYXJlbnROb2RlLmFwcGVuZENoaWxkKGJsb2NrKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzaG93RXJyb3JzRm9ySW5wdXQgPSAoaW5wdXQsIGVycm9ycykgPT4ge1xyXG4gICAgcmVzZXRGb3JtSW5wdXQoaW5wdXQpO1xyXG4gICAgaWYgKGVycm9ycykge1xyXG4gICAgICBpbnB1dC5jbGFzc0xpc3QuYWRkKCdpcy1pbnZhbGlkJyk7XHJcblxyXG4gICAgICBlcnJvcnMuZm9yRWFjaCgoZXJyKSA9PiB7XHJcbiAgICAgICAgYWRkRXJyb3IoaW5wdXQsIGVycik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHNob3dFcnJvcnMgPSAoZm9ybSwgZXJyb3JzKSA9PiB7XHJcbiAgICBmb3JtLnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W25hbWVdLCBzZWxlY3RbbmFtZV0nKS5mb3JFYWNoKChpbnB1dCkgPT4ge1xyXG4gICAgICBzaG93RXJyb3JzRm9ySW5wdXQoaW5wdXQsIGVycm9ycyAmJiBlcnJvcnNbaW5wdXQubmFtZV0pO1xyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlRm9ybVN1Ym1pdCA9IChmb3JtKSA9PiB7XHJcbiAgICBjb25zdCBlcnJvcnMgPSB2YWxpZGF0ZShmb3JtLCBjb25zdHJhaW50cyk7XHJcbiAgICBpZiAoIWVycm9ycykge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHNob3dFcnJvcnMoZm9ybSwgZXJyb3JzIHx8IHt9KTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9O1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgY29uc3RyYWludHMsXHJcbiAgICBzZXRJdGVtRm9ybVZhbGlkYXRlLFxyXG4gICAgc2hvd0Vycm9yc0ZvcklucHV0LFxyXG4gICAgaGFuZGxlRm9ybVN1Ym1pdCxcclxuICB9O1xyXG59Il0sImZpbGUiOiJ2ZXJpZnkuanMifQ==
