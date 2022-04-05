const modalView = () => {
  const { setNumFormat } = common();

  const createModalTitle = (data) => {
    const logoTemplate = data.logo
      ? `<img src="${data.logo}" alt="${data.company}" style="margin-right:8px; height:40px;">`
      : '';

    const company = data.company ? `${data.company} - 報價單` : '報價單';
    const taxiD = data.taxID
      ? `<div class="text-muted">統一編號：${data.taxID}</div>`
      : '';

    return `
      <div class="d-flex align-items-center">
        <div>${logoTemplate}</div>
        <div>
          <div class="fs-2 fw-bolder">${company}</div>
          ${taxiD}
        </div>
      </div>
     `;
  };

  const createItem = (data) => {
    return data.map(
      (e) =>
        `
        <tr>
          <td class="text-left">${e.category}</td>
          <td class="text-left">${e.item}</td>
          <td>${e.price}</td>
          <td>${e.count} ${!!e.unit ? '/' : ''} ${e.unit}</td>
          <td class="text-end price">NT$ ${setNumFormat(e.amount)}</td>
        </tr> 
      `
    );
  };
  const createDesc = (data) => {
    return data
      ? `
      <table class="table table-vcenter">
        <thead>
          <tr>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              ${JSON.parse(JSON.stringify(data)).replace(/[\n\r]/g, '<br>')}
            </td>
          </tr>
        </thead>
        </tbody>
      </table>
    `
      : '';
  };
  const createModal = (data) => {
    const $date = data.endDate
      ? `
      <dt class="col-2">報價日期:</dt>
      <dd class="col-4">${data.startDate}</dd>
      <dt class="col-2">有效日期:</dt>
      <dd class="col-4">${data.endDate}</dd>
      `
      : `
      <dt class="col-2">報價日期:</dt>
      <dd class="col-10">${data.startDate}</dd>
      `;

    return `
    <div class="modal-body py-3">
      ${createModalTitle(data)}
    </div>
    <div class="modal-body">
      <dl class="row">
        <dt class="col-2">報價人員:</dt>
        <dd class="col-10">${data.name}</dd>
        <dt class="col-2">聯絡電話:</dt>
        <dd class="col-10">${data.phone}</dd>
        <dt class="col-2">E-Mail:</dt>
        <dd class="col-10">${data.email}</dd>
        ${$date}
      </dl>
      <div class="table-responsive">
        <table class="table table-vcenter">
          <thead>
            <tr>
              <th>類別</th>
              <th>項目</th>
              <th>單價</th>
              <th>數量</th>
              <th class="text-end">金額</th>
            </tr>
          </thead>
          <tbody>
            ${createItem(data.items).join('')}
            <tr>
              <td colspan="5" class="text-end">
               合計：NT$ <span class="fs-2 fw-bold text-danger">${
                 data.total
               }</span> 元整
              </td>
            </tr>
          </tbody>
        </table>
        ${createDesc(data.desc)}
      </div>
    </div>
    `;
  };
  return {
    createModal,
  };
};
