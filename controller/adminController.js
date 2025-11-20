const User = require("../models/userModel");
const Book = require('../models/productModel'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path = require('path');
const upload = require('../config/multerConfig');
const mongoose = require("mongoose")
const fs = require('fs');
const Order=require('../models/orderModel')
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
        let startDate;
 
        // Define date filter based on the selected period
        const now = new Date();
        switch (period) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'weekly':              
                startDate =  new Date(now.setDate(now.getDate() - 7)) 
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(0); // all time
        }
        const dateFilter = { $gte: startDate };

        // 1. TOTAL ORDERS (All statuses — this is what matters!)
        const totalOrdersInPeriod = await Order.countDocuments({
            createdAt: dateFilter
        });

        // 2. DELIVERED ORDERS → Real Revenue
        const deliveredOrders = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    totalDiscount: { $sum: "$discount" },
                    itemsSold: { $sum: { $sum: "$items.quantity" } }
                }
            }
        ]);
        const revenueData = deliveredOrders[0] || { totalRevenue: 0, totalDiscount: 0, itemsSold: 0 };

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
            //salesSummary: salesSummary[0] || { totalSalesCount: 0, totalRevenue: 0, totalDiscount: 0 },
            totalOrders:totalOrdersInPeriod,
            totalRevenue:revenueData.totalRevenue,
            totalDiscount:revenueData.totalDiscount,
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


        let search="";
        if(req.query.search){
            search=req.query.search;
        }

        const totalUsers = await User.countDocuments({ isAdmin: false ,$or:[

                {name: { $regex: search, $options: 'i' }},
                {email: { $regex: search, $options: 'i' }}
            ]});
        
       
        const userData = await User.find({ isAdmin: false, $or:[

                {name: { $regex: search, $options: 'i' }},
                {email: { $regex: search, $options: 'i' }}
            ]
        })  .skip(skip)
            .limit(limit)
            .sort({$natural:-1 });

        const totalPages = Math.ceil(totalUsers / limit); 
        res.render('admin/users', {
            users: userData,
            currentPage: page,   
            totalPages: totalPages ,
            search
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


// const getOrders = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1; 
//         const limit = 5; 
//         const skip = (page - 1) * limit; // Calculate the number of orders to skip

//         const totalOrders = await Order.countDocuments(); 
//         const orders = await Order.find()
//             .populate('items.productId')
//             .populate('userId')
//             .limit(limit)
//             .skip(skip) 
//             .sort({createdAt:-1})
//         const totalPages = Math.ceil(totalOrders / limit); 
        
//         // Render the EJS view and pass the orders data, current page, and total pages
//         res.render('admin/orders', 
//             { orders, 
//               currentPage: page, 
//               totalPages,
                
//             }); 
//     } catch (error) {
//         console.error('Error fetching orders:', error);
//         res.status(500).send('Error fetching orders');
//     }
// };

const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        // ===== BUILD SEARCH FILTER =====
        let filter = {};
        let search = "";

        if (req.query.search) {
            search = req.query.search.trim();
            if (search) {
                filter.$or = [
                    { 'userId.name': { $regex: search, $options: 'i' } },
                    { 'items.titleAtOrder': { $regex: search, $options: 'i' } }
                ];
            }
        }
        //sort
        let sort = { createdAt: -1 }; // Default: newest first
if (req.query.sort === 'oldest') {
    sort = { createdAt: 1 }; // oldest first
}

if (req.query.status && req.query.status !== 'all') {
  filter.status = req.query.status;
}
if (req.query.paymentMethod && req.query.paymentMethod !== 'all') {
  const method = req.query.paymentMethod.trim();
    filter.paymentMethod = { $regex: method, $options: 'i' };
}
        // ===== FETCH ORDERS WITH FILTER + PAGINATION =====
        const orders = await Order.find(filter)
            .populate('items.productId')
            .populate({
                path:'userId', 
                select:'name email'
            })
            .sort(sort)
            .skip(skip)
            .limit(limit);

        
        // ===== COUNT TOTAL MATCHING ORDERS (for correct pagination) =====
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('admin/orders', {
            orders,
            currentPage: page,
            totalPages,
            search: req.query.search || '',
            query: req.query  // important for preserving in pagination links
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
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
    login,
    postLogin,
    getOrders,
    orderStatus,
    getDashboardData,
    renderDashboard,
    getReturnOrders,
    acceptReturn,
    rejectReturn,
    
};
