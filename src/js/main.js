(function () {
  const $modal = document.querySelector('#modal');
  const $preview = document.querySelector('#preview');
  const $form = document.querySelector('form#form');
  const $inputs = document.querySelectorAll('input, textarea, select');

  // common fn
  const { setAmount, setTotal } = common();

  // validate
  const {
    constraints,
    setItemFormValidate,
    showErrorsForInput,
    handleFormSubmit,
  } = verify();

  // modal view
  const { createModal } = modalView();

  const delItem = (row) => {
    row.querySelector('.delItem').addEventListener('click', function (e) {
      e.preventDefault();
      if (document.querySelectorAll('[data-item]').length > 1) {
        this.parentElement.parentElement.remove();
        setTotal();
      }
      setItemFormValidate();
    });
  };

  const updateItemRow = (row) => {
    row.querySelectorAll('input').forEach((e, i) => {
      e.addEventListener('change', (ev) => {
        setAmount(row);
        setTotal();
        const errors = validate($form, constraints) || {};
        showErrorsForInput(e, errors[e.name]);
      });
    });
    delItem(row);
  };

  /**
   * formData
   * @returns 表單資料
   */
  const formData = function () {
    const logoFile = $form.querySelector('[name=logo]')?.files[0];
    const getLogo = !!logoFile ? URL.createObjectURL(logoFile) : null;

    const data = {
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
      items: [],
    };

    $form.querySelectorAll('[data-item]').forEach((e, index) => {
      data.items.push({
        category: e.querySelector(`[name*=category`).value,
        item: e.querySelector(`[name*=item`).value,
        price: e.querySelector(`[name*=price`).value,
        count: e.querySelector(`[name*=count`).value,
        unit: e.querySelector(`[name*=unit`).value,
        amount: e.querySelector(`[name*=amount]`).value,
      });
    });
    return data;
  };

  const exportTemplate = function (tmp) {
    const data = formData();
    const modalBody = tmp.querySelector('.modal-main');

    modalBody.insertAdjacentHTML('beforeend', createModal(data));
  };
  const resetExportTemplate = function (tmp) {
    tmp.querySelector('.modal-main').textContent = '';
  }

  //======== document init ========

  $form.querySelectorAll('[data-item]').forEach((e) => {
    updateItemRow(e);
    setItemFormValidate();
  });

  $inputs.forEach((e, i) => {
    e.addEventListener('change', (ev) => {
      const errors = validate($form, constraints) || {};
      showErrorsForInput(e, errors[e.name]);
    });
  });

  // add item row
  $form.querySelector('#addItem').addEventListener('click', function (e) {
    e.preventDefault();
    const row = $form.querySelector('[data-item]');
    const newRow = row.cloneNode(true);
    newRow.querySelectorAll('input').forEach((e) => {
      e.value = e.defaultValue;
      e.classList.remove('is-invalid');
      e.parentNode.querySelectorAll('.invalid-feedback').forEach((el) => {
        el.remove();
      });
    });

    $form.querySelector('[data-items]').append(newRow);
    updateItemRow(newRow);
    setItemFormValidate();
  });

  // on preview
  $preview.addEventListener('show.bs.modal', function (e) {
    exportTemplate(this);
  });
  $preview.addEventListener('hidden.bs.modal', function (e) {
    e.preventDefault();
    resetExportTemplate(this)
  });

  // on Submit
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
  });

  // =========== Export ============
  $modal.querySelector('#exportImage').addEventListener('click', function () {
    const preview = $modal.querySelector('.modal-content');
    // export Image
    html2canvas(preview).then(function (canvas) {
      document.body.appendChild(canvas);
      const $a = document.createElement('a');
      $a.href = canvas
        .toDataURL('image/jpeg')
        .replace('image/jpeg', 'image/octet-stream');
      $a.download = ''.concat(
        new Date().toLocaleString('roc', { hour12: false }),
        '_quotation.jpg'
      );
      $a.click();
    });
  });

  // =========== Print ==============
  $modal.querySelector('#print').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const print = $modal.querySelector('.modal-content');
    // export pdf
    html2canvas(print).then(function (canvas) {
      const pdfImage = canvas.toDataURL();
      const doc = new jsPDF({
        unit: 'px',
        hotfixes: ['px_scaling']
      });
      const scale = ((2780 - canvas.width) / 2480);
      doc.addImage(pdfImage, 'JPEG', 10, 10, (canvas.width * scale), (canvas.height * scale));
      doc.save(
        new Date().toLocaleString('roc', { hour12: false }) + '_quotation.pdf'
      );
    });
  });
})();
