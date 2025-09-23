const Cart= require("../models/cartModel");
const Address = require("../models/addressModel");
const Book = require("../models/productModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Coupon = require('../models/couponModel');
const Offer = require('../models/offerModel')
const Wallet =require('../models/walletModel')
const crypto = require("crypto");
const PDFDocument = require('pdfkit');
const Razorpay = require("razorpay");
require("dotenv").config();


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const processCheckout = async (req, res) => {
  console.log("checkout controll worki ng")
    const userId = req.session.user.id;
    const addressId = req.body.addressId;
  
    if (!userId) {
        return res.status(401).send('User not authenticated');
    }

    try {
      console.log(3)
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).send('No items in the cart');
        }

        let subtotal = 0;
        let offerDiscount = 0;
        const itemsToProcess = [];

        const currentDate = new Date();
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: currentDate },
            validUntil: { $gte: currentDate }
        });

        for (let item of cart.items) {
          console.log("if for loop")
            const product = item.productId;
 
            if (!product) {
                return res.status(400).send(`Product not found for ID: ${item.productId}`);
            }
            if (product.stock < item.quantity) {
                return res.status(400).send(`Not enough stock for ${product.title}`);
            }

            subtotal += product.price * item.quantity;
           console.log("product detail:",product.price,subtotal)
           for (let offer of offers) {
                const applicableProducts = offer.applicableProducts.map(id => id.toString());
                const applicableCategories = offer.applicableCategories.map(id => id.toString());

                if (
                    applicableProducts.includes(product._id.toString()) || 
                    applicableCategories.includes(product.categoryId.toString())
                ) {
                    offerDiscount += (product.price * item.quantity * offer.discount) / 100;
                }
            }
            itemsToProcess.push({
                productId: product._id,
                quantity: item.quantity,
                isCancelled: false, // Default value for isCancelled
                titleAtOrder: product.title, // Snapshot of product title
                priceAtOrder: product.price, // Snapshot of product price
            });

            if (req.body.paymentMethod === 'cashOnDelivery') {
                product.stock -= item.quantity;
                await product.save();
            }
            
        }


        let couponDiscount = 0
        if (req.body.couponCode){
           const coupon = await Coupon.findOne({ code: req.body.couponCode, isActive: true })
           if (coupon && currentDate >= coupon.validFrom && currentDate <= coupon.validUntil && subtotal >= coupon.minOrderValue){
               couponDiscount = (subtotal * coupon.discount) / 100;

               if (coupon.maxDiscountLimit && couponDiscount > coupon.maxDiscountLimit) {
                  couponDiscount = coupon.maxDiscountLimit;
                }

               if (couponDiscount > subtotal / 2) {
                  couponDiscount = subtotal / 2;
                }
           }
        }



              
        const totalDiscount=offerDiscount+ couponDiscount;
        const shippingCost = subtotal > 1000 ? 0 : 99;
        const total = subtotal - totalDiscount + shippingCost;


         const userAddress = await Address.findOne({ userId });
         let selectedAddress = userAddress?.addresses.id(addressId);
         console.log("address",selectedAddress)
     
         if (!selectedAddress) {
              return res.status(400).send("No address found");
           }
        

       
      console.log("items to process: ",itemsToProcess)
        const newOrder = new Order({
            userId,
            items: itemsToProcess,
            
            address: {
             fullName: selectedAddress.name,
             street: selectedAddress.address,
             city: selectedAddress.city,
             state: selectedAddress.state,
             country: selectedAddress.state, // or use "India"
             postalCode: selectedAddress.pincode,
            },
            paymentMethod: req.body.paymentMethod,
            subtotal,
            discount: totalDiscount,
            shipping: shippingCost,
            total,
            status: 'pending',
            paymentStatus: req.body.paymentMethod === 'razorpay' ? 'failed' : 'pending' // Set initial payment status
        });

        await newOrder.save();

         const razorpayOrderOptions = {
            amount: total * 100, // Amount is in paise
            currency: 'INR',
            receipt: newOrder._id.toString(),
        };

        const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);
        newOrder.razorpayOrderId = razorpayOrder.id;
        await newOrder.save();



        await Cart.deleteOne({ userId });
      
     
      res.json({
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            orderStatus: 'created',
        });
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).send('Internal server error');
    }
};



