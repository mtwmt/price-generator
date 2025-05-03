import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-quotation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quotation-modal.component.html',
})
export class QuotationModalComponent implements OnInit {
  @Input() data!: any;
  @Input() logo!: any;
  @Input() isPreview: boolean = false;

  isPrint = false;
  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {}

  onExportImage() {
    this.isPrint = true;
    const preview = document.getElementById('contentToConvert') as HTMLElement;

    const fileName = ''.concat(
      new Date().toLocaleString('roc', { hour12: false }),
      '_quotation.jpg'
    );

    html2canvas(preview)
      .then(function (canvas) {
        const img = new Image();
        img.src = canvas.toDataURL('image/jpeg');

        const link = document.createElement('a');
        link.href = img.src;
        link.download = fileName;
        link.click();
      })
      .then(() => {
        this.isPrint = false;
      });
  }

  onExportPdf() {
    this.isPrint = true;
    const preview = document.getElementById('contentToConvert') as HTMLElement;
    const fileName = ''.concat(
      new Date().toLocaleString('roc', { hour12: false }),
      '_quotation.pdf'
    );

    html2canvas(preview)
      .then(function (canvas) {
        // Few necessary setting options
        const imgWidth = 208;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const heightLeft = imgHeight;

        const contentDataURL = canvas.toDataURL('image/png');
        let pdf = new jsPDF('p', 'mm', 'a4'); // A4 size page of PDF
        const position = 0;
        pdf.addImage(contentDataURL, 'PNG', 0, position, imgWidth, imgHeight);
        pdf.save(fileName); // Generated PDF
      })
      .then(() => {
        this.isPrint = false;
      });
  }
}
