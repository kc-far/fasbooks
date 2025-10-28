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
const Coupon = require('../models/couponModel');
const Offer=require('../models/offerModel')
const  PDFDocument  = require('pdfkit');
const ExcelJS = require("exceljs");
const  {jsPDF}  = require("jspdf");
require("jspdf-autotable");
const Admin = require("../models/adminModel")
const Wallet =require('../models/walletModel')

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

        //const deliveredFilter = { status: 'delivered' };

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
                                   .limit(limit)
                                   .sort({$natural:-1 });
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
        const images = req.files 

        if (!title || !author || !description || !price || !stock || !categoryId) {
            
            return res.redirect('/admin/products?error=All fields are required');
        }
      
        if (isNaN(price) || Number(price) <= 0) {
            
            return res.redirect('/admin/products?error=Price must be a positive number');
        }
        

        if (isNaN(stock) || Number(stock) < 0) {
          
            return res.redirect('/admin/products?error=Stock must be a non-negative number');
        }
      
        // if (!images || images.length === 0) {
            
        //     return res.redirect('/admin/products?error=No Image Uploaded');
        // }
        if (!images || !Array.isArray(images) || images.length !== 3) {
            return res.status(400).json({ error: 'Exactly 3 images are required.' });
        }
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        // const imagePaths = [];
        
        for (let i = 0; i < images.length; i++) {
            const file = images[i];

             if (!allowedTypes.includes(file.mimetype)) {
               return res.status(400).json({
                    error: `Image ${i + 1}: Only JPG or PNG allowed. Got ${file.mimetype}`
               });
            }

            //imagePaths.push(`/uploads/${file.filename}`);
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
        //res.json({success:true,message:"Product added Successfully"})
        
    } catch (error) {
        
        console.error('Error adding book:', error);
        res.redirect('/admin/products?error=Error Adding Book');
    }
};
   
    
const getBooks = async (req, res) => {
    try {
        const { message, error, search, page = 1, limit = 5 } = req.query;
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);
        const skip = (parsedPage - 1) * parsedLimit;

        //for search
        const filter = {};
        if (search) {
            const regex = new RegExp(search, 'i');
            const categories = await Category.find({ name: regex }).select('_id');
            const categoryIds = categories.map(cat => cat._id);

            filter.$or = [
                { title: regex },
                { author: regex },
                { categoryId: { $in: categoryIds } }
            ];
        }

        // Fetch books with filter and pagination
        const books = await Book.find(filter)
            .populate({
                path: 'categoryId',
                select: 'name'
            })
            .skip(skip)
            .limit(parsedLimit)
            .sort({ createdAt: -1 });

    
        const totalBooks = await Book.countDocuments(filter);
        const totalPages = Math.ceil(totalBooks / parsedLimit);

        res.render('admin/products', {
            books,
            message,
            error,
            search, 
            currentPage: parsedPage,
            totalPages,
            limit: parsedLimit,
            categories: await Category.find({ isActive: true }) //active categories while adding
        });
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).send('Error fetching books');
    }
};
const editBooks = async (req, res) => {
  try {
    
    const { id, title, author, description, price, stock } = req.body;
    //const images = req.files||[]; 

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

    

    const images=[]
    if(req.files && req.files.length>0){
        for(i=0;i<req.files.length;i++){
            images.push(req.files[i].filename)
        }
    }
    if(images.length>0){
        book.images.push(...images)
    }
    
    await book.save();
   
    res.redirect('/admin/products?message=Book Updated');
  } catch (error) {
    console.error('Error updating book:', error);
    res.redirect('/admin/products?error=Error updating book');
  }
};

