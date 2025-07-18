const Cart= require("../models/cartModel");
const Address = require("../models/addressModel");
const Book = require("../models/productModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const crypto = require("crypto");
const PDFDocument = require('pdfkit');

// const processCheckout = async (req, res) => {
//   console.log("checkout controll worki ng")
//     const userId = req.session.user.id;
//   console.log(1)
//     if (!userId) {
//         return res.status(401).send('User not authenticated');
//     }
// console.log(2)
//     try {
//       console.log(3)
//         const cart = await Cart.findOne({ userId }).populate('items.productId');
//         if (!cart || cart.items.length === 0) {
//             return res.status(400).send('No items in the cart');
//         }
// console.log(4)
//         let subtotal = 0;
//         const itemsToProcess = [];

//         const currentDate = new Date();
        
// console.log(5)
//         for (let item of cart.items) {
//           console.log("if for loop")
//             const product = item.productId;
 
//             if (!product) {
//                 return res.status(400).send(`Product not found for ID: ${item.productId}`);
//             }
//             if (product.stock < item.quantity) {
//                 return res.status(400).send(`Not enough stock for ${product.title}`);
//             }

//             subtotal += product.price * item.quantity;
//            console.log("product detail:",product.price,subtotal)
//             itemsToProcess.push({
//                 productId: product._id,
//                 quantity: item.quantity,
//                 isCancelled: false, // Default value for isCancelled
//                 titleAtOrder: product.title, // Snapshot of product title
//                 priceAtOrder: product.price, // Snapshot of product price
//             });

//             if (req.body.paymentMethod === 'cashOnDelivery') {
//                 product.stock -= item.quantity;
//                 await product.save();
//             }
            
//         }
// console.log(6)
              
//         const totalDiscount = 15;
//         const shippingCost = subtotal > 25 ? 0 : 5;
//         const total = subtotal - totalDiscount + shippingCost;
        
//         let address;
//         if (req.body.selectedAddress) {
//             address = await Address.findById(req.body.selectedAddress);
//             if (!address) {
//                 return res.status(400).send('Selected address not found');
//             }
//         } else {
//             address = new Address({
//                 userId,
//                 fullName: req.body.fullName,
//                 street: req.body.street,
//                 city: req.body.city,
//                 state: req.body.state,
//                 country: req.body.country,
//                 postalCode: req.body.postalCode,
//                 isDefault: false
//             });
//             console.log(7)
//             await address.save();
//         }
//       console.log("items to process: ",itemsToProcess)
//         const newOrder = new Order({
//             userId,
//             items: itemsToProcess,
            
//             address: {
//              fullName: selectedAddress.name,
//              street: selectedAddress.address,
//              city: selectedAddress.city,
//              state: selectedAddress.state,
//              country: selectedAddress.state, // or use "India"
//              postalCode: selectedAddress.pincode,
//             },
//             paymentMethod: req.body.paymentMethod,
//             subtotal,
//             discount: totalDiscount,
//             shipping: shippingCost,
//             total,
//             status: 'pending',
//             paymentStatus: req.body.paymentMethod === 'razorpay' ? 'failed' : 'pending' // Set initial payment status
//         });

//         await newOrder.save();

       

//         await Cart.deleteOne({ userId });
      
//       return res.status(200).json({
//           success: true,
//           message: 'Order placed successfully',
//           orderId: newOrder.OrderId
//       });
    
//     } catch (error) {
//         console.error('Error during checkout:', error);
//         res.status(500).send('Internal server error');
//     }
// };



//render checkout
const renderCheckout = async (req, res) => {
  console.log("rendercheckot working")
  try {
    const userId = req.session.user.id;

  const cart = await Cart.findOne({ userId })
  .populate({
    path: "items.productId",
    model: "Book", 
  });

    if (!cart) {
      return res.redirect('/cart');
    }

    const items = cart.items
  .filter(item => item.productId) // Only include items with product data
  .map((item) => ({
    productId: item.productId._id,
    name: item.productId.title,
    imageUrl: item.productId.images?.[0] || "", // Fallback if no image
    price: item.productId.price || 0,
  
    quantity: item.quantity || 1,
    
  }));


    const cartTotal = Math.round(
      cart.items.reduce(
        (total, item) => total + item.productId.price * item.quantity,
        0
      )
    );

    const userAddresses = await Address.findOne({ userId });
    const addresses = userAddresses ? userAddresses.addresses : [];
    console.log(items);
    res.render("user/checkout", {
      items,
      cartTotal,
      addresses,
      userId,
    });
  } catch (error) {
    console.error("Error during rendering checkout page:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//add new address
const addNewAddress = async (req, res) => {
  console.log(1)
  try {
    const {
      name,
      phone,
      pincode,
      locality,
      city,
      state,
      address,
      landmark,
      alternatePhone,
    } = req.body;
    const userId = req.session.user?.id;
console.log(2)
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user." });
    }
console.log(3)
    let userAddress = await Address.findOne({ userId });
console.log(4)
    if (!userAddress) {
      userAddress = new Address({
        userId,
        addresses: [],
      });
    }
console.log(5)
    const newAddress = {
      name,
      phone,
      pincode,
      locality,
      city,
      state,
      address,
      landmark,
      alternatePhone,
    };
console.log(6)
    userAddress.addresses.push(newAddress);
    await userAddress.save();
    console.log(7)
console.log("Received address body:", req.body);
    console.log("User address after saving:", userAddress);
    res.status(201).json({
      success: true,
      address: userAddress.addresses[userAddress.addresses.length - 1],
    });
    console.log(8)
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};
const placeCODOrder = async (req, res) => {
  console.log("cod controller working");
  try {
    const addressId = req.body.addressId;
    const userId = req.session.user.id;

    if (!userId) {
      return res.status(401).send("User not authenticated");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).send("No items in the cart");
    }

    let subtotal = 0;
    const itemsToProcess = [];

    for (let item of cart.items) {
      const product = item.productId;
      subtotal += product.price * item.quantity;

      // Decrease stock
      if (product.stock < item.quantity) {
        return res.status(400).send(`${product.title} is out of stock`);
      }
      product.stock -= item.quantity;
      await product.save();

      itemsToProcess.push({
        productId: product._id,
        quantity: item.quantity,
        titleAtOrder: product.title,
        priceAtOrder: product.price,
      });
    }

    // Apply shipping only if subtotal is less than ₹1000
    const shipping = subtotal < 1000 ? 99 : 0;
    const total = subtotal + shipping;

    // Get address
    const userAddress = await Address.findOne({ userId });
    let selectedAddress;

    if (addressId) {
      selectedAddress = userAddress?.addresses.id(addressId);
    } else {
      // fallback to default address
      selectedAddress = userAddress?.addresses.find(addr => addr.isDefault === true);
    }

    if (!selectedAddress) {
      return res.status(400).send("No address found");
    }

    const newOrder = new Order({
      userId,
      items: itemsToProcess,
      subtotal,
      shipping,
      total,
      discount: 0,
      paymentMethod: "cashOnDelivery",
      address: {
        fullName: selectedAddress.name,
        street: selectedAddress.address,
        city: selectedAddress.city,
        state: selectedAddress.state,
        country: selectedAddress.state,
        postalCode: selectedAddress.pincode,
      },
      status: "pending",
      paymentStatus: "pending",
    });

    await newOrder.save();
    await Cart.deleteOne({ userId });

    res.json({ success: true, orderStatus: "created", orderId: newOrder.OrderId });

  } catch (err) {
    console.error("Error placing COD order:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



//order success
const orderSuccess = async (req, res) => {
  console.log("order success controll working")
  const orderId = req.query.orderId; 
   console.log('orderId:',orderId)
  if (!orderId) {
    return res.status(400).send("Order ID is missing");
  }
 
  // Render the EJS template with the orderId
  res.render("user/orderSuccess", { orderId });
};

//order failed
const orderFailed = async (req, res) => {
  const orderId = req.query.orderId;

  if (!orderId) {
    return res.status(400).send("Order ID is missing");
  }

  // Render the EJS template with the orderId
  res.render("user/orderFailed", { orderId });
};
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    console.log("Order ID:", orderId, "User ID:", userId);

    // Find the order
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Check if the order is cancellable
    if (order.status !== "pending") {
      return res.json({ success: false, message: "Order cannot be cancelled" });
    }

    // Update the order status
    order.status = "cancelled";
    order.updatedAt = new Date();
    await order.save();

    // Refund the stock
    for (const item of order.items) {
      const product = await Book.findById(item.productId);
      product.stock += item.quantity;
      await product.save();
    }

    return res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.json({ success: false, message: "Server error" });
  }
};

//return order
const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    const reason = req.body.reason
    console.log("Order ID:", orderId, "User ID:", userId);

    // Find the order
    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Check if the order is returnable
    if (order.status !== "delivered" || order.status === "returned") {
      return res.json({ success: false, message: "Order cannot be returned" });
    }
    
    order.status = 'returnRequested'
    order.returnStatus='requested'
    order.returnReason=reason
    order.updatedAt = new Date();
    await order.save();

    return res.json({ success: true, message: "Order returned successfully" });

  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
    
  }
}
 
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
      .text("Thank you for shopping with MILU BOOKS!", leftMargin, footerY + 15, {
        width: contentWidth,
        align: "center",
      })
      .text("Contact us at support@milubooks.com", leftMargin, footerY + 30, {
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

module.exports = {
  //processCheckout,
  renderCheckout,
  addNewAddress,
  cancelOrder,
  returnOrder,
  orderSuccess,
  orderFailed,
 placeCODOrder,
  getInvoice,

};