const User = require("../models/userModel")
const router = require("../route/adminRoute")
const bcrypt = require('bcrypt')
const mongoose = require("mongoose")
const Book = require('../models/productModel');
const Address = require('../models/addressModel')
const Order = require('../models/orderModel');
const axios = require('axios');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const sendOtpToEmail = require('../config/sendOtpToEmail');
const Wishlist = require('../models/wishListModel')
const Wallet=require('../models/walletModel')
const Cart = require('../models/cartModel')
const Offer = require('../models/offerModel')
const Coupon=require('../models/couponModel')


const renderSignupPage =  (req, res) => {
    const ref = req.query.ref || '';
    res.render('user/signup', {ref,error: null, message: null });
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const userSignup = async (req, res) => {
    const { name, email, password, confirmPassword, referralCode } = req.body;
    const refFromLink = req.query.ref || '';
    const hasreferralCode=referralCode || refFromLink;
    

    if (!name || !email || !password || !confirmPassword) {
        return res.render('user/signup', {  ref: refFromLink || referralCode || '',error: 'All fields are required.', message: null });
    }

    if (!isNaN(name)) {
        return res.render('user/signup', { ref: refFromLink || referralCode || '', error: 'Name must contain only characters.', message: null });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.render('user/signup', { ref: refFromLink || referralCode || '', error: 'Please enter a valid email address.', message: null });
    }

    if (password !== confirmPassword) {
        return res.render('user/signup', { ref: refFromLink || referralCode || '', error: 'Passwords do not match.', message: null });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user/signup', {ref: refFromLink || referralCode, error: 'User already exists.', message: null });
        }

        let referredBy = null;
        let isReferralLink = false;

        // Validate referral code and process referral bonus
        
        if (hasreferralCode) {
            const referrer = await User.findOne({ referralCode:hasreferralCode });
            if (!referrer) {
                return res.render('user/signup', {ref: refFromLink || referralCode, error: 'Invalid referral code.', message: null });
            }

            referredBy = referrer._id;
            let wallet = await Wallet.findOne({ userId: referredBy });
            if (!wallet) {
                wallet = new Wallet({ userId: referredBy });
            }

            if(refFromLink && refFromLink === hasreferralCode){
                
                isReferralLink = true;
                
                wallet.balance += 750;
                wallet.transactions.push({
                    amount: 750,
                    transactionType: 'credit',
                    message: 'Referral bonus credited for referring a new user via link.',
                    
                });
                await wallet.save();

                const couponCode = `FIRST10-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                 req.session.tempUserCoupon ={
                    code:couponCode,
                    discount:10,
                    validFrom:new Date(),
                    minOrderValue: 100,
                    usageLimit: 1,
                    isActive:true,
                    isFirstOrder:true,
                    validUntil:new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    userId:null
                 }
                 
            }else{
                
                wallet.balance += 150; 
                wallet.transactions.push({
                    amount: 150,
                    transactionType: 'credit',
                    message: 'Referral bonus credited for referring a new user via code.',
                });
                 await wallet.save();

                 req.session.tempUserWallet={
                    balance:75,
                    transactions:[{
                        amount:75,
                        transactionType:'credit',
                        message:'Sign-up bonus credited for using a referral code.'
                    }],
                }
                console.log(11)
            }
        }else{
            req.session.tempUserWallet = null;
            req.session.tempUserCoupon = null;
        }
        

        // Save temp user in session for OTP verification
        req.session.tempUser = { name, email, password, referredBy ,isReferralLink,};
        

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = otp;
        req.session.otpExpires = new Date(Date.now() + 60 * 1000);
        console.log('OTP is', otp);

        await sendOtpToEmail(email, otp);

        return res.redirect('/verify-otp');
    } catch (error) {
        console.error('Error signing up:', error);
        return res.render('user/signup', { ref: refFromLink || referralCode,error: 'Error signing up. Please try again.', message: null });
    }
};


//verify page

const verifyOtpPage = (req, res) => {
    try {
        const email = req.session.tempUser ? req.session.tempUser.email : null;
        console.log( req.session.tempUser.email);
        
        res.render('user/verifyOtp', { error: null, email: email });
    } catch (error) {
        console.log("Error rendering verify OTP page:", error);
        res.render('user/verifyOtp', { error: 'Error rendering the page.',email:null });
    }
};

//verify otp

const verifyOtp = async (req, res) => {
    const { otp } = req.body;
 
    if (!req.session.otp || new Date() > req.session.otpExpires) {
        return res.render('user/verifyOtp', { error: 'OTP is invalid or has expired.', message: null,email:null });
    }  
    if (otp !== req.session.otp) {
        return res.render('user/verifyOtp', { error: 'Invalid OTP. Please try again.', message: null,email:null });
    }
  
    const { name, email, password ,referredBy,isReferralLink} = req.session.tempUser; 
    const user = new User({ name, email, password ,referredBy}); 
    await user.save(); 
    

    if (req.session.tempUserWallet) {
      const wallet = new Wallet({
        userId: user._id,
        balance: req.session.tempUserWallet.balance,
        transactions: req.session.tempUserWallet.transactions,
      });
      await wallet.save();
    }
    if (req.session.tempUserCoupon) {
      const coupon = new Coupon({
        code: req.session.tempUserCoupon.code,
        discount: req.session.tempUserCoupon.discount,
        validFrom: req.session.tempUserCoupon.validFrom,
        validUntil: req.session.tempUserCoupon.validUntil,
        minOrderValue: req.session.tempUserCoupon.minOrderValue,
        usageLimit: req.session.tempUserCoupon.usageLimit,
        userId: user._id,
        isFirstOrder: req.session.tempUserCoupon.isFirstOrder,
        isActive: req.session.tempUserCoupon.isActive,
        
      });
      await coupon.save();
    }


    delete req.session.tempUser;
    delete req.session.tempUserWallet;
    delete req.session.otp;
    delete req.session.otpExpires;
    delete req.session.tempUserCoupon

    return res.render('user/login', { error: null, message: 'Signup successful! log in Now.' });
};

//resend otp

const resendOtp = async (req, res) => {
    const { email } = req.body; 

    try {   

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = otp; 
        req.session.otpExpires = new Date(Date.now() + 60 * 1000); 
    // if (req.session.resetEmail || req.session.forgotPasswordOtp) {
    //   // This is forgot password flow
    //   req.session.forgotPasswordOtp = otp;
    //   req.session.otpExpires = expires;
    //   req.session.resetEmail = email;
    // } else {
    //   // This is normal signup flow
    //   req.session.otp = otp;
    //   req.session.otpExpires = expires;
    // }
        await sendOtpToEmail(email, otp); 
        console.log(otp);
        
        return res.status(200).json({ success: true, message: 'OTP resented successfully!' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, message: 'Error resending OTP. Please try again.' });
    }
};



//user login

const userLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ email: email, isAdmin: false });

        if (!user) {
            
            return res.render('user/login', { error:'Enter required fields', message: "" });
        }

        //Check if the user is blocked
        if (user.isBlocked) {
            return res.render('user/login', { error: 'Your account is blocked.', message: null });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            
            return res.render('user/login', { error: 'Invalid email or password.', message: "" });
        }

        // Set user session
        req.session.user = {
            id: user._id,
            email: user.email,
        };

        // Redirect to home
        return res.redirect('/home');

    } catch (error) {
        console.error("Login Error:", error);
        return res.render('user/login', { error: 'An error occurred. Please try again.', message: "" });
    }
};

//google login
const googleLogin = (req, res) => {
    if (req.isAuthenticated()) {
        if (req.user.isBlocked) {
            return res.render('user/login', { error: 'Your account is blocked', message: null });
        }
        // Store user in session after successful authentication to Ensure the ID is properly stored in the session
        req.session.user = { id: req.user._id ,email: req.user.email};
        console.log(req.session.user)
         console.log(req.user._id.toString())
        return res.redirect('/home');
    }

    return res.redirect('/login?error=Authentication failed');
};


//home page

const getHome = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        
        // Fetch active products and populate their category
        const products = await Book.find({ isActive: true })
                                   .populate('categoryId', 'name')
                                   .limit(8)
                                   .sort({$natural:-1});

        const wallet=await Wallet.find({userId});
        const offers = await Offer.find({ isActive: true });
        const currentDate = new Date(); 

        const productsWithOffers = products.map(product => {
            let maxDiscountedPrice = product.price; // Start with the original price
            let hasDiscount = false;
        
            offers.forEach(offer => {
                const isOfferActive = !offer.validUntil || offer.validUntil > currentDate; 
                const isProductEligible = offer.applicableProducts.some(id => id.equals(product._id)); // Check if product ID is in applicableProducts
                const isCategoryEligible = offer.applicableCategories.some(id => id.equals(product.categoryId?._id)); 
        
                if (isOfferActive && (isProductEligible || isCategoryEligible)) {
                    const calculatedDiscountedPrice = product.price - (product.price * (offer.discount / 100));
        
                    // Update maxDiscountedPrice if a better discount is found
                    if (calculatedDiscountedPrice < maxDiscountedPrice) {
                        maxDiscountedPrice = calculatedDiscountedPrice;
                        hasDiscount = true;
                    }
                }
            });
        
            return {
                ...product.toObject(),
                discountedPrice: maxDiscountedPrice, 
                hasDiscount 
            };
        });
        
        // Fetch distinct active categories
        const categories = await Category.find({ isActive: true });

        // Fetch wishlist status
        const wishlistStatus = await Wishlist.find({ userId });
       

        // Render the page and pass categories, products with offers, and wishlist status to the view
        res.render('user/home', { 
            products: productsWithOffers, 
            userId, 
            categories, 
            wallet, 
            wishlistStatus: wishlistStatus.map(status => status.productId.toString()) 
        });
    } catch (error) {
        console.error('Error fetching home page data:', error);
        req.flash('error', 'An unexpected error occurred while loading the home page.');
        res.redirect('/error');
        
    }
    
};




//landing page

const getLand = async (req, res) => {
    try {
        const ref = req.query.ref || '';
        const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  
        const categories = await Category.find({ isActive: true });  
        
        res.render('user/landing', {ref, product });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");   
    }
}



const renderLoginPage = (req, res) => {
    res.render('user/login', { error: "", message: "" });
}

const logout = (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log('Error destroying session:', err);
                return res.redirect('/?error=Logout failed');
            }
            return res.redirect('/login');
        });
    } catch (error) {
        console.log("Error in logout process:", error);
        return res.redirect('/?error=Something went wrong');
    }
};



// Controller to get wishlist items
const getWishlistItems = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const limit = 20; // Number of items per page
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const listItems = await Wishlist.find({ userId })
            .populate({
                path: 'productId',
                select: '_id title images price'
            })
            .sort({ $natural: -1 }) // Sort by most recent additions
            .skip(skip)
            .limit(limit);
        const wishlistItems=listItems.filter(item => item.productId !== null);
        const totalItems = await Wishlist.countDocuments({ userId });

        res.render('user/wishlist', {
            wishlistItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            hasNextPage: page < Math.ceil(totalItems / limit)
        });
    } catch (error) {
        console.error('Error fetching wishlist items:', error);
        req.flash('error', 'Failed to load wishlist items.');
        res.redirect('/error');
    }
};



const addBooksWishlist = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const productId = req.params.id;

        const existingWishlistItem = await Wishlist.findOne({ userId, productId });

        if (existingWishlistItem) {
            return res.json({ success: false, message: 'Product already in wishlist' });
        }

        const newWishlistItem = new Wishlist({
            userId,
            productId
        });

        await newWishlistItem.save();

        const wishlistStatus = await Wishlist.find({ userId }).select('_id productId').lean();

        res.json({
            success: true,
            message: 'Product added to wishlist',
            wishlistStatus
        });
    } catch (error) {
        console.error('Error adding product to wishlist:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
};


const removeWishlist = async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user.id;
        await Wishlist.findOneAndDelete({ userId, productId });
        
        res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        res.redirect('/error'); 
    }
};

const getWallet = async (req, res) => {
    try {
            
        const userId = req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            return res.render('user/wallet', { 
                wallet: null, 
                message: 'Wallet not found',
                currentPage: 1,
                totalPages: 1
            });
        }

        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        const paginatedTransactions = wallet.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
            .slice(skip, skip + limit);

        // Create a new wallet object with paginated transactions
        const paginatedWallet = {
            ...wallet.toObject(),
            transactions: paginatedTransactions
        };

        res.render('user/wallet', { 
            wallet: paginatedWallet,
            currentPage: page,
            totalPages,
            totalTransactions
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const getWalletBalence=async(req,res)=>{
    try {
         const userId = req.session.user.id;
        const wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            return res.status(404).json({ balance: 0 ,message: "Wallet not found"});
        }

        res.json({success: true,wallet, balance: wallet.balance });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).send('Internal server error');
    }
}



module.exports = {
    userSignup,
    userLogin,
    getHome,
    getLand,
    googleLogin,
    verifyOtp,
    resendOtp,
    verifyOtpPage,
    renderSignupPage,
    renderLoginPage,
    logout,
    getWishlistItems,
    addBooksWishlist,
    removeWishlist,
    getWallet,
    getWalletBalence, 
   
}