const deleteImage= async (req, res) => {
    const { bookId, index } = req.body;
    try {
        const book = await Book.findById(bookId);
        if (!book || index < 0 || index >= book.images.length) {
            return res.json({ success: false, error: 'Invalid book or image index' });
        }
        book.images.splice(index, 1); 
        await book.save();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: 'Server error' });
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
      "paid",
      "processing"
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
const getCoupons = async (req, res) => {
    try {
        const { message, error } = req.query;
        const currentDate = new Date();

        // Deactivate expired coupons
        await Coupon.updateMany(
            { 
                isActive: true, 
                validUntil: { $lt: currentDate } 
            },
            { $set: { isActive: false } }
        );
        const coupons = await Coupon.find().sort({createdAt:-1});
        res.render('admin/coupons', { coupons ,message, error});
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Server error');
    }
};
const getCreateCoupon = (req, res) => {
    try {
        const { message, error } = req.query;

        res.render('admin/createCoupon',{message, error})
    } catch (error) {
        console.log(error)
        res.json('error while showing the coupon page')
    }
}
const createCoupon = async (req, res) => {
     const { code, discount, minOrderValue, validFrom, validUntil } = req.body;
     // Server-side validation
    if (!code || !discount || !minOrderValue || !validFrom || !validUntil) {
        return res.redirect(`/admin/getCreateCoupon?error=Please+fill+in+all+fields&code=${code || ''}&discount=${discount || ''}&minOrderValue=${minOrderValue || ''}&validFrom=${validFrom || ''}&validUntil=${validUntil || ''}`);
    }
    
    if (discount <= 0 || discount > 50) {
        return res.redirect(`/admin/getCreateCoupon?error=Discount+should+be+between+1+and+50&code=${code}&discount=${discount}&minOrderValue=${minOrderValue}&validFrom=${validFrom}&validUntil=${validUntil}`);
    }
    
    if (minOrderValue <= 0) {
        return res.redirect(`/admin/getCreateCoupon?error=Minimum+order+value+should+be+greater+than+0&code=${code}&discount=${discount}&minOrderValue=${minOrderValue}&validFrom=${validFrom}&validUntil=${validUntil}`);
    }
    
    if (validFrom > validUntil) {
        return res.redirect(`/admin/getCreateCoupon?error=Valid+From+is+not+greater+than+Valid+Until&code=${code}&discount=${discount}&minOrderValue=${minOrderValue}&validFrom=${validFrom}&validUntil=${validUntil}`);
    }

    try {
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.redirect('/admin/getCreateCoupon?error=Coupon+code+already+exists');
        }

         // Create the new coupon
        const newCoupon = new Coupon({
            code,
            discount,
            minOrderValue,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: true
        });

         await newCoupon.save();

        return res.redirect('/admin/coupons?message=Coupon+created+successfully');
    } catch (error) {
        console.error('Error creating coupon:', error);
        return res.redirect('/admin/coupons?error=An+error+occurred+while+creating+the+coupon');
    }
}
const getEditCoupon = async (req, res) => {
    const couponId = req.params.id;
    const { error, message } = req.query;  // Capture error and message from query parameters
    
    try {
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.redirect('/admin/coupons?error=Coupon+not+found');
        }
        
        // Pass coupon, error, and message to the template
        res.render('admin/editCoupon', { coupon, error, message });
    } catch (error) {
        console.error('Error fetching coupon for edit:', error);
        res.redirect('/admin/coupons?error=An+error+occurred+while+fetching+the+coupon');
    }
};
const updateCoupon = async (req, res) => {
    const couponId = req.params.id;
    const { code, discount, minOrderValue, validFrom, validUntil } = req.body;

    // Server-side validation
    if (!code || !discount || !minOrderValue || !validFrom || !validUntil) {
        return res.redirect(`/admin/editCoupon/${couponId}?error=Please+fill+in+all+fields`);
    }

    if (discount <= 0 || discount > 100) {
        return res.redirect(`/admin/editCoupon/${couponId}?error=Discount+should+be+between+1+and+100`);
    }

    if (minOrderValue <= 0) {
        return res.redirect(`/admin/editCoupon/${couponId}?error=Minimum+order+value+should+be+greater+than+0`);
    }

    
    try {
        const existingCoupon = await Coupon.findOne({ code, _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.redirect(`/admin/editCoupon/${couponId}?error=Coupon+code+already+exists`);
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.redirect('/admin/coupons?error=Coupon+not+found');
        }
        

        // Update coupon details
        coupon.code = code;
        coupon.discount = discount;
        coupon.minOrderValue = minOrderValue;
        coupon.validFrom = new Date(validFrom);
        coupon.validUntil = new Date(validUntil);

        await coupon.save();
        
        res.redirect('/admin/coupons?message=Coupon+updated+successfully');
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.redirect(`/admin/editCoupon/${couponId}?error=An+error+occurred+while+updating+the+coupon`);
    }
};
const deactivateCoupon = async (req, res) => {
    const { id } = req.params;

    try {
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).redirect(`/admin/coupons?error=Coupon+not+found`);
        }

        // Toggle the isActive status
        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.redirect(`/admin/coupons?message=Coupon+status+updated+successfully`);
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).redirect(`/admin/coupons?error=Error+updating+coupon+status`);
    }
};

