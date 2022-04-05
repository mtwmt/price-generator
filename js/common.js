"use strict";

var common = function common() {
  // set datepicker
  var startDate = new Litepicker({
    element: document.querySelector('#startDate'),
    startDate: new Date()
  });
  var endDate = new Litepicker({
    element: document.querySelector('#endDate'),
    lockDays: [[new Date(0), new Date()]],
    resetButton: function resetButton() {
      var btn = document.createElement('a');
      btn.classList = 'btn btn-primary btn-sm';
      btn.innerText = '待確認';
      btn.addEventListener('click', function (evt) {
        evt.preventDefault();
      });
      return btn;
    }
  });

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

  return {
    setNumFormat: setNumFormat,
    setAmount: setAmount,
    setTotal: setTotal
  };
};
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1vbi5qcyJdLCJuYW1lcyI6WyJjb21tb24iLCJzdGFydERhdGUiLCJMaXRlcGlja2VyIiwiZWxlbWVudCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsIkRhdGUiLCJlbmREYXRlIiwibG9ja0RheXMiLCJyZXNldEJ1dHRvbiIsImJ0biIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc0xpc3QiLCJpbm5lclRleHQiLCJhZGRFdmVudExpc3RlbmVyIiwiZXZ0IiwicHJldmVudERlZmF1bHQiLCJzZXROdW1Gb3JtYXQiLCJudW0iLCJyZXBsYWNlIiwic2V0QW1vdW50Iiwicm93IiwicHJpY2UiLCJ2YWx1ZSIsImNvdW50Iiwic2V0VG90YWwiLCJ0b3RhbCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJnZXRUb3RhbCIsImZvckVhY2giLCJlIiwidGV4dENvbnRlbnQiXSwibWFwcGluZ3MiOiI7O0FBQUEsSUFBTUEsTUFBTSxHQUFHLFNBQVRBLE1BQVMsR0FBTTtBQUVuQjtBQUNBLE1BQU1DLFNBQVMsR0FBRyxJQUFJQyxVQUFKLENBQWU7QUFDL0JDLElBQUFBLE9BQU8sRUFBRUMsUUFBUSxDQUFDQyxhQUFULENBQXVCLFlBQXZCLENBRHNCO0FBRS9CSixJQUFBQSxTQUFTLEVBQUUsSUFBSUssSUFBSjtBQUZvQixHQUFmLENBQWxCO0FBSUEsTUFBTUMsT0FBTyxHQUFHLElBQUlMLFVBQUosQ0FBZTtBQUM3QkMsSUFBQUEsT0FBTyxFQUFFQyxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsVUFBdkIsQ0FEb0I7QUFFN0JHLElBQUFBLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSUYsSUFBSixDQUFTLENBQVQsQ0FBRCxFQUFjLElBQUlBLElBQUosRUFBZCxDQUFELENBRm1CO0FBRzdCRyxJQUFBQSxXQUFXLEVBQUUsdUJBQU07QUFDakIsVUFBSUMsR0FBRyxHQUFHTixRQUFRLENBQUNPLGFBQVQsQ0FBdUIsR0FBdkIsQ0FBVjtBQUNBRCxNQUFBQSxHQUFHLENBQUNFLFNBQUosR0FBZ0Isd0JBQWhCO0FBQ0FGLE1BQUFBLEdBQUcsQ0FBQ0csU0FBSixHQUFnQixLQUFoQjtBQUNBSCxNQUFBQSxHQUFHLENBQUNJLGdCQUFKLENBQXFCLE9BQXJCLEVBQThCLFVBQUNDLEdBQUQsRUFBUztBQUNyQ0EsUUFBQUEsR0FBRyxDQUFDQyxjQUFKO0FBQ0QsT0FGRDtBQUdBLGFBQU9OLEdBQVA7QUFDRDtBQVg0QixHQUFmLENBQWhCOztBQWNBLE1BQU1PLFlBQVksR0FBRyxTQUFmQSxZQUFlLENBQUNDLEdBQUQsRUFBUztBQUM1QkEsSUFBQUEsR0FBRyxHQUFHQSxHQUFHLEdBQUcsRUFBWjtBQUNBLFdBQU9BLEdBQUcsQ0FBQ0MsT0FBSixDQUFZLHlCQUFaLEVBQXVDLEdBQXZDLENBQVA7QUFDRCxHQUhEOztBQUtBLE1BQU1DLFNBQVMsR0FBRyxTQUFaQSxTQUFZLENBQUNDLEdBQUQsRUFBUztBQUN6QixRQUFNQyxLQUFLLEdBQUdELEdBQUcsQ0FBQ2hCLGFBQUosa0JBQW1Da0IsS0FBbkMsSUFBNEMsQ0FBMUQ7QUFDQSxRQUFNQyxLQUFLLEdBQUdILEdBQUcsQ0FBQ2hCLGFBQUosa0JBQW1Da0IsS0FBbkMsSUFBNEMsQ0FBMUQ7QUFDQUYsSUFBQUEsR0FBRyxDQUFDaEIsYUFBSixDQUFrQixlQUFsQixFQUFtQ2tCLEtBQW5DLEdBQTJDRCxLQUFLLEdBQUdFLEtBQW5EO0FBQ0QsR0FKRDs7QUFNQSxNQUFNQyxRQUFRLEdBQUcsU0FBWEEsUUFBVyxHQUFNO0FBQ3JCLFFBQU1DLEtBQUssR0FBR3RCLFFBQVEsQ0FBQ3VCLGdCQUFULENBQTBCLGVBQTFCLENBQWQ7QUFDQSxRQUFJQyxRQUFRLEdBQUcsQ0FBZjtBQUNBRixJQUFBQSxLQUFLLENBQUNHLE9BQU4sQ0FBYyxVQUFDQyxDQUFELEVBQU87QUFDbkJGLE1BQUFBLFFBQVEsSUFBSSxDQUFDRSxDQUFDLENBQUNQLEtBQWY7QUFDRCxLQUZEO0FBR0FuQixJQUFBQSxRQUFRLENBQUNDLGFBQVQsQ0FBdUIsY0FBdkIsRUFBdUMwQixXQUF2QyxHQUFxRGQsWUFBWSxDQUFDVyxRQUFELENBQWpFO0FBQ0QsR0FQRDs7QUFTQSxTQUFPO0FBQ0xYLElBQUFBLFlBQVksRUFBWkEsWUFESztBQUVMRyxJQUFBQSxTQUFTLEVBQVRBLFNBRks7QUFHTEssSUFBQUEsUUFBUSxFQUFSQTtBQUhLLEdBQVA7QUFLRCxDQTlDRCIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGNvbW1vbiA9ICgpID0+IHtcclxuXHJcbiAgLy8gc2V0IGRhdGVwaWNrZXJcclxuICBjb25zdCBzdGFydERhdGUgPSBuZXcgTGl0ZXBpY2tlcih7XHJcbiAgICBlbGVtZW50OiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc3RhcnREYXRlJyksXHJcbiAgICBzdGFydERhdGU6IG5ldyBEYXRlKCksXHJcbiAgfSk7XHJcbiAgY29uc3QgZW5kRGF0ZSA9IG5ldyBMaXRlcGlja2VyKHtcclxuICAgIGVsZW1lbnQ6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNlbmREYXRlJyksXHJcbiAgICBsb2NrRGF5czogW1tuZXcgRGF0ZSgwKSwgbmV3IERhdGUoKV1dLFxyXG4gICAgcmVzZXRCdXR0b246ICgpID0+IHtcclxuICAgICAgbGV0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgICAgYnRuLmNsYXNzTGlzdCA9ICdidG4gYnRuLXByaW1hcnkgYnRuLXNtJztcclxuICAgICAgYnRuLmlubmVyVGV4dCA9ICflvoXnorroqo0nO1xyXG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZ0KSA9PiB7XHJcbiAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gYnRuO1xyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgY29uc3Qgc2V0TnVtRm9ybWF0ID0gKG51bSkgPT4ge1xyXG4gICAgbnVtID0gbnVtICsgJyc7XHJcbiAgICByZXR1cm4gbnVtLnJlcGxhY2UoL1xcQig/PSg/OlxcZHszfSkrKD8hXFxkKSkvZywgJywnKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzZXRBbW91bnQgPSAocm93KSA9PiB7XHJcbiAgICBjb25zdCBwcmljZSA9IHJvdy5xdWVyeVNlbGVjdG9yKGBbbmFtZSo9cHJpY2VdYCkudmFsdWUgfHwgMDtcclxuICAgIGNvbnN0IGNvdW50ID0gcm93LnF1ZXJ5U2VsZWN0b3IoYFtuYW1lKj1jb3VudF1gKS52YWx1ZSB8fCAxO1xyXG4gICAgcm93LnF1ZXJ5U2VsZWN0b3IoJ1tuYW1lPWFtb3VudF0nKS52YWx1ZSA9IHByaWNlICogY291bnQ7XHJcbiAgfTtcclxuXHJcbiAgY29uc3Qgc2V0VG90YWwgPSAoKSA9PiB7XHJcbiAgICBjb25zdCB0b3RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tuYW1lPWFtb3VudF0nKTtcclxuICAgIGxldCBnZXRUb3RhbCA9IDA7XHJcbiAgICB0b3RhbC5mb3JFYWNoKChlKSA9PiB7XHJcbiAgICAgIGdldFRvdGFsICs9ICtlLnZhbHVlO1xyXG4gICAgfSk7XHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdG90YWwtcHJpY2UnKS50ZXh0Q29udGVudCA9IHNldE51bUZvcm1hdChnZXRUb3RhbCk7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIHNldE51bUZvcm1hdCxcclxuICAgIHNldEFtb3VudCxcclxuICAgIHNldFRvdGFsLFxyXG4gIH07XHJcbn07XHJcbiJdLCJmaWxlIjoiY29tbW9uLmpzIn0=
