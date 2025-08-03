const User = require("../models/userModel");
const Book = require('../models/productModel'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path = require('path');
const upload = require('../config/multerConfig');
const mongoose = require("mongoose")
const fs = require('fs');
const Category = require('../models/categoryModel');
const Order=require('../models/orderModel')
const  PDFDocument  = require('pdfkit');
const Admin = require("../models/adminModel")

//login page

const login = (req, res) => {
    try {
        res.render("admin/login", {error:""})
    } catch (error) {
        console.log("admin login broke",error)
    }
}

//get login details

const postLogin= async(req,res)=>{
    try {
        const { email, password } = req.body;
        
        const admin = await Admin.findOne({email});
       
        if(!admin){
            return res.render("admin/login", { error: "Admin not found" });
        }
        
        const isMatch = await bcrypt.compare(password, admin.password);
        
        if (!isMatch) {
          return res.render("admin/login", { error: "Invalid credentials" });
        }
    
        req.session.admin = true;
        res.redirect("/admin/home");
       
    } catch (error) {
        console.error('Login error:', error); 
        return res.render('admin/login', { error: 'An error occurred. Please try again.' });
    }
}



const renderDashboard = (req, res) => {
    try {
        res.render('admin/dashboard');
    } catch (error) {
        console.error("Error rendering dashboard page:", error);
        res.status(500).send("Failed to render dashboard page");
    }
};

// Function to get the bestseller books by calculating sales count manually
const getDashboardData = async (req, res) => {
    try {
        const period = req.query.period || 'monthly';
        let dateFilter;
 
        // Define date filter based on the selected period
        const now = new Date();
        switch (period) {
            case 'daily':
                dateFilter = { $gte: new Date(now.setDate(now.getDate() - 1)) };
                break;
            case 'weekly':
                dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
                break;
            case 'monthly':
                dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
                break;
            case 'yearly':
                dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
                break;
            default:
                dateFilter = {};
        }

        const deliveredFilter = { status: 'delivered' };

        const salesSummary = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            {
                $group: {
                    _id: null,
                    totalSalesCount: { $sum: { $size: "$items" } },
                    totalRevenue: { $sum: "$total" },
                    totalDiscount: { $sum: "$discount" }
                }
            }
        ]);

        const bestSellingProducts = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId", 
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'books',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    totalSold: 1,
                    name: { $ifNull: ["$productInfo.title", "Unknown Product"] },
                    productId: { $toString: "$_id" }
                }
            }
        ]);

        const bestSellingCategories = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: 'books',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: "$productInfo" },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productInfo.categoryId',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $group: {
                    _id: "$categoryInfo.name",
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 0,
                    categoryName: "$_id",
                    totalSold: 1
                }
            }
        ]);

        const dailyRevenue = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalRevenue: { $sum: "$total" }
                }
            },
            { $sort: { "_id": 1 } } // Sort by date
        ]);

        const totalUsers = await User.countDocuments();

        res.json({
            salesSummary: salesSummary[0] || { totalSalesCount: 0, totalRevenue: 0, totalDiscount: 0 },
            bestSellingProducts,
            bestSellingCategories,
            totalUsers,
            dailyRevenue
        });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
};


//  users 
const adminUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = 5; 
        const skip = (page - 1) * limit; 

        const totalUsers = await User.countDocuments({ isAdmin: false });

       
        const userData = await User.find({ isAdmin: false })
                                   .skip(skip)
                                   .limit(limit);
        const totalPages = Math.ceil(totalUsers / limit);

       
        res.render('admin/users', {
            users: userData,
            currentPage: page,   
            totalPages: totalPages 
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('An error occurred');
    }
};

// Block user
const blockUser = async (req, res) => {
    try {
        const { userId } = req.body;  

        if (!userId) {
            console.error('User ID is missing!'); 
            return res.status(400).send('User ID is required');
        }

        await User.findByIdAndUpdate(userId, { isBlocked: true });
        req.session.user=null
        res.redirect('/admin/users');  
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).send('Server Error');
    }
};

