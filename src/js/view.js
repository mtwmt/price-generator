const view = () => {
  const { setNumFormat } = common();

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
  const createModal = (data) => {
    return `
      <div class="table-responsive">
        <table class="table table-vcenter">
          <tr>
            <th>報價人員</th>
            <td>${data.name}</td>
          </tr>
          <tr>
            <th>聯絡電話</th>
            <td>${data.phone}</td>
          </tr>
          <tr>
            <th>E-Mail</th>
            <td>${data.email}</td>
          </tr>
        </table>
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
        <table class="table table-vcenter">
          <thead>
            <tr>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                ${(data.desc + '').replace(/\r\n/g, '<br />')}
              </td>
            </tr>
          </thead>
          </tbody>
        </table>
      </div>
    `;
  };
  return {
    createModal,
  };
};