const getOffers=async(req,res)=>{
    try {
        const offers=await Offer.find()
                                .populate({
                                    path: 'applicableProducts',
                                    select: 'title'
                                })
                                .populate({
                                    path: 'applicableCategories',
                                    select: 'name'
                                })
        res.render('admin/offer',{offers})
    } catch (error) {
        res.status(500).send('Server error')
    }
}
const getCreateOffer=async(req,res)=>{
    try{
        //filter products &categories
         const allProducts = await Book.find({ isActive: true });
         const allCategories = await Category.find({ isActive: true });
        
        //query meesagess from query params
          const errorMessage = req.query.error || null;
          const successMessage = req.query.error || null;

        res.render('admin/createOffer', { 
            allProducts, 
            allCategories, 
            errorMessage, 
            successMessage 
        });

    }catch(err){
        res.redirect('/admin/getCreateOffer?error=An+error+occurred+while+fetching+data')

    }
}
const createOffer=async(req,res)=>{
    try {
        const { title, discount, applicableProducts, applicableCategories, validFrom, validUntil, isActive } = req.body;

        // Validation checks
        if (!title || !discount || !validFrom || !validUntil) {
            return res.redirect('/admin/getCreateOffer?error=All+fields+are+required.');
        }

        if (isNaN(discount) || discount < 0 || discount > 100) {
            return res.redirect('/admin/getCreateOffer?error=Discount+must+be+a+number+between+0+and+100.');
        }

        if (new Date(validFrom) >= new Date(validUntil)) {
            return res.redirect('/admin/getCreateOffer?error=Valid+From+date+must+be+earlier+than+Valid+Until+date.');
        }

        const existingOffer = await Offer.findOne({ title });
        if (existingOffer) {
            return res.redirect('/admin/getCreateOffer?error=An+offer+with+this+title+already+exists.');
        }

        const selectedProducts = Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts].filter(Boolean);
        const selectedCategories = Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories].filter(Boolean);

        if (selectedProducts.length === 0 && selectedCategories.length === 0) {
            return res.redirect('/admin/getCreateOffer?error=At+least+one+product+or+category+must+be+selected.');
        }

        const newOffer = new Offer({
            title,
            discount,
            applicableProducts: selectedProducts,
            applicableCategories: selectedCategories,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: isActive === 'true', // Convert to boolean
        });
        await newOffer.save()
        res.redirect('/admin/offer-management?message=Offer+created+successfully');

    } catch (error) {
        console.error("Error creating offer:", error);
        res.redirect('/admin/getCreateOffer?error=An+error+occurred+while+creating+the+offer.');
    }
}
const getEditOffer=async(req,res)=>{
     try {
        const { offerId } = req.params;
        const error = req.query.error || null; // Get error message if present

        // Retrieve the specific offer
        const offer = await Offer.findById(offerId)
                                 .populate('applicableProducts')
                                 .populate('applicableCategories');
        
        // Fetch all active products and categories
        const allProducts = await Book.find({ isActive: true });
        const allCategories = await Category.find({ isActive: true });

        if (!offer) {
            // Pass error message to the template
            return res.render('admin/editOffer', { offer: null, allProducts, allCategories, error: "Offer not found" });
        }

        res.render('admin/editOffer', { offer, allProducts, allCategories, error });
    } catch (error) {
        console.error('Error loading edit offer page:', error);
        res.render('admin/editOffer', { offer: null, allProducts, allCategories, error: "An error occurred while loading the edit offer page." });
    }
}
const editOffer=async(req,res)=>{
    try {
        const { offerId } = req.params;
        const { title, discount, applicableProducts, applicableCategories, validFrom, validUntil, isActive } = req.body;

        // Validation checks
        if (!title || !discount || !validFrom || !validUntil) {
            return res.redirect(`/admin/editOffer/${offerId}?error=All+fields+are+required.`);
        }

        if (isNaN(discount) || discount <= 0 || discount > 100) {
            return res.redirect(`/admin/editOffer/${offerId}?error=Discount+must+be+a+number+between+0+and+100.`);
        }

        if (new Date(validFrom) >= new Date(validUntil)) {
            return res.redirect(`/admin/editOffer/${offerId}?error=Valid+From+date+must+be+earlier+than+Valid+Until+date.`);
        }

         // Check if an offer with the same title already exists, excluding the current offer
        const existingOffer = await Offer.findOne({ title, _id: { $ne: offerId } });
        if (existingOffer) {
            return res.redirect(`/admin/editOffer/${offerId}?error=An+offer+with+this+title+already+exists.`);
        }
        
        // Update the offer
        await Offer.findByIdAndUpdate(offerId, {
            title,
            discount,
            applicableProducts,
            applicableCategories,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: isActive === 'true' // Convert to boolean
        });
        res.redirect('/admin/offer-management');
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).send("An error occurred while updating the offer.");
    }
}
const deactivateOffer=async(req,res)=>{
   try {
        const { offerId } = req.params;

        // Find the offer and toggle its status
        const offer = await Offer.findById(offerId);
        if (offer) {
            offer.isActive = !offer.isActive;
            await offer.save();
        }

        res.redirect('/admin/offer-management'); // Redirect to the offers list after deactivation
    } catch (error) {
        console.error('Error toggling offer status:', error);
        res.status(500).send("An error occurred while changing the offer status.");
    }
}