// Unblock user
const unblockUser = async (req, res) => {
    try {
        const { userId } = req.body; 
        if (!userId) {
            console.error('User ID is missing!'); 
            return res.status(400).send('User ID is required');
        }

        await User.findByIdAndUpdate(userId, { isBlocked: false });

        res.redirect('/admin/users'); 
    } catch (error) {
        console.log('Error unblocking user:', error);
        res.redirect('/admin/users'); 
    }
};


// Add books
const addBooks = async (req, res) => {
    try { 
        const { title, author, description, price, stock, categoryId } = req.body;
        const images = req.files;
        

        if (!title || !author || !description || !price || !stock || !categoryId) {
            
            return res.redirect('/admin/products?error=All fields are required');
        }
      
        if (isNaN(price) || Number(price) <= 0) {
            
            return res.redirect('/admin/products?error=Price must be a positive number');
        }
        

        if (isNaN(stock) || Number(stock) < 0) {
          
            return res.redirect('/admin/products?error=Stock must be a non-negative number');
        }
      
        if (!images || images.length === 0) {
            
            return res.redirect('/admin/products?error=No Image Uploaded');
        }
       

        const existingBook = await Book.findOne({ title });
        if (existingBook) {
          
            return res.status(409).json({ message: 'Book with this title already exists.' });
        }
        

        const newBook = new Book({
            title,
            author,
            description,
            price,
            stock,
            images: images.map(img => img.filename),
            categoryId,
        });
        

        await newBook.save();
        

        res.redirect('/admin/products?message=Book Added');
    } catch (error) {
        console.error('Error adding book:', error);
        res.redirect('/admin/products?error=Error Adding Book');
    }
};
   
    
    //show books
    const getBooks = async (req, res) => {
        
        try {
            const { message , error} = req.query;
    
            const page = parseInt(req.query.page) || 1; 
            const limit = parseInt(req.query.limit) || 5; 
            const skip = (page - 1) * limit; 

            const books = await Book.find({})
                .populate('categoryId')  
                .skip(skip)
                .limit(limit)
            .sort({ createdAt: -1 });
    
            const totalBooks = await Book.countDocuments({ });
            const totalPages = Math.ceil(totalBooks / limit); 
            
            res.render('admin/products', {
                books,
                message,
                error,
                currentPage: page,
                totalPages,
                limit,
                categories: await Category.find({  }) 
            });
            
        } catch (error) {
            console.error('Error fetching books:', error);
            res.status(500).send('Error fetching books');
        }
    };
    
  const editBooks = async (req, res) => {
  try {
    
    const { id, title, author, description, price, stock } = req.body;
    const images = req.files; 

    const book = await Book.findById(id);
    
    if (!book) {
      return res.redirect('/admin/products?error=Book Not Found');
      
    }

    // Update basic fields
    book.title = title || book.title;
    book.author = author || book.author;
    book.description = description || book.description;
    book.price = price || book.price;
    book.stock = stock || book.stock;

    // Ensure 3 image slots
    if(images && images.length>0) {
        
      images.forEach((image,index)=>{
         if(image){
           
            const imagePath=path.join(__dirname, '../uploads', book.images[index])
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath)
              
            }
              book.images[index]=image.filename;
              
         }
      });
    }

    
    await book.save();
   
    res.redirect('/admin/products?message=Book Updated');
  } catch (error) {
    console.error('Error updating book:', error);
    res.redirect('/admin/products?error=Error updating book');
  }
};

    
//soft delete book
const deleteBook = async (req, res) => {
    
    try {
        
        const { bookId } = req.body;
        if (!bookId) {
          return res.render(  
            "admin/products?error=Book ID is required"
          );
        }
        await Book.findByIdAndUpdate(bookId, { isActive: false });
        res.redirect(
          "/admin/products?message=Category deleted successfully"
        );
      } catch (error) {
        console.error("Error deleting book:", error);
        res.render("admin/products?error=Error deleting book");
      }
};