//render checkout
const renderCheckout = async (req, res) => {
 
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
const getCartItems = async (req, res) => {
    const userId = req.session.user?.id;
    console.log('userId from',userId)

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length==0) {
            return req.xhr ? res.json({ redirect: '/cart', items: [] })
            :res.render('user/cart', { items: [] ,errorMessage:null,outOfStockItems:[]});
        }

        const outOfStockItems = [];
        let stockError = false;
        for (let item of cart.items) {
            if (item.productId.stock < item.quantity) {
                stockError = true;
                outOfStockItems.push({
                    name: item.productId.title,
                    availableStock: item.productId.stock,
                    requestedQuantity: item.quantity,
                    productId: item.productId._id,
                });
            }
        }

        if(stockError){
            return req.xhr ?
              res.json({ stockError: true, outOfStockItems }) 
            : res.render('user/cart', { stockError: true, outOfStockItems:[],errorMessage:null})
        }
      const cartTotal = Math.round(
                             cart.items.reduce(
                                 (total, item) => total + item.productId.price * item.quantity,0)
      );
      // **Apply Offer Logic**
        let offerDiscount = 0;
        const currentDate = new Date();
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: currentDate },
            validUntil: { $gte: currentDate },
        });

        for (let offer of offers) {
            const applicableProducts = offer.applicableProducts.map((id) => id.toString());
            const applicableCategories = offer.applicableCategories.map((id) => id.toString());
            for (let item of cart.items) {
                const product = item.productId;

                if (
                    applicableProducts.includes(product._id.toString()) ||
                    applicableCategories.includes(product.categoryId.toString())
                ) {
                    offerDiscount += (product.price * item.quantity * offer.discount) / 100;
                }
            }
        }
        //const additionalFee = cartTotal < 1000 ? 99 : 0;
        const total = cartTotal - offerDiscount //+ additionalFee;

      
  
    const userAddresses = await Address.findOne({ userId });
    const addresses = userAddresses ? userAddresses.addresses : [];
        const items = cart.items.map(item => {
            return {
                productId: item.productId._id,
                name: item.productId.title,
                imageUrl: item.productId.images[0], 
                price: item.productId.price,
                quantity: item.quantity,
                 
            };
        })
        if(req.xhr){
          return res.json({
                stockError: false,
                items,
                errorMessage: null,
                userId,
                cartTotal,
                offerDiscount,
                addresses,
                total

            });
        }else{
          res.render('user/checkout', { items,errorMessage:null,cartTotal,offerDiscount,total,userId,addresses });
        }
        
    } catch (error) {
        console.log(error);
        res.status(500).send('Error fetching cart');
    }
};
const validateCoupon = async (req, res) => {
    const { couponCode, subtotal } = req.body;
    const userId = req.session.user?.id;
    try {
        const coupon = await Coupon.findOne({ code: couponCode, isActive: true ,$or: [{ userId: userId }, { userId: null }],});

        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon' });
        }

        const currentDate = new Date();
        if (currentDate < coupon.validFrom || currentDate > coupon.validUntil) {
            return res.status(400).json({ message: 'Coupon is not valid at this time' });
        }

        if (subtotal < coupon.minOrderValue) {
            return res.status(400).json({ message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}` });
        }

        if (coupon.isFirstOrder) {
            const orderCount = await Order.countDocuments({ userId });
            if (orderCount > 0) {
                return res.status(400).json({ message: 'Coupon valid only for your first order' });
            }
        }

        // Calculate discount
        let discount = (subtotal * coupon.discount) / 100;
        if (coupon.maxDiscountLimit && discount > coupon.maxDiscountLimit) {
            discount = coupon.maxDiscountLimit;
        }
      

        let discountedTotal=subtotal-discount
        discountedTotal=Math.round(discountedTotal)

        coupon.usageLimit -= 1;
        if (coupon.usageLimit <= 0) {
            coupon.isActive = false;
        }
        await coupon.save();

        res.json({ discountedTotal, discount, message: 'Coupon applied successfully' });
    } catch (error) {
        console.error('Error validating coupon:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
const getAvailableCoupons = async (req, res) => {
  const userId = req.session.user?.id;
  
    try {
      const currentDate = new Date();
      const orderCount = await Order.countDocuments({ userId });

        const coupons = await Coupon.find({ isActive: true,
          validFrom: { $lte: currentDate },
          validUntil: { $gte: currentDate },
          $or: [{ userId: userId }, { userId: null }],
          ...(orderCount > 0 ? { isFirstOrder: { $ne: true } } : {})
         });

        if (!coupons || coupons.length === 0) {
            return res.status(404).json({ message: 'No coupons available' });
        }

        

        const availableCoupons = coupons.map(coupon => ({
            code: coupon.code,
            description: `${coupon.discount}% OFF - Min Order ₹${coupon.minOrderValue} `,                       
            // minOrderValue: coupon.minOrderValue,
            // isFirstOrder: coupon.isFirstOrder,
            userId: coupon.userId ? coupon.userId : null
        }));
        console.log('Available coupons for user:', { userId, coupons: availableCoupons, sessionId: req.sessionID });


        res.json({ coupons: availableCoupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
//add new address
const addNewAddress = async (req, res) => {
  
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

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user." });
    }

    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({
        userId,
        addresses: [],
      });
    }

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

    userAddress.addresses.push(newAddress);
    await userAddress.save();
    

   
    res.status(201).json({
      success: true,
      address: userAddress.addresses[userAddress.addresses.length - 1],
    });
   
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Validation error." });
  }
};
const placeCODOrder = async (req, res) => {
  
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

//verfyPayment
const verifyPayment = async (req, res) => {
    console.log("verify payment")
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify the payment signature
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');
 
    if (generatedSignature === razorpay_signature) {
        try {
          
            // Find the order using the Razorpay order ID
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
           
            if (!order) {
                return res.status(404).send('Order not found');
            }

            order.status = 'paid';  
            order.razorpayPaymentId = razorpay_payment_id;  
            order.razorpaySignature = razorpay_signature;  
            order.paymentStatus = 'paid';  
            await order.save();  

            for (let item of order.items) {
                const product = await Book.findById(item.productId);
                
                if (product) {
                    product.stock -= item.quantity;
                    await product.save();  // Save the updated product
                }
            }

            return res.json({
                message: 'Payment verified successfully, order is now paid.',
                orderId: order._id,
                status: order.status
            });
            
        } catch (error) {
            console.error('Error updating order status:', error);
            return res.status(500).send('Internal server error');
        }
    } else {
        // If the payment signature does not match, return an error
        return res.status(400).send('Payment verification failed');
    }
};

//order success
const orderSuccess = async (req, res) => {
  
  const orderId = req.query.orderId; 
  
  if (!orderId) {
    return res.status(400).send("Order ID is missing");
  }
 
  // Render the EJS template with the orderId
  res.render("user/orderSuccess", { orderId });
};
//paymentFailed
const paymentFailed = async (req, res) => {
    try {
    res.render('user/paymentFailed');
    } catch (er)
    {
        console.log('error',er);   
    }
}

const retryPayment = async (req, res) => {
  
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        
        // Assuming `razorpayOrderId` and `amount` are saved with the order
        res.json({
            orderId: order.razorpayOrderId,
            amount: order.total * 100, // Amount in smallest currency unit
            currency: 'INR'
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Error fetching order details");
    }
}

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
  console.log('return order controller')
  try {
    const { orderId } = req.params;
    const userId = req.session.user.id;
    const reason = req.body.reason;
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
    order.returnReason=reason;
    order.returnedAt=new Date()
    order.updatedAt = new Date();
    await order.save();
    
    return res.json({ success: true, message: "Order returned successfully" });

  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
    
  }
}
const returnItem = async (req,res)=>{
  console.log('return item controller')
  const { orderId, productId } = req.params;
    const { reason } = req.body; // Reason captured from the form

    try {
        const order = await Order.findById(orderId).populate('items.productId');
        
            console.log('Requested productId:', productId, typeof productId);
    console.log('Order Items:', order.items.map(item => ({
      productId: item.productId._id,
      stringified: item.productId._id.toString(),
      title: item.titleAtOrder
    })));
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (order.status !== 'delivered') return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' })
        
        const returnItem=order.items.find(item => item.productId._id.toString() === productId)
        console.log('items is',returnItem)

        if(!returnItem)return res.status(404).json({ success: false, message: 'Product not found in this order' });
        if(returnItem.isReturned)return res.status(400).json({ success: false, message: 'Product has already been returned' });

        order.status = 'returnRequested';
        returnItem.returnReason=reason;
        returnItem.returnStatus='requested';
        returnItem.returnedAt=new Date()
       

         
       await order.save();
    
        return res.json({ success: true, message: "Order returned successfully" });
    }catch(err){
        console.error("Error processing return request:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}
const cancelItem=async (req,res)=>{
     const {orderId,productId}=req.params
     try{
         const order=await Order.findById(orderId).populate('items.productId');
          if (!order) {
                return res.status(404).send('Order not found');
          }
          const cancelItem=order.items.find(item=>item.productId._id.toString()===productId)
          console.log(cancelItem)
          if(!cancelItem){
            return res.status(404).send('product not found in order')
          }


          cancelItem.isCancelled=true
          cancelItem.cancelledAt=new Date()

          await Book.findByIdAndUpdate(productId,{
            $inc:{stock:cancelItem.quantity}
          })
          const originalSubtotal = order.items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
          const originalDiscount = order.discount || 0;
          const discountPercentage = originalDiscount / originalSubtotal;

        const subtotalUpdate=order.items.reduce((sum,item)=>{
          if(!item.isCancelled){
            return sum+=item.priceAtOrder*item.quantity;
          }
          return sum
        },0)
        const updatedDiscount = subtotalUpdate * discountPercentage;
        const totalUpdate=Math.max(0,subtotalUpdate+order.shipping-order.updatedDiscount)

        order.subtotal=subtotalUpdate
        order.discount = updatedDiscount
        order.total=totalUpdate

        if(order.items.every(item=>item.isCancelled)){
          order.status = 'cancelled'
          order.total = 0
          order.shipping=0
        }
         
         await order.save();

         if (order.paymentMethod !== 'cashOnDelivery') {
                const itemDiscount = (cancelItem.priceAtOrder * cancelItem.quantity / originalSubtotal) * originalDiscount;
                const refundAmount = cancelItem.priceAtOrder * cancelItem.quantity - itemDiscount;

                let wallet = await Wallet.findOne({ userId: order.userId });
                if (!wallet) {
                    wallet = await Wallet.create({ userId: order.userId });
                }

                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    transactionType: 'credit',
                    orderId: orderId,
                    message: `Credited for canceled product '${cancelItem.titleAtOrder}'`
                });

                await wallet.save();
            }

          return res.json({ success: true, message:'order cancelled successfully'})
     }catch(err){
        console.error(err);
        res.status(500).send('Server error');
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

module.exports = {
  processCheckout,
  renderCheckout,
  validateCoupon,
  getAvailableCoupons,
  addNewAddress,
  cancelOrder,
  returnOrder,
  returnItem,
  cancelItem,
  verifyPayment,
  orderSuccess,
  paymentFailed,
  retryPayment,
  orderFailed,
  placeCODOrder,
  getInvoice,
  getCartItems
};