// calculate sale summary
const calculateSalesSummary = async (salesData) => {
  return {
    totalOrders: salesData.length,
    totalSales: salesData.reduce((sum, order) => sum + order.total, 0),
    totalDiscount: salesData.reduce(
      (sum, order) => sum + (order.discount || 0),
      0
    ),
    averageOrderValue:
      salesData.length > 0
        ? salesData.reduce((sum, order) => sum + order.total, 0) /
          salesData.length
        : 0,
  };
};

// Remove the salesController object and directly export individual functions
const renderSalesReport = async (req, res) => {
    
  try {
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get initial daily sales data
    const salesData = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ["cancelled"] },
    })
      .populate("userId", "name")
      .populate("items.productId");

    // Calculate summary statistics
    const summary = await calculateSalesSummary(salesData);

    res.render("admin/report", {
      sales: salesData,
      summary,
      reportType: "daily",
    });
    
  } catch (error) {
    console.error("Error rendering sales report:", error);
    res.status(500).send("Error loading sales report");
  }
};

const getSalesReport = async (req, res) => {
    console.log("Full Request Body:", req.body);
    console.log("Report Type:", req.body.reportType);
    try {
        const { reportType, startDate, endDate } = req.body;

        // Validate report type
        if (!reportType) {
            return res.status(400).json({
                success: false,
                message: "Report type is required",
            });
        }

        let dateQuery={ paymentStatus:'paid'}
        const now = new Date();

        switch(reportType){
            case 'daily':
                dateQuery.createdAt={
                    $gte:new Date(now.setHours(0,0,0,0)),
                    $lte:new Date(now.setHours(23,59,59,999))

                }
            break;

            case 'weekly':
                const startOfWeek=new Date(now.setDate(now.getDate()-now.getDay()))
                dateQuery.createdAt={
                    $gte:new Date(startOfWeek.setHours(0,0,0,0)),
                    $lte:new Date()
                }
            break;

            case 'monthly':
                const startOfMonth=new Date(now.getFullYear(),now.getMonth(),1)
                dateQuery.createdAt={
                    $gte:startOfMonth,
                    $lte:new Date()
                }
            break;

            case 'custom':
                if(!startDate||!endDate){
                    return res.status(400).json({
                        success: false,
                        message: "Start and end dates are required for custom report",
                    })
                }
                dateQuery.createdAt={
                    $gte:new Date(startDate),
                    $lte:new Date(new Date(endDate).setHours(23,59,59,999))
                }
            break;

            default:                
                return res.status(400).json({
                    success: false,
                    message: "Invalid report type",
                });
        }

        const salesData=await Order.find(dateQuery)
                                   .populate("userId", "name email")
                                   .populate("items.productId")
                                   .sort({ createdAt: -1 });
        
      
        const summary = await calculateSalesSummary(salesData);

        // Return response
        res.json({
            success: true,
            sales: salesData,
            summary,
        });
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({
            success: false,
            message: "Error generating sales report",
            error: error.message,
        }); 
    }
}