const activeBook=async (req,res)=>{
     try {
         const { bookId } = req.body;
         if (!bookId) {
           return res.status(400).send("Book ID is required");
         }
         await Book.findByIdAndUpdate(bookId, { isActive: true });
         res.redirect(
           "/admin/products?message=Book activated successfully"
         );
       } catch (error) {
         console.error("Error activating book:", error);
         res.status(500).send("Server Error");
       }
}



const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query string
        const limit = 5; // Set the number of orders per page
        const skip = (page - 1) * limit; // Calculate the number of orders to skip

        const totalOrders = await Order.countDocuments(); // Get the total number of orders
        const orders = await Order.find()
            .populate('items.productId')
            .populate('userId')
            .limit(limit)
            .skip(skip) // Fetch the orders for the current page
            .sort({createdAt:-1})
        const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

       

        // Render the EJS view and pass the orders data, current page, and total pages
        res.render('admin/orders', { orders, currentPage: page, totalPages }); // Make sure 'admin/orders' matches your EJS view file
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
};

// Update order status
const orderStatus = async (req, res) => {
    console.log("working orderstatus")
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate the input status
    const validStatuses = [
      "pending",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status provided");
    }
    
    // Update the order in the database
    const updatedOrder = await Order.findById(id);

    if (!updatedOrder) {
      return res.status(404).send("Order not found");
    }
    
    //  all products have a valid name
    updatedOrder.items.forEach((product) => {
      if (!product.name) {
        product.name = product.productId
          ? product.productId.name
          : "Unknown Product";
      }
    });
    
    if (status === "delivered") {
      updatedOrder.paymentStatus = "paid";
    }

    updatedOrder.status = status;
    await updatedOrder.save();

    res.redirect("/admin/orders");
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).send("Internal Server Error");
  }
};
const getDeliveredSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to the first page
        const limit = 5; // Orders per page
        const skip = (page - 1) * limit;

        // Fetch the total count of delivered orders for pagination
        const totalOrders = await Order.countDocuments({ status: 'delivered' });
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch only delivered orders, populate userId to get the user's name, and apply pagination
        const deliveredOrders = await Order.find({ status: 'delivered' })
            .populate('userId', 'name') // Only populate the 'name' field from User
            .skip(skip)
            .limit(limit);

        // Pass orders data and pagination details to the EJS page
        res.render('admin/report', { 
            salesReports: deliveredOrders,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).send('Error fetching sales report');
    }
};
const getDateQuery = (reportType, startDate, endDate) => {
    const today = new Date();
    let dateQuery = {}; 
    let reportPeriodLabel = "";

    switch (reportType) {
        case "daily": {
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            dateQuery = { $gte: startOfDay, $lt: endOfDay };
            reportPeriodLabel = `Today (${startOfDay.toLocaleDateString()})`;
            break;
        }
        case "weekly": {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - 6);
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(today);
            endOfWeek.setHours(23, 59, 59, 999);

            dateQuery = { $gte: startOfWeek, $lt: endOfWeek };
            reportPeriodLabel = `This Week (${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()})`;
            break;
        }
        case "monthly": {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);

            dateQuery = { $gte: startOfMonth, $lt: endOfMonth };
            reportPeriodLabel = `This Month (${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()})`;
            break;
        }
        case "custom":
            if (!startDate || !endDate) throw new Error("Start date and end date are required for custom reports.");
            const start = new Date(startDate);
            const end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            dateQuery = { $gte: start, $lt: end };
            reportPeriodLabel = `Custom Range (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
            break;
        default:
            throw new Error("Invalid report type.");
    }

    return { dateQuery, reportPeriodLabel };
};

   


const downloadSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
       const { dateQuery, reportPeriodLabel } = getDateQuery(reportType, startDate, endDate);


        // Fetch delivered orders
        const orders = await Order.find({ status: "delivered", createdAt: dateQuery }).populate('userId');

        // Calculate summary data
        const totalOrders = orders.length;
        const totalIncome = orders.reduce((sum, order) => sum + order.total, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

        // Initialize PDF Document
        const doc = new PDFDocument({ margin: 50 });

        // Set Headers and Pipe Response
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="sales_report.pdf"');
        doc.pipe(res);

        // Color scheme
        const colors = {
            primary: "#3b45ff",
            headerText: "#ffffff",
            text: "#1f2937",
            border: "#cbd5e1",
            alternate: "#f1f5f9"
        };

        // Header
        doc.rect(0, 0, doc.page.width, 140).fill(colors.primary);

        doc.fontSize(20).font("Helvetica-Bold").fillColor(colors.headerText).text("SAF BOOKS XYZ Pvt Ltd", 50, 30, {
            width: doc.page.width - 100,
            align: "center"
        });

        doc.fontSize(28).font("Helvetica-Bold").fillColor(colors.headerText).text("Sales Report", 50, 60, {
            width: doc.page.width - 100,
            align: "center"
        });

        doc.fontSize(12)
            .font("Helvetica")
            .fillColor(colors.headerText)
            .text(`Report Period: ${reportPeriodLabel}`, 50, 100, { align: "center" })
            .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 120, { align: "center" });

        // Summary Section
        doc.fillColor(colors.text).fontSize(12);
        doc.text(`Total Orders: ${totalOrders}`, 50, 160)
           .text(`Total Income: ${totalIncome.toFixed(2)}`, 250, 160)
           .text(`Total Discount: ${totalDiscount.toFixed(2)}`, 420, 160);

        // Table Headers
        const headers = ["Order ID", "Customer Name", "Total", "Order Date", "Status"];
        const headerWidths = [120, 160, 60, 100, 70];
        let currentX = 50;
        let currentY = 200;

        doc.fillColor(colors.primary);
        doc.rect(currentX, currentY, doc.page.width - 100, 20).fill();

        headers.forEach((header, i) => {
            doc.fillColor(colors.headerText)
               .font("Helvetica-Bold")
               .fontSize(10)
               .text(header, currentX, currentY + 5, { width: headerWidths[i], align: "center" });
            currentX += headerWidths[i];
        });

        // Table Content
        currentY += 20;

        orders.forEach((order, index) => {
            currentX = 50;
            const isEvenRow = index % 2 === 0;
            doc.fillColor(isEvenRow ? colors.alternate : "#ffffff")
               .rect(currentX, currentY, doc.page.width - 100, 20)
               .fill();

            doc.fillColor(colors.text).fontSize(10);
            doc.text(order.OrderId.toString(), currentX, currentY + 5, { width: 140, align: "center" });
            currentX += 120;
            doc.text(order.userId?.name || "N/A", currentX, currentY + 5, { width: 160, align: "center" });
            currentX += 160;
            doc.text(`${order.total.toFixed(2)}`, currentX, currentY + 5, { width: 60, align: "center" });
            currentX += 60;
            doc.text(new Date(order.createdAt).toLocaleDateString(), currentX, currentY + 5, { width: 100, align: "center" });
            currentX += 100;
            doc.text(order.status, currentX, currentY + 5, { width: 70, align: "center" });

            currentY += 20;
        });
        doc.moveDown(1);
        doc.fillColor('#000000').lineWidth(0.5).moveTo(50, currentY).lineTo(555, currentY).stroke();
        doc.moveDown(0.5);
        // Summary Section at the End
        currentY += 30;
doc.fontSize(12).fillColor(colors.primary);

doc.text(`Total Orders: ${totalOrders}`, 50, currentY);
currentY += 20; // Move down to the next line

doc.text(`Total Income: ${totalIncome.toFixed(2)}`, 50, currentY);
currentY += 20; // Move down to the next line

doc.text(`Total Discount: ${totalDiscount.toFixed(2)}`, 50, currentY);


        // End PDF Document
        doc.end();
    } catch (error) {
        console.error("Error generating PDF:", error.message);
        res.status(500).send(`Failed to generate PDF report: ${error.message}`);
    }
};


// Backend: Route to serve filtered data for table display
const filterSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        const {dateQuery} = getDateQuery(reportType, startDate, endDate);

        const orders = await Order.find({ status: "delivered", createdAt: dateQuery }).populate('items.productId').populate('userId'); 
        res.json(orders); // Send data as JSON for table display
    } catch (error) {
        console.error('Error fetching filtered sales data:', error.message);
        res.status(500).send('Failed to fetch filtered data.');
    }
};

const approveReturnRequest = async (req, res) => {
    const { orderId } = req.params;
    const { itemId } = req.body; 

    try {
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) return res.status(404).send('Order not found');

        const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) return res.status(404).send('Item not found');
        if (item.returnStatus !== 'requested') return res.status(400).send('Return request is not pending for this item');

        
        item.returnStatus = 'approved';
        item.isReturned = true;

        if (item.returnReason !== 'Damaged') {
            await Book.findByIdAndUpdate(item.productId._id, { $inc: { stock: item.quantity } });
        }

        const originalSubtotal = order.items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
        const originalDiscount = order.discount || 0;
        const discountPercentage = originalDiscount / originalSubtotal;

        const itemDiscount = (item.priceAtOrder * item.quantity / originalSubtotal) * originalDiscount;
        const refundAmount = item.priceAtOrder * item.quantity - itemDiscount; 

        const remainingItems = order.items.filter(item => !item.isReturned); 
        const updatedSubtotal = remainingItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
        const updatedDiscount = updatedSubtotal * discountPercentage; 
        const updatedTotal = Math.max(0, updatedSubtotal + order.shipping - updatedDiscount); 

        order.subtotal = updatedSubtotal;
        order.discount = updatedDiscount;
        order.total = updatedTotal;

        if ((order.paymentStatus === 'paid' && order.paymentMethod !== 'cashOnDelivery') || order.paymentMethod === 'wallet') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) wallet = await Wallet.create({ userId: order.userId });

            wallet.balance += refundAmount; 
            wallet.transactions.push({
                amount: refundAmount,
                transactionType: 'credit',
                orderId: order._id,
                message: `${refundAmount.toFixed(2)} credited for returned product`,
            });
            await wallet.save();
        }

        await order.save();

        res.redirect('/admin/orders'); // Redirect to admin orders page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};


const getReturnOrders=async (req,res)=>{
       try{
        const page = parseInt(req.query.page) || 1; 
        const limit = 5; 
        const skip = (page - 1) * limit;

        const returnOrders=await Order.find({returnStatus:'requested'})
                           .populate('userId')
                           .populate('items.productId')
                           .limit(limit)
                           .skip(skip)
                           .sort({ returnedAt: -1 });
        const totalPages = Math.ceil(returnOrders/limit)
        return res.render('admin/returnOrders',{returnOrders, currentPage: page, totalPages})
       }catch(err) {
          console.log(err)
          res.status(500).send('error occure while fetching return orders')
       }
}
const acceptReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Validate order status
    if (order.status !== "returnRequested") {
      return res.status(400).json({ success: false, message: "Return request is not valid" });
    }

    // Update the order status
    order.status = "returned";
    order.returnStatus = "accepted";
    order.updatedAt = new Date();
    await order.save();

    // Refund the stock
    for (const item of order.items) {
      const product = await Book.findById(item.productId);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      product.stock += item.quantity;
      await product.save();
    }

    

    res.json({ success: true, message: "Return request accepted successfully" });
  } catch (error) {
    console.error("Error accepting return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


//reject return
const rejectReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Validate order status
    if (order.status !== "returnRequested") {
      return res.status(400).json({ success: false, message: "Return request is not valid" });
    }

    // Update the order status
    order.status = "delivered";
    order.returnStatus = "rejected";
    order.updatedAt = new Date();
    await order.save();

    res.json({ success: true, message: "Return request rejected successfully" });
  } catch (error) {
    console.error("Error rejecting return request:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
    adminUsers,
    blockUser,
    unblockUser,
    addBooks,
    getBooks,
    editBooks,
    deleteBook,
    activeBook,
    login,
    postLogin,
    getOrders,
    orderStatus,
    getDashboardData,
    renderDashboard,
    getDeliveredSalesReport,
    downloadSalesReport,
    filterSalesReport,
    getReturnOrders,
    acceptReturn,
    rejectReturn,
};


























