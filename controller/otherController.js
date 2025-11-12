const PDFDocument = require('pdfkit');
const Order = require("../models/orderModel");

const generateInvoicePDF = async (
    order,
    res,
    companyInfo = {
      name: "SAF BOOKS",
      address: {
        street: "Coza Store Center", 
        city: "Bookmark",
        state: "Librain",
        postalCode: "45678",
        country: "New York",
      },
      phone: "+1 800 1236879",
      email: "saf@safbooks.com",
      website: "www.safbooks.com",
    }
  ) => {
    const doc = new PDFDocument({ margin: 50 });
  
    // Set headers to prompt download as a PDF
    res.setHeader("Content-Disposition", `attachment; filename="invoice_${order.OrderId}.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
  
    // Pipe PDF data directly to the response
    doc.pipe(res);
  
    // Define consistent positioning values
    const leftMargin = 50;
    const rightMargin = doc.page.width - 50;
    const contentWidth = rightMargin - leftMargin;
  
    const formatDate = (date) =>
      new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  
    const drawHorizontalLine = (y = doc.y) => {
      doc.strokeColor("#cccccc").lineWidth(1).moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
    };
  
    // 1. Header Section
    doc.image("company/company.png", leftMargin, 40, { width: 70 });
    doc.fontSize(18).font("Helvetica-Bold").text(companyInfo.name, leftMargin + 80, 45);
  
    doc.fontSize(10).text(`Order ID: ${order.OrderId}`, leftMargin + 80, 65);
    doc.text(`Date: ${formatDate(order.createdAt)}`, leftMargin + 80, 80);
  
    drawHorizontalLine(100);
  
    // 2. Company Information Section
    doc.fontSize(12).font("Helvetica-Bold").text("From:", leftMargin, 110);
    doc.fontSize(10).font("Helvetica").text(companyInfo.name, leftMargin, 130);
    doc.text(`${companyInfo.address.street}, ${companyInfo.address.city}`, leftMargin, 145);
    doc.text(`${companyInfo.address.state}, ${companyInfo.address.country}`, leftMargin, 160);
    doc.text(`Phone: ${companyInfo.phone}`, leftMargin, 175);
    doc.text(`Email: ${companyInfo.email}`, leftMargin, 190);
    doc.text(`Website: ${companyInfo.website}`, leftMargin, 205);
  
    // 3. Billing Address Section
    const addressX = 300;
    doc.fontSize(12).font("Helvetica-Bold").text("Billing Address:", addressX, 110);
    doc.fontSize(10).font("Helvetica").text(order.address.fullName, addressX, 120);
    doc.text(`${order.address.street}, ${order.address.city}`, addressX, 130);
    doc.text(`${order.address.state}`, addressX, 175);
    doc.text(`Pin: ${order.address.postalCode}`, addressX, 190);
  
    drawHorizontalLine(220);
  
    // 4. Order Items Section
    doc.fontSize(12).font("Helvetica-Bold").text("Order Items", leftMargin, 230);
  
    const colProduct = leftMargin;
    const colQuantity = 300;
    const colPrice = 370;
    const colTotal = 450;
  
    // Table headers
    doc.fontSize(10)
      .font("Helvetica-Bold")
      .text("Product", colProduct, 250)
      .text("Qty", colQuantity, 250)
      .text("Price", colPrice, 250)
      .text("Total", colTotal, 250);
  
    drawHorizontalLine(265);
  
    // Table content
    let yPosition = 275;
    order.items
  .filter(item => item.isCancelled === false)
  .forEach((item) => {
    const productName = item.productId.title;
    const unitPrice = item.productId.price;
    const quantity = item.quantity;
    const totalPrice = unitPrice * quantity;

    doc.fontSize(10).font("Helvetica")
      .text(productName, colProduct, yPosition, { width: 250 })
      .text(quantity.toString(), colQuantity, yPosition)
      .text(`₹${unitPrice.toFixed(2)}`, colPrice, yPosition)
      .text(`₹${totalPrice.toFixed(2)}`, colTotal, yPosition);

    yPosition += 20;
  });

  
    drawHorizontalLine(yPosition + 10);
  
    // 5. Summary Section
    const summaryStartY = yPosition + 30;
    const summaryLabelX = 350;
    const summaryValueX = 450;
  
    doc.fontSize(10)
      .font("Helvetica")
      .text("Subtotal:", summaryLabelX, summaryStartY)
      .text(`₹${order.subtotal.toFixed(2)}`, summaryValueX, summaryStartY);
  
    doc.text("Shipping:", summaryLabelX, summaryStartY + 20)
      .text(`₹${order.shipping || 0}`, summaryValueX, summaryStartY + 20);
  
    if (order.discount) {
      doc.text("Discount:", summaryLabelX, summaryStartY + 40)
        .text(`-₹${order.discount.toFixed(2)}`, summaryValueX, summaryStartY + 40);
    }
  
    drawHorizontalLine(summaryStartY + 60);
  
    // Final total calculation
    const finalTotal = order.total
    doc.fontSize(12)
      .font("Helvetica-Bold")
      .text("Total:", summaryLabelX, summaryStartY + 70)
      .text(`₹${finalTotal.toFixed(2)}`, summaryValueX, summaryStartY + 70);
  
    // 6. Footer Section
    const footerY = doc.page.height - 100;
    drawHorizontalLine(footerY);
  
    doc.fontSize(10)
      .font("Helvetica")
      .text("Thank you for shopping with SAF BOOKS!", leftMargin, footerY + 15, {
        width: contentWidth,
        align: "center",
      })
      .text("Contact us at saf@safbooks.com", leftMargin, footerY + 30, {
        width: contentWidth,
        align: "center",
      });
  
    // Finalize the document
    doc.end();
  };
  
  
  
  // Usage example
  const getInvoice = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId).populate('items.productId');
  
      if (!order) {
        return res.status(404).send("Order not found");
      }
  
      // Generate the PDF and send it directly in the response
      generateInvoicePDF(order, res);
    } catch (error) {
      console.error("Error generating invoice PDF:", error.message);
      res.status(500).send("Failed to generate invoice PDF.");
    }
  };

const contactPage = (req, res) => {
    res.render('user/contact')
}

const aboutPage = (req, res) => {
    res.render('user/about')
}

module.exports={
    getInvoice,
    contactPage,
    aboutPage,
}