const downloadExcel= async (req,res)=>{
    try {
        const { reportType, startDate, endDate } = req.query;
        console.log('download query..',req.query)

        let dateQuery={paymentStatus:'paid'}//{status:"delivered"}
        let now=new Date()

    switch (reportType) {
      case "daily":
        dateQuery.createdAt = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateQuery.createdAt = {
          $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
          $lte: new Date(),
        };
        break;
      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateQuery.createdAt = {
          $gte: startOfMonth,
          $lte: new Date(),
        };
        break;
      case "custom":
        if (startDate && endDate) {
          dateQuery.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          };
        }
        break;
    }
    const orders=await Order.find(dateQuery)
                           .populate('items.productId','title author')
                           .populate('userId','name email')
                           .sort({createdAt:-1})
console.log('exceldwnld orders..',orders)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");
    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Shipping Address", key: "shippingAddress", width: 40 },
      { header: "Products", key: "products", width: 50 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Coupon Discount", key: "couponDiscount", width: 15 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];

    orders.forEach((order)=>{
        worksheet.addRow({
            orderId:order.OrderId,
            date: new Date(order.createdAt).toLocaleDateString(),
            customer:order.userId?`${order.userId.name} (${order.userId.email})`:'N/A',
            shippingAddress:order.address,
            products:order.items.map(
                (item)=>`${
                    item.productId 
                    ?`${item.productId.title} (${item.productId.author})`
                    :'N/A'
                } - ${item.quantity} pcs @ ₹${item.priceAtOrder}`
            ).join(" , "),
            totalAmount:`${order.total.toFixed(2)}`,
            couponDiscount:`${order.discount.toFixed(2)}`,
            finalAmount:`${(order.total-order.discount).toFixed(2)}`,
            paymentMethod:order.paymentMethod.toUpperCase(),
            status:order.status.charAt(0).toUpperCase() + order.status.slice(1),
        })
    })

    const totalOrders=orders.length;
    const totalAmount=orders.reduce(
        (sum,ord)=>sum+ord.total,0
    )
    const totalDiscount=orders.reduce(
        (sum,ord)=>sum+(ord.discount||0),0
    )
    const finalAmount=totalAmount-totalDiscount

    worksheet.addRow({});
    worksheet.addRow(["Summary"]);
    worksheet.addRow(["Total Orders", totalOrders]);
    worksheet.addRow(["Total Sales", `₹${totalAmount.toFixed(2)}`]);
    worksheet.addRow(["Total Discount", `₹${totalDiscount.toFixed(2)}`]);
    worksheet.addRow(["Net Sales", `₹${finalAmount.toFixed(2)}`]);

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${Date.now()}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    } catch (error) {
        console.error("Excel Download Error:", error);
        res.status(500).send("Error generating Excel: " + error.message);      
    }

}

