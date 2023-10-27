const fs = require("fs");
const PDFDocument = require("pdfkit");
const pt = require("path")


async function generateInvoicePdf(invoice, path, done, res) {
    return new Promise((resolve, reject) => {
        let doc = new PDFDocument({ size: "A4", margin: 50 });

        console.log(invoice);
        generateHeader(doc);
        generateCustomerInformation(doc, invoice);
        generateInvoiceTable(doc, invoice);

        const outStream = fs.createWriteStream(path)

        doc.pipe(outStream);
        doc.end();
        outStream.on('finish', () => {
            console.log("finis");
            resolve(true)
        })
    })
}

function generateHeader(doc) {
    doc
        .image("logo.png", 50, 45, { width: 220 })
        .fillColor("#444444")
        .fontSize(30)
        .font("Helvetica-Bold")
        .text("Invoice", 440, 55)
        // .fontSize(10)
        // // .text("Bretigny-Sur-Orges 91220", 200, 65, { align: "right" })
        // // .text("France", 200, 80, { align: "right" })
        .moveDown();
}

function generateCustomerInformation(doc, invoice) {

    const customerInformationTop = 110;

    doc
        .fontSize(10)
        .text("Invoice no:", 50, customerInformationTop)
        .text(invoice.invoiceNumber, 150, customerInformationTop)
        .text("Transcation ID:", 50, customerInformationTop + 15)
        .text(invoice.transactionId, 150, customerInformationTop + 15)
        .font("Helvetica")
        .text("Invoice Date:", 50, customerInformationTop + 30)
        .text(formatDate(new Date()), 150, customerInformationTop + 30)
        .text("Balance Due:", 50, customerInformationTop + 45)
        .text(
            formatCurrency(invoice.coupen? 0 :invoice.subtotal - invoice.paid),
            150,
            customerInformationTop + 45
        )
        .image("mech_logo.png", 440, 80, {width: 120, align: "right" })
        // .text("Name:", 50, customerInformationTop + 45)
        //  .font("Helvetica-Bold")
        // .text(invoice.client.name, 150, customerInformationTop + 45)
        // .font("Helvetica")
        // .text(invoice.client.address, 300, customerInformationTop + 15)
        // .text(
        //     invoice.client.city +
        //     ", " +
        //     invoice.client.state +
        //     ", " +
        //     invoice.client.country,
        //     300,
        //     customerInformationTop + 30
        // )
        .moveDown();

    generateHr(doc, 175);
    doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Recipient details:", 50, 185)
        .font("Helvetica")
        .text(invoice.client.name, 50, 200)
        .text(invoice.client.email, 50, 215)
        .text(invoice.client.college, 50, 230)
        .text(invoice.client.phone, 50, 245)
        .font("Helvetica-Bold")
        .text("MECHNIDO", 490, 185)
        .font("Helvetica")
        .text("Coimbatore", 490, 200)
        .text("GSTIN No: 33ABKFM0821E1ZQ", 400, 215)
        .text("PAN No: ABKFM0821E", 440, 230)
        .text("Mail : support@mseed.in", 432, 245)

    generateHr(doc, 265);
}

function generateInvoiceTable(doc, invoice) {
    generateHr(doc, 285, 1.5, '#666666');
    let i;
    const invoiceTableTop = 295;
    const { client } = invoice;
    const { pricePerSession } = client;

    doc.font("Helvetica-Bold");
    generateTableRow(
        doc,
        invoiceTableTop,
        "Item",
        "HSN Code",
        "Unit",
        "Unit Price",
        "Total"
    );
    generateHr(doc, invoiceTableTop + 20, 1.5, '#666666');
    doc.font("Helvetica");

    for (i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(
            doc,
            position,
            item.item,
            item.hsncode,
            item.quantity,
            item.amount,
            formatCurrency(item.amount * item.quantity)
        );

        generateHr(doc, position + 20, 1.5, '#666666');
    }

    const subtotalPosition = invoiceTableTop + (i + 1) * 30;
    doc.font('Helvetica-Bold')
    generateTableRow(
        doc,
        subtotalPosition,
        "",
        "",
        "Subtotal",
        "",
        formatCurrency(invoice.subtotal)
    );

    const taxPos = subtotalPosition + 20;
    doc.font('Helvetica-Bold')
    generateTableRow(
        doc,
        taxPos,
        "",
        "",
        "Tax(18%)",
        "",
        formatCurrency(invoice.tax)
    );

    let flag = false
    const discount = taxPos + 20;
    if(invoice.coupen){
        flag = true
        generateTableRow(
            doc,
            discount,
            "",
            "",
            `discount ${invoice.discount}%`,
            "",
            formatCurrency(invoice.paid - invoice.discAm)
        );
    }

    const paidToDatePosition = flag? discount + 20: taxPos + 20;
    generateTableRow(
        doc,
        paidToDatePosition,
        "",
        "",
        "Paid To Date",
        "",
        formatCurrency(invoice.paid - invoice.discAm)
    );

    const duePosition = paidToDatePosition + 25;
    doc.font("Helvetica-Bold");
    generateTableRow(
        doc,
        duePosition,
        "",
        "",
        "Balance Due",
        "",
        formatCurrency(invoice.fullPay? 0 :invoice.subtotal - invoice.paid)
    );
    doc.font("Helvetica");
    doc.fillColor('#aaaaaa')
    .text("This is a system generated invoice and does not require a signature or a digital signature , India ", 50, duePosition + 100, {align: "center"})
}

function generateTableRow(
    doc,
    y,
    item,
    hsncode,
    unit,
    unitPrice,
    total
) {
    doc
        .fontSize(10)
        .text(item, 60, y)
        .text(hsncode, 210, y,  { width: 90, align: "right" })
        .text(unit, 280, y, { width: 90, align: "right" })
        .text(unitPrice, 370, y, { width: 90, align: "right" })
        .text(total, 0, y, {align: "right"});
}

function generateHr(doc, y, width=1, color="#aaaaaa") {
    doc
        .strokeColor(color)
        .lineWidth(width)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
}

function formatCurrency(val) {
    return (val).toFixed(2) + "\u20B9";
}

function formatDate(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return year + "/" + month + "/" + day;
}

module.exports = {
    generateInvoicePdf
};