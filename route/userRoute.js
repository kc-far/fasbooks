const express = require('express');
const passport = require('passport'); 
const router = express.Router();
const userController = require('../controller/userController');
const cartController = require('../controller/cartController')
const orderController = require('../controller/orderController');
const productController=require('../controller/productController');
const couponController=require('../controller/couponController');
const addressController=require('../controller/addressController');
const profileController=require('../controller/profileController')
const otherController=require('../controller/otherController')
const userAuth = require("../middleware/user/userAuth");
const nocache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };

// Public Pages
router.get('/',userAuth.isLogin,userController.getLand);
router.get('/about', otherController.aboutPage);
router.get('/contact', otherController.contactPage);

// Authentication Routes
router.get('/login', userAuth.isLogin, userController.renderLoginPage);
router.get('/signup', userAuth.isLogin, userController.renderSignupPage);
router.post('/login',userAuth.isLogin, userController.userLogin);
router.post('/signup', userController.userSignup);
router.post('/logout', userController.logout);

// OTP Verification
router.get('/verify-otp', userAuth.isLogin, userController.verifyOtpPage);
router.post('/verify-otp', userAuth.isLogin, userController.verifyOtp);
router.post('/resend-otp', userAuth.isLogin, userController.resendOtp);

// Forgot Password
router.get('/forgot-password', userController.forgotPasswordPage);
router.post('/forgot-password', userController.forgotPassword);
router.get('/verify-otp-forgot', userController.verifyOtpPass);
router.post('/verify-otp-forgot', userController.verifyForgotPasswordOtp);
router.get('/reset-password', userController.resetPasswordPage);
router.post('/reset-password', userController.resetPassword);

// home
router.get('/home', userAuth.checkSession, userController.getHome);

// Profile 
router.get('/profilePersonal', userAuth.checkSession, profileController.getProfile);
router.post('/editProfile',userAuth.checkSession,  profileController.editProfile);
router.get('/profileOrders', userAuth.checkSession, profileController.getOrders)
router.get('/orderDetails/:orderId',userAuth.checkSession,profileController.orderDetails)
router.get('/referral-link', userAuth.checkSession,profileController.getReferralLink);

// Address
router.get('/profileAddress',userAuth.checkSession,addressController.getAddress)
router.post('/addAddress', userAuth.checkSession, addressController.addAddress);
router.post('/editAddress/:addressId', userAuth.checkSession, addressController.editAddress);
router.post('/deleteAddress/:addressId', userAuth.checkSession,addressController.deleteAddress);

//Products
router.get('/products', userAuth.checkSession, productController.getProducts);
router.get('/product-detail/:id',userAuth.checkSession, productController.getProductDetail);

//cart
router.get('/cart', userAuth.checkSession, cartController.getCart);
router.post('/cart/add/:productId', userAuth.checkSession, cartController.addToCart);
router.post('/removeFromCart', userAuth.checkSession, cartController.removeFromCart);
router.patch('/updateCart/:productId', userAuth.checkSession, cartController.updateCart);
router.post('/addtocart/wishlist',userAuth.checkSession, cartController.addToCartFromWishlist)

//wishlist
router.get('/wishlist',userAuth.checkSession,userController.getWishlistItems) 
router.post('/wishlistAdd/:id',userAuth.checkSession,userController.addBooksWishlist)    
router.post('/wishlist/remove/:id',userAuth.checkSession, userController.removeWishlist)

// Checkout
router.post('/checkout', userAuth.checkSession, orderController.processCheckout);
router.get('/checkout', userAuth.checkSession, orderController.getCartItems);
router.post('/addNewAddress', userAuth.checkSession, orderController.addNewAddress);

router.post('/validateCoupon',userAuth.checkSession,couponController.validateCoupon)
router.get('/getAvailableCoupons',userAuth.checkSession,couponController.getAvailableCoupons)
 // Payment
 //router.post('/checkoutCOD', userAuth.checkSession, orderController.placeCODOrder);
router.post('/verify-razorpay-payment',userAuth.checkSession, orderController.verifyPayment);
router.get('/failed',userAuth.checkSession,orderController.paymentFailed)
router.get('/order-details/:orderId',userAuth.checkSession,orderController.retryPayment);

//Order
router.get('/orderSuccess', userAuth.checkSession, orderController.orderSuccess);
router.get('/orderFailed', userAuth.checkSession, orderController.orderFailed);
router.post('/ordersCancel/:orderId', userAuth.checkSession, orderController.cancelOrder);
router.post('/orders/:orderId/cancel/:productId',userAuth.checkSession,orderController.cancelItem)
router.post('/ordersReturn/:orderId/:productId', userAuth.checkSession, orderController.returnItem);

router.get('/orders/:orderId/invoice',userAuth.checkSession,otherController.getInvoice)

//wallet
router.get('/wallet',userAuth.checkSession, userController.getWallet)
router.get('/walletBalance',userAuth.checkSession,userController.getWalletBalence)


// Google Authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=Authentication failed' }), userController.googleLogin);

module.exports = router;