const downloadPdf=async (req,res)=>{
    try {
        const { reportType, startDate, endDate } = req.query;

        // Validate report type
        if (!reportType) {
            return res
                .status(400)
                .json({ success: false, message: "Report type is required." });
        }

        // Construct date query
        const now = new Date();
        let dateQuery = {paymentStatus:'paid'}//{ status: "delivered" };

        switch (reportType) {
            case "daily":
                dateQuery.createdAt = {
                   $gte: new Date(now.setHours(0, 0, 0, 0)),
                   $lte: new Date(now.setHours(23, 59, 59, 999)),
                };
            break;
            case "weekly":
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                dateQuery.createdAt = {
                    $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
                    $lte: new Date(),
                };
            break;
            case "monthly":
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateQuery.createdAt = {
                    $gte: startOfMonth,
                    $lte: new Date(),
                };
            break;
            case "custom":
                if (!startDate || !endDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Start and end dates are required for custom reports.",
                    });
                }
                dateQuery.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
                };
            break;
            default:
                return res
                    .status(400)
                    .json({ success: false, message: "Invalid report type." });
        }
        const salesData = await Order.find(dateQuery)
                                     .populate('userId','name email')
                                     .populate('items.productId','title price')
                                     .sort({createdAt:-1})
        if (!salesData.length) {
            return res.status(404).json({
                success: false,
                message: "No sales data found for the specified period.",
            });
        }

        const doc= new jsPDF()
        //title
        doc.setFontSize(16)
        doc.text("Sales Report", 105, 10, { align: "center" })
        //metadata
        doc.getFontSize(10)
        doc.text(`Report Type: ${reportType.charAt(0).toUpperCase()+reportType.slice(1)}`, 14, 20);
        doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 30);

        const tableData=salesData.map((order)=>[
            order.OrderId,
            order.userId?order.userId.name:'N/A',
            order.items.map((item)=>item.productId?.title).join(', '),
            order.total.toFixed(2),
            order.discount?order.discount.toFixed(2):'0.00',
            (order.total-(order.discount||0)).toFixed(2),
            order.paymentMethod.toUpperCase(),
            new Date(order.createdAt).toLocaleString(),
        ])

        doc.autoTable({
            startY: 40,
            head: [
                [
                    "Order ID",
                    "Customer",
                    "Products",
                    "Total Amount",
                    "Discount",
                    "Final Amount",
                    "Payment Method",
                    "Order Date",
                ],
            ],
            body: tableData,
            theme: "grid",
            headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
            styles: { fontSize: 8, cellPadding: 2 },
        })

        const totalOrders=salesData.length;
        const totalSales=salesData.reduce((acc,ord)=>acc+ord.total,0).toFixed(2)
        const totalDiscount=salesData.reduce((acc,ord)=>acc+(ord.discount||0),0).toFixed(2)

        doc.addPage();
        doc.text("Sales Summary", 105, 10, { align: "center" });
        doc.autoTable({
            startY: 20,
            head: [["Metric", "Value"]],
            body: [
                ["Total Orders", totalOrders],
                ["Total Sales", `${totalSales}/-`],
                ["Total Discount", `${totalDiscount}/-`],
            ],
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 2 },   
        })

        const pdfBuffer=Buffer.from(doc.output("arraybuffer"));

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=sales-report-${Date.now()}.pdf`
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        // Send PDF
        res.send(pdfBuffer);


    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({
            success: false,
            message: "Error generating PDF",
            error: error.message,
        });
    }

}


const getReturnOrders = async (req, res) => {
  
  try {
    const page = parseInt(req.query.page) || 1; 
    const limit = 5; 
    const skip = (page - 1) * limit;
    
    const orders = await Order.find()
                    .populate('items.productId')
                    .populate('userId');
  

    const allReturnItems = orders.reduce((acc, order) => {
      const requestedItems = order.items.filter(item => item.returnStatus === 'requested')
                                      .map(item => ({
                                        ...item.toObject(),
                                        orderId: order._id,
                                        userId: order.userId
                                      }));
      return [...acc, ...requestedItems];
    }, []);

    allReturnItems.sort((a, b) => new Date(b.returnedAt) - new Date(a.returnedAt));

    const paginatedItems = allReturnItems.slice(skip, skip + limit);                             
    const totalPages = Math.ceil(allReturnItems.length / limit);
    

    return res.render('admin/returnOrders', { returnOrders: paginatedItems, currentPage: page, totalPages });
  } catch (err) {
    console.error('Error fetching return orders:', err.stack);
    res.status(500).send('error occurred while fetching return orders');
  }
};


const acceptReturn = async (req, res) => {
    const { orderId } = req.params;
    const { itemId } = req.body; 
  try {
       
    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(item => item._id.toString() === itemId);
    if (!item) return res.status(404).json({ success: false, message:'Item not found'});
    if (item.returnStatus !== 'requested') return res.status(400).send('Return request is not pending for this item');



    // Update the order status
   
    item.returnStatus = "accepted";
    item.isReturned=true;
    const allItemsReturned = order.items.every(item => item.isReturned);
    order.status = allItemsReturned ? "returned" : "delivered";

    await order.save();
     
    // Refund the stock
    
        
      const product = await Book.findById(item.productId);
      if (!product) {
       return res.status(404).json({success:false,message:`Product with ID ${item.productId} not found` });
      }
      product.stock += item.quantity;
      await product.save();
    
    let wallet=await Wallet.findOne({userId:order.userId})
    if(!wallet){
       wallet=new Wallet({
        userId:order.userId,
        balance:0,
        transactions:[]

       })
    }
    
    const originalSubtotal = order.items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
    const originalDiscount = order.discount || 0;
    const discountPercentage = originalDiscount / originalSubtotal;
    console.log(originalSubtotal)

    const itemDiscount = (item.priceAtOrder * item.quantity / originalSubtotal) * originalDiscount;
    const refundAmount = item.priceAtOrder * item.quantity - itemDiscount; 

    const remainingItems = order.items.filter(item => !item.isReturned); 
    const updatedSubtotal = remainingItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
    const updatedDiscount=updatedSubtotal * discountPercentage; 
    const updatedTotal= Math.max(0, updatedSubtotal + order.shipping -updatedDiscount)
    console.log(updatedSubtotal)
    console.log(updatedTotal)

    order.subtotal=updatedSubtotal
    order.discount = updatedDiscount;
    order.total=updatedTotal;

    wallet.balance+=refundAmount;
    wallet.transactions.push({
        amount:refundAmount,
        transactionType:'credit',
        date:new Date(),
        orderId:order._id,
        message: 'Credited for returned product',
    })
    await wallet.save()
 
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
    const {itemId}=req.body

    // Find the order
    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

     const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) return res.status(404).json({ success: false, message: "item not found" })
        if (item.returnStatus !== 'requested') return res.status(400).json({ success: false, message: "return req is not valide" });

    

    // Update the order status
    order.status = "delivered";
    item.returnStatus = "rejected";
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
    deleteImage,
    deleteBook,
    activeBook,
    login,
    postLogin,
    getOrders,
    orderStatus,
    getCoupons,
    getCreateCoupon,
    createCoupon,
    getEditCoupon,
    updateCoupon,
    deactivateCoupon,
    getOffers,
    getCreateOffer,
    createOffer,
    getEditOffer,
    editOffer,
    deactivateOffer,
    getDashboardData,
    renderDashboard,
    getReturnOrders,
    acceptReturn,
    rejectReturn,
    renderSalesReport,
    getSalesReport,
    downloadExcel,
    downloadPdf,
};
