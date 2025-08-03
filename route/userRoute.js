const express = require('express');
const passport = require('passport'); 
const router = express.Router();
const userController = require('../controller/userController');
const cartController = require('../controller/cartController')
const orderController = require('../controller/orderController');
//const checkoutController = require('../controller/checkoutController')
const userAuth = require("../middleware/user/userAuth");
const nocache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };

// Public Pages
router.get('/', userController.getLand);
router.get('/about', userController.aboutPage);
router.get('/contact', userController.contactPage);

// Authentication Routes
router.get('/login', userAuth.isLogin, userController.renderLoginPage);
router.get('/signup', userAuth.isLogin, userController.renderSignupPage);
router.post('/login', userController.userLogin);
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
router.get('/profilePersonal', userAuth.checkSession, userController.getProfile);
router.post('/editProfile',userAuth.checkSession,  userController.editProfile);
router.get('/profileOrders', userAuth.checkSession, userController.getOrders)
// Address
router.post('/addAddress', userAuth.checkSession, userController.addAddress);
router.post('/editAddress/:addressId', userAuth.checkSession, userController.editAddress);
router.post('/deleteAddress/:addressId', userAuth.checkSession, userController.deleteAddress);

// Products
router.get('/products', userAuth.checkSession, userController.getProducts);
router.get('/product-detail/:id', userController.getProductDetail);

//cart
router.get('/cart', userAuth.checkSession, cartController.getCart);
router.post('/cart/add/:productId', userAuth.checkSession, cartController.addToCart);
router.post('/removeFromCart', userAuth.checkSession, cartController.removeFromCart);
router.post('/updateCart/:productId', userAuth.checkSession, cartController.updateCart);
router.post('/addtocart/wishlist',userAuth.checkSession, cartController.addToCartFromWishlist)

//wishlist
router.get('/wishlist',userAuth.checkSession,userController.getWishlistItems) 
router.post('/wishlistAdd/:id',userAuth.checkSession,userController.addBooksWishlist)    
router.post('/wishlist/remove/:id',userAuth.checkSession, userController.removeWishlist)

// Checkout
//router.post('/checkout', userAuth.checkSession, orderController.processCheckout);
router.get('/checkout', userAuth.checkSession, orderController.renderCheckout);
router.post('/addNewAddress', userAuth.checkSession, orderController.addNewAddress);

 // Payment
 router.post('/checkoutCOD', userAuth.checkSession, orderController.placeCODOrder);

//Order
router.get('/orderSuccess', userAuth.checkSession, orderController.orderSuccess);
router.get('/orderFailed', userAuth.checkSession, orderController.orderFailed);
router.post('/ordersCancel/:orderId', userAuth.checkSession, orderController.cancelOrder);
router.post('/ordersReturn/:orderId', userAuth.checkSession, orderController.returnOrder);

router.get('/orders/:orderId/invoice',userAuth.checkSession,orderController.getInvoice)


// Google Authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=Authentication failed' }), userController.googleLogin);

module.exports = router;