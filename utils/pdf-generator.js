const fs = require("fs");
const PDFDocument = require("pdfkit");
const pt = require("path")


async function generateInvoicePdf(invoice, path, done, res) {
    let doc = new PDFDocument({ size: "A4", margin: 50 });

    console.log(invoice);
    generateHeader(doc);
    generateCustomerInformation(doc, invoice);
    generateInvoiceTable(doc, invoice);

    const outStream = fs.createWriteStream(path)

    doc.pipe(outStream);
    doc.end();
        outStream.on('finish', ()=>{
            console.log("finis");
            done(res)
            
        })
}

function generateHeader(doc) {
    doc
        .image("logo.png", 50, 45, { width: 50 })
        .fillColor("#444444")
        .fontSize(20)
        .text("Idea", 110, 57)
        .fontSize(10)
        // .text("Bretigny-Sur-Orges 91220", 200, 65, { align: "right" })
        // .text("France", 200, 80, { align: "right" })
        .moveDown();
}

function generateCustomerInformation(doc, invoice) {
    doc
        .fillColor("#444444")
        .fontSize(20)
        .text("Invoice", 50, 160);

    generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
        .fontSize(10)
        .text("Invoice no:", 50, customerInformationTop)
        .font("Helvetica-Bold")
        .text(invoice.invoiceNumber, 150, customerInformationTop)
        .font("Helvetica")
        .text("Invoice Date:", 50, customerInformationTop + 15)
        .text(formatDate(new Date()), 150, customerInformationTop + 15)
        .text("Balance Due:", 50, customerInformationTop + 30)
        .text(
            formatCurrency(invoice.subtotal-invoice.paid),
            150,
            customerInformationTop + 30
        )
        .text("Name:", 50, customerInformationTop + 45)
         .font("Helvetica-Bold")
        .text(invoice.client.name, 150, customerInformationTop + 45)
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

    generateHr(doc, 262);
}

function generateInvoiceTable(doc, invoice) {
    let i;
    const invoiceTableTop = 330;
    const { client } = invoice;
    const { pricePerSession } = client;

    doc.font("Helvetica-Bold");
    generateTableRow(
        doc,
        invoiceTableTop,
        "Item",
        "Description",
        "Cost",


    );
    generateHr(doc, invoiceTableTop + 20);
    doc.font("Helvetica");

    for (i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i];
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(
            doc,
            position,
            item.item,
            item.description,
            formatCurrency(item.amountSum)
        );

        generateHr(doc, position + 20);
    }

    const subtotalPosition = invoiceTableTop + (i + 1) * 30;
    generateTableRow(
        doc,
        subtotalPosition,
        "",
        "",
        "Subtotal",
        "",
        formatCurrency(invoice.subtotal)
    );

    const paidToDatePosition = subtotalPosition + 20;
    generateTableRow(
        doc,
        paidToDatePosition,
        "",
        "",
        "Paid To Date",
        "",
        formatCurrency(invoice.paid)
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
        formatCurrency(invoice.subtotal - invoice.paid)
    );
    doc.font("Helvetica");
}

function generateTableRow(
    doc,
    y,
    item,
    description,
    unitCost,
    quantity,
    lineTotal
) {
    doc
        .fontSize(10)
        .text(item, 50, y)
        .text(description, 150, y)
        .text(unitCost, 280, y, { width: 90, align: "right" })
        .text(quantity, 370, y, { width: 90, align: "right" })
        .text(lineTotal, 0, y, { align: "right" });
}

function generateHr(doc, y) {
    doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
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