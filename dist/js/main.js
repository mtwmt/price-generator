"use strict";

(function () {
  var $modal = document.querySelector('#modal');
  var $preview = document.querySelector('#preview');
  var $form = document.querySelector('form#form');
  var $inputs = document.querySelectorAll('input, textarea, select'); // common fn

  var _common = common(),
      setAmount = _common.setAmount,
      setTotal = _common.setTotal; // validate


  var _verify = verify(),
      constraints = _verify.constraints,
      setItemFormValidate = _verify.setItemFormValidate,
      showErrorsForInput = _verify.showErrorsForInput,
      handleFormSubmit = _verify.handleFormSubmit; // modal view


  var _modalView = modalView(),
      createModal = _modalView.createModal;

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
  /**
   * formData
   * @returns 表單資料
   */


  var formData = function formData() {
    var _$form$querySelector;

    var logoFile = (_$form$querySelector = $form.querySelector('[name=logo]')) === null || _$form$querySelector === void 0 ? void 0 : _$form$querySelector.files[0];
    var getLogo = !!logoFile ? URL.createObjectURL(logoFile) : null;
    var data = {
      logo: getLogo,
      company: $form.querySelector('[name=company]').value,
      taxID: $form.querySelector('[name=taxID]').value,
      name: $form.querySelector('[name=name]').value,
      phone: $form.querySelector('[name=phone]').value,
      email: $form.querySelector('[name=email]').value,
      startDate: $form.querySelector('[name=startDate]').value,
      endDate: $form.querySelector('[name=endDate]').value,
      desc: $form.querySelector('[name=desc]').value,
      total: $form.querySelector('#total-price').textContent,
      items: []
    };
    $form.querySelectorAll('[data-item]').forEach(function (e, index) {
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
  };

  var exportTemplate = function exportTemplate(tmp) {
    var data = formData();
    var modalBody = tmp.querySelector('.modal-main');
    modalBody.insertAdjacentHTML('beforeend', createModal(data));
  };

  var resetExportTemplate = function resetExportTemplate(tmp) {
    tmp.querySelector('.modal-main').textContent = '';
  }; //======== document init ========


  $form.querySelectorAll('[data-item]').forEach(function (e) {
    updateItemRow(e);
    setItemFormValidate();
  });
  $inputs.forEach(function (e, i) {
    e.addEventListener('change', function (ev) {
      var errors = validate($form, constraints) || {};
      showErrorsForInput(e, errors[e.name]);
    });
  }); // add item row

  $form.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    var row = $form.querySelector('[data-item]');
    var newRow = row.cloneNode(true);
    newRow.querySelectorAll('input').forEach(function (e) {
      e.value = e.defaultValue;
      e.classList.remove('is-invalid');
      e.parentNode.querySelectorAll('.invalid-feedback').forEach(function (el) {
        el.remove();
      });
    });
    $form.querySelector('[data-items]').append(newRow);
    updateItemRow(newRow);
    setItemFormValidate();
  }); // on preview

  $preview.addEventListener('show.bs.modal', function (e) {
    exportTemplate(this);
  });
  $preview.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    resetExportTemplate(this);
  }); // on Submit

  $modal.addEventListener('show.bs.modal', function (e) {
    if (!handleFormSubmit($form)) {
      e.preventDefault();
      resetExportTemplate(this);
    } else {
      exportTemplate(this);
    }
  });
  $modal.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    resetExportTemplate(this);
  }); // =========== Export ============

  $modal.querySelector('#exportImage').addEventListener('click', function () {
    var preview = $modal.querySelector('.modal-content'); // export Image

    html2canvas(preview).then(function (canvas) {
      document.body.appendChild(canvas);
      var $a = document.createElement('a');
      $a.href = canvas.toDataURL('image/jpeg').replace('image/jpeg', 'image/octet-stream');
      $a.download = ''.concat(new Date().toLocaleString('roc', {
        hour12: false
      }), '_quotation.jpg');
      $a.click();
    });
  }); // =========== Print ==============

  $modal.querySelector('#print').addEventListener('click', function () {
    var jsPDF = window.jspdf.jsPDF;
    var print = $modal.querySelector('.modal-content'); // export pdf

    html2canvas(print).then(function (canvas) {
      var pdfImage = canvas.toDataURL();
      var doc = new jsPDF({
        unit: 'px',
        hotfixes: ['px_scaling']
      });
      var scale = (2780 - canvas.width) / 2480;
      doc.addImage(pdfImage, 'JPEG', 10, 10, canvas.width * scale, canvas.height * scale);
      doc.save(new Date().toLocaleString('roc', {
        hour12: false
      }) + '_quotation.pdf');
    });
  });
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiXSwibmFtZXMiOlsiJG1vZGFsIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiJHByZXZpZXciLCIkZm9ybSIsIiRpbnB1dHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY29tbW9uIiwic2V0QW1vdW50Iiwic2V0VG90YWwiLCJ2ZXJpZnkiLCJjb25zdHJhaW50cyIsInNldEl0ZW1Gb3JtVmFsaWRhdGUiLCJzaG93RXJyb3JzRm9ySW5wdXQiLCJoYW5kbGVGb3JtU3VibWl0IiwibW9kYWxWaWV3IiwiY3JlYXRlTW9kYWwiLCJkZWxJdGVtIiwicm93IiwiYWRkRXZlbnRMaXN0ZW5lciIsImUiLCJwcmV2ZW50RGVmYXVsdCIsImxlbmd0aCIsInBhcmVudEVsZW1lbnQiLCJyZW1vdmUiLCJ1cGRhdGVJdGVtUm93IiwiZm9yRWFjaCIsImkiLCJldiIsImVycm9ycyIsInZhbGlkYXRlIiwibmFtZSIsImZvcm1EYXRhIiwibG9nb0ZpbGUiLCJmaWxlcyIsImdldExvZ28iLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJkYXRhIiwibG9nbyIsImNvbXBhbnkiLCJ2YWx1ZSIsInRheElEIiwicGhvbmUiLCJlbWFpbCIsInN0YXJ0RGF0ZSIsImVuZERhdGUiLCJkZXNjIiwidG90YWwiLCJ0ZXh0Q29udGVudCIsIml0ZW1zIiwiaW5kZXgiLCJwdXNoIiwiY2F0ZWdvcnkiLCJpdGVtIiwicHJpY2UiLCJjb3VudCIsInVuaXQiLCJhbW91bnQiLCJleHBvcnRUZW1wbGF0ZSIsInRtcCIsIm1vZGFsQm9keSIsImluc2VydEFkamFjZW50SFRNTCIsInJlc2V0RXhwb3J0VGVtcGxhdGUiLCJuZXdSb3ciLCJjbG9uZU5vZGUiLCJkZWZhdWx0VmFsdWUiLCJjbGFzc0xpc3QiLCJwYXJlbnROb2RlIiwiZWwiLCJhcHBlbmQiLCJwcmV2aWV3IiwiaHRtbDJjYW52YXMiLCJ0aGVuIiwiY2FudmFzIiwiYm9keSIsImFwcGVuZENoaWxkIiwiJGEiLCJjcmVhdGVFbGVtZW50IiwiaHJlZiIsInRvRGF0YVVSTCIsInJlcGxhY2UiLCJkb3dubG9hZCIsImNvbmNhdCIsIkRhdGUiLCJ0b0xvY2FsZVN0cmluZyIsImhvdXIxMiIsImNsaWNrIiwianNQREYiLCJ3aW5kb3ciLCJqc3BkZiIsInByaW50IiwicGRmSW1hZ2UiLCJkb2MiLCJob3RmaXhlcyIsInNjYWxlIiwid2lkdGgiLCJhZGRJbWFnZSIsImhlaWdodCIsInNhdmUiXSwibWFwcGluZ3MiOiI7O0FBQUEsQ0FBQyxZQUFZO0FBQ1gsTUFBTUEsTUFBTSxHQUFHQyxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBZjtBQUNBLE1BQU1DLFFBQVEsR0FBR0YsUUFBUSxDQUFDQyxhQUFULENBQXVCLFVBQXZCLENBQWpCO0FBQ0EsTUFBTUUsS0FBSyxHQUFHSCxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsV0FBdkIsQ0FBZDtBQUNBLE1BQU1HLE9BQU8sR0FBR0osUUFBUSxDQUFDSyxnQkFBVCxDQUEwQix5QkFBMUIsQ0FBaEIsQ0FKVyxDQU1YOztBQU5XLGdCQU9xQkMsTUFBTSxFQVAzQjtBQUFBLE1BT0hDLFNBUEcsV0FPSEEsU0FQRztBQUFBLE1BT1FDLFFBUFIsV0FPUUEsUUFQUixFQVNYOzs7QUFUVyxnQkFlUEMsTUFBTSxFQWZDO0FBQUEsTUFXVEMsV0FYUyxXQVdUQSxXQVhTO0FBQUEsTUFZVEMsbUJBWlMsV0FZVEEsbUJBWlM7QUFBQSxNQWFUQyxrQkFiUyxXQWFUQSxrQkFiUztBQUFBLE1BY1RDLGdCQWRTLFdBY1RBLGdCQWRTLEVBaUJYOzs7QUFqQlcsbUJBa0JhQyxTQUFTLEVBbEJ0QjtBQUFBLE1Ba0JIQyxXQWxCRyxjQWtCSEEsV0FsQkc7O0FBb0JYLE1BQU1DLE9BQU8sR0FBRyxTQUFWQSxPQUFVLENBQUNDLEdBQUQsRUFBUztBQUN2QkEsSUFBQUEsR0FBRyxDQUFDaEIsYUFBSixDQUFrQixVQUFsQixFQUE4QmlCLGdCQUE5QixDQUErQyxPQUEvQyxFQUF3RCxVQUFVQyxDQUFWLEVBQWE7QUFDbkVBLE1BQUFB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Q3NCLEtBQWYsSUFBd0IsSUFBdkM7QUFDQUgsTUFBQUEsR0FBRyxDQUFDSSxRQUFKLENBQWFMLFFBQWIsRUFBdUIsTUFBdkIsRUFBK0IsRUFBL0IsRUFBbUMsRUFBbkMsRUFBd0NsQixNQUFNLENBQUNzQixLQUFQLEdBQWVELEtBQXZELEVBQWdFckIsTUFBTSxDQUFDd0IsTUFBUCxHQUFnQkgsS0FBaEY7QUFDQUYsTUFBQUEsR0FBRyxDQUFDTSxJQUFKLENBQ0UsSUFBSWYsSUFBSixHQUFXQyxjQUFYLENBQTBCLEtBQTFCLEVBQWlDO0FBQUVDLFFBQUFBLE1BQU0sRUFBRTtBQUFWLE9BQWpDLElBQXNELGdCQUR4RDtBQUdELEtBWEQ7QUFZRCxHQWhCRDtBQWlCRCxDQXBMRCIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiAoKSB7XHJcbiAgY29uc3QgJG1vZGFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI21vZGFsJyk7XHJcbiAgY29uc3QgJHByZXZpZXcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcHJldmlldycpO1xyXG4gIGNvbnN0ICRmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZm9ybSNmb3JtJyk7XHJcbiAgY29uc3QgJGlucHV0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0Jyk7XHJcblxyXG4gIC8vIGNvbW1vbiBmblxyXG4gIGNvbnN0IHsgc2V0QW1vdW50LCBzZXRUb3RhbCB9ID0gY29tbW9uKCk7XHJcblxyXG4gIC8vIHZhbGlkYXRlXHJcbiAgY29uc3Qge1xyXG4gICAgY29uc3RyYWludHMsXHJcbiAgICBzZXRJdGVtRm9ybVZhbGlkYXRlLFxyXG4gICAgc2hvd0Vycm9yc0ZvcklucHV0LFxyXG4gICAgaGFuZGxlRm9ybVN1Ym1pdCxcclxuICB9ID0gdmVyaWZ5KCk7XHJcblxyXG4gIC8vIG1vZGFsIHZpZXdcclxuICBjb25zdCB7IGNyZWF0ZU1vZGFsIH0gPSBtb2RhbFZpZXcoKTtcclxuXHJcbiAgY29uc3QgZGVsSXRlbSA9IChyb3cpID0+IHtcclxuICAgIHJvdy5xdWVyeVNlbGVjdG9yKCcuZGVsSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBpZiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaXRlbV0nKS5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucmVtb3ZlKCk7XHJcbiAgICAgICAgc2V0VG90YWwoKTtcclxuICAgICAgfVxyXG4gICAgICBzZXRJdGVtRm9ybVZhbGlkYXRlKCk7XHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCB1cGRhdGVJdGVtUm93ID0gKHJvdykgPT4ge1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgICBlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChldikgPT4ge1xyXG4gICAgICAgIHNldEFtb3VudChyb3cpO1xyXG4gICAgICAgIHNldFRvdGFsKCk7XHJcbiAgICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgICBzaG93RXJyb3JzRm9ySW5wdXQoZSwgZXJyb3JzW2UubmFtZV0pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgZGVsSXRlbShyb3cpO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIGZvcm1EYXRhXHJcbiAgICogQHJldHVybnMg6KGo5Zau6LOH5paZXHJcbiAgICovXHJcbiAgY29uc3QgZm9ybURhdGEgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBsb2dvRmlsZSA9ICRmb3JtLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWxvZ29dJyk/LmZpbGVzWzBdO1xyXG4gICAgY29uc3QgZ2V0TG9nbyA9ICEhbG9nb0ZpbGUgPyBVUkwuY3JlYXRlT2JqZWN0VVJMKGxvZ29GaWxlKSA6IG51bGw7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IHtcclxuICAgICAgbG9nbzogZ2V0TG9nbyxcclxuICAgICAgY29tcGFueTogJGZvcm0ucXVlcnlTZWxlY3RvcignW25hbWU9Y29tcGFueV0nKS52YWx1ZSxcclxuICAgICAgdGF4SUQ6ICRmb3JtLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPXRheElEXScpLnZhbHVlLFxyXG4gICAgICBuYW1lOiAkZm9ybS5xdWVyeVNlbGVjdG9yKCdbbmFtZT1uYW1lXScpLnZhbHVlLFxyXG4gICAgICBwaG9uZTogJGZvcm0ucXVlcnlTZWxlY3RvcignW25hbWU9cGhvbmVdJykudmFsdWUsXHJcbiAgICAgIGVtYWlsOiAkZm9ybS5xdWVyeVNlbGVjdG9yKCdbbmFtZT1lbWFpbF0nKS52YWx1ZSxcclxuICAgICAgc3RhcnREYXRlOiAkZm9ybS5xdWVyeVNlbGVjdG9yKCdbbmFtZT1zdGFydERhdGVdJykudmFsdWUsXHJcbiAgICAgIGVuZERhdGU6ICRmb3JtLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWVuZERhdGVdJykudmFsdWUsXHJcbiAgICAgIGRlc2M6ICRmb3JtLnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWRlc2NdJykudmFsdWUsXHJcbiAgICAgIHRvdGFsOiAkZm9ybS5xdWVyeVNlbGVjdG9yKCcjdG90YWwtcHJpY2UnKS50ZXh0Q29udGVudCxcclxuICAgICAgaXRlbXM6IFtdLFxyXG4gICAgfTtcclxuXHJcbiAgICAkZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUsIGluZGV4KSA9PiB7XHJcbiAgICAgIGRhdGEuaXRlbXMucHVzaCh7XHJcbiAgICAgICAgY2F0ZWdvcnk6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWNhdGVnb3J5YCkudmFsdWUsXHJcbiAgICAgICAgaXRlbTogZS5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9aXRlbWApLnZhbHVlLFxyXG4gICAgICAgIHByaWNlOiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1wcmljZWApLnZhbHVlLFxyXG4gICAgICAgIGNvdW50OiBlLnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudGApLnZhbHVlLFxyXG4gICAgICAgIHVuaXQ6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPXVuaXRgKS52YWx1ZSxcclxuICAgICAgICBhbW91bnQ6IGUucXVlcnlTZWxlY3RvcihgW25hbWUqPWFtb3VudF1gKS52YWx1ZSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBkYXRhO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGV4cG9ydFRlbXBsYXRlID0gZnVuY3Rpb24gKHRtcCkge1xyXG4gICAgY29uc3QgZGF0YSA9IGZvcm1EYXRhKCk7XHJcbiAgICBjb25zdCBtb2RhbEJvZHkgPSB0bXAucXVlcnlTZWxlY3RvcignLm1vZGFsLW1haW4nKTtcclxuXHJcbiAgICBtb2RhbEJvZHkuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCBjcmVhdGVNb2RhbChkYXRhKSk7XHJcbiAgfTtcclxuICBjb25zdCByZXNldEV4cG9ydFRlbXBsYXRlID0gZnVuY3Rpb24gKHRtcCkge1xyXG4gICAgdG1wLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1tYWluJykudGV4dENvbnRlbnQgPSAnJztcclxuICB9XHJcblxyXG4gIC8vPT09PT09PT0gZG9jdW1lbnQgaW5pdCA9PT09PT09PVxyXG5cclxuICAkZm9ybS5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1pdGVtXScpLmZvckVhY2goKGUpID0+IHtcclxuICAgIHVwZGF0ZUl0ZW1Sb3coZSk7XHJcbiAgICBzZXRJdGVtRm9ybVZhbGlkYXRlKCk7XHJcbiAgfSk7XHJcblxyXG4gICRpbnB1dHMuZm9yRWFjaCgoZSwgaSkgPT4ge1xyXG4gICAgZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZXYpID0+IHtcclxuICAgICAgY29uc3QgZXJyb3JzID0gdmFsaWRhdGUoJGZvcm0sIGNvbnN0cmFpbnRzKSB8fCB7fTtcclxuICAgICAgc2hvd0Vycm9yc0ZvcklucHV0KGUsIGVycm9yc1tlLm5hbWVdKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICAvLyBhZGQgaXRlbSByb3dcclxuICAkZm9ybS5xdWVyeVNlbGVjdG9yKCcjYWRkSXRlbScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGNvbnN0IHJvdyA9ICRmb3JtLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWl0ZW1dJyk7XHJcbiAgICBjb25zdCBuZXdSb3cgPSByb3cuY2xvbmVOb2RlKHRydWUpO1xyXG4gICAgbmV3Um93LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0JykuZm9yRWFjaCgoZSkgPT4ge1xyXG4gICAgICBlLnZhbHVlID0gZS5kZWZhdWx0VmFsdWU7XHJcbiAgICAgIGUuY2xhc3NMaXN0LnJlbW92ZSgnaXMtaW52YWxpZCcpO1xyXG4gICAgICBlLnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLmludmFsaWQtZmVlZGJhY2snKS5mb3JFYWNoKChlbCkgPT4ge1xyXG4gICAgICAgIGVsLnJlbW92ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgICRmb3JtLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWl0ZW1zXScpLmFwcGVuZChuZXdSb3cpO1xyXG4gICAgdXBkYXRlSXRlbVJvdyhuZXdSb3cpO1xyXG4gICAgc2V0SXRlbUZvcm1WYWxpZGF0ZSgpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBvbiBwcmV2aWV3XHJcbiAgJHByZXZpZXcuYWRkRXZlbnRMaXN0ZW5lcignc2hvdy5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBleHBvcnRUZW1wbGF0ZSh0aGlzKTtcclxuICB9KTtcclxuICAkcHJldmlldy5hZGRFdmVudExpc3RlbmVyKCdoaWRkZW4uYnMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgcmVzZXRFeHBvcnRUZW1wbGF0ZSh0aGlzKVxyXG4gIH0pO1xyXG5cclxuICAvLyBvbiBTdWJtaXRcclxuICAkbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignc2hvdy5icy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICBpZiAoIWhhbmRsZUZvcm1TdWJtaXQoJGZvcm0pKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgcmVzZXRFeHBvcnRUZW1wbGF0ZSh0aGlzKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGV4cG9ydFRlbXBsYXRlKHRoaXMpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICAkbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignaGlkZGVuLmJzLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIHJlc2V0RXhwb3J0VGVtcGxhdGUodGhpcyk7XHJcbiAgfSk7XHJcblxyXG4gIC8vID09PT09PT09PT09IEV4cG9ydCA9PT09PT09PT09PT1cclxuICAkbW9kYWwucXVlcnlTZWxlY3RvcignI2V4cG9ydEltYWdlJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCBwcmV2aWV3ID0gJG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1jb250ZW50Jyk7XHJcbiAgICAvLyBleHBvcnQgSW1hZ2VcclxuICAgIGh0bWwyY2FudmFzKHByZXZpZXcpLnRoZW4oZnVuY3Rpb24gKGNhbnZhcykge1xyXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNhbnZhcyk7XHJcbiAgICAgIGNvbnN0ICRhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xyXG4gICAgICAkYS5ocmVmID0gY2FudmFzXHJcbiAgICAgICAgLnRvRGF0YVVSTCgnaW1hZ2UvanBlZycpXHJcbiAgICAgICAgLnJlcGxhY2UoJ2ltYWdlL2pwZWcnLCAnaW1hZ2Uvb2N0ZXQtc3RyZWFtJyk7XHJcbiAgICAgICRhLmRvd25sb2FkID0gJycuY29uY2F0KFxyXG4gICAgICAgIG5ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcoJ3JvYycsIHsgaG91cjEyOiBmYWxzZSB9KSxcclxuICAgICAgICAnX3F1b3RhdGlvbi5qcGcnXHJcbiAgICAgICk7XHJcbiAgICAgICRhLmNsaWNrKCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgLy8gPT09PT09PT09PT0gUHJpbnQgPT09PT09PT09PT09PT1cclxuICAkbW9kYWwucXVlcnlTZWxlY3RvcignI3ByaW50JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcbiAgICBjb25zdCB7IGpzUERGIH0gPSB3aW5kb3cuanNwZGY7XHJcbiAgICBjb25zdCBwcmludCA9ICRtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtY29udGVudCcpO1xyXG4gICAgLy8gZXhwb3J0IHBkZlxyXG4gICAgaHRtbDJjYW52YXMocHJpbnQpLnRoZW4oZnVuY3Rpb24gKGNhbnZhcykge1xyXG4gICAgICBjb25zdCBwZGZJbWFnZSA9IGNhbnZhcy50b0RhdGFVUkwoKTtcclxuICAgICAgY29uc3QgZG9jID0gbmV3IGpzUERGKHtcclxuICAgICAgICB1bml0OiAncHgnLFxyXG4gICAgICAgIGhvdGZpeGVzOiBbJ3B4X3NjYWxpbmcnXVxyXG4gICAgICB9KTtcclxuICAgICAgY29uc3Qgc2NhbGUgPSAoKDI3ODAgLSBjYW52YXMud2lkdGgpIC8gMjQ4MCk7XHJcbiAgICAgIGRvYy5hZGRJbWFnZShwZGZJbWFnZSwgJ0pQRUcnLCAxMCwgMTAsIChjYW52YXMud2lkdGggKiBzY2FsZSksIChjYW52YXMuaGVpZ2h0ICogc2NhbGUpKTtcclxuICAgICAgZG9jLnNhdmUoXHJcbiAgICAgICAgbmV3IERhdGUoKS50b0xvY2FsZVN0cmluZygncm9jJywgeyBob3VyMTI6IGZhbHNlIH0pICsgJ19xdW90YXRpb24ucGRmJ1xyXG4gICAgICApO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0pKCk7XHJcbiJdLCJmaWxlIjoibWFpbi5qcyJ9
