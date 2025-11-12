const express = require('express')
const router = express.Router()
const adminController = require('../controller/adminController')
const categoryController=require('../controller/categoryController')
const productController=require('../controller/productController');
const couponController=require('../controller/couponController');
const offerController=require('../controller/offerController')
const reportController=require('../controller/reportController')
const multer = require('multer');
const sharp = require('sharp');
const upload = require('../config/multerConfig');
const adminAuth = require('../middleware/admin/adminAuth')

//login route
router.get('/', adminAuth.isLogin, adminController.login)
router.post('/',adminController.postLogin)
// 
router.get('/home',adminAuth.adminAuth, adminController.renderDashboard);
router.get('/dashboard-data',adminAuth.adminAuth, adminController.getDashboardData);
//
router.get('/users',adminAuth.adminAuth,adminController.adminUsers)
router.post('/blockUser',adminAuth.adminAuth,adminController.blockUser);
router.post('/unblockUser',adminAuth.adminAuth, adminController.unblockUser)
//category management
router.get('/category',adminAuth.adminAuth,categoryController.categoryManagement)
router.post('/addCategory',adminAuth.adminAuth, categoryController.addCategory)
router.get('/createCategory', categoryController.createCategory)
router.post('/deleteCategory',categoryController.deleteCategory)
router.post('/activeCategory',categoryController.activeCategory)
router.get('/editCategory/:id',adminAuth.adminAuth,categoryController.loadEditCategory)
router.post('/editCategory/:id',adminAuth.adminAuth,categoryController.editCategory)

router.post('/logout', (req, res) => {
    req.session.destroy()   
    return res.redirect('admin/login'); 
});
//product management
router.post('/addBooks', upload.array('images', 3), productController.addBooks);
router.get('/products',adminAuth.adminAuth, productController.getBooks);
router.post('/editBooks',adminAuth.adminAuth, upload.array('images', 12), productController.editBooks);
router.post('/deleteBook',adminAuth.adminAuth,productController.deleteBook)
router.post('/remove-image',adminAuth.adminAuth,productController.deleteImage)
router.post('/activeBook',adminAuth.adminAuth,productController.activeBook)

//
router.get('/orders',adminAuth.adminAuth,adminController.getOrders)
router.post('/orders/:id/status',adminAuth.adminAuth, adminController.orderStatus);
router.get('/returnOrders',adminAuth.adminAuth,adminController.getReturnOrders)
router.post('/acceptReturn/:orderId',adminAuth.adminAuth, adminController.acceptReturn);
router.post('/rejectReturn/:orderId', adminAuth.adminAuth,adminController.rejectReturn);

//coupon management
router.get('/coupons',adminAuth.adminAuth,couponController.getCoupons);
router.get('/getCreateCoupon',adminAuth.adminAuth,couponController.getCreateCoupon)
router.post('/create-coupon',adminAuth.adminAuth, couponController.createCoupon);
router.get('/editCoupon/:id',adminAuth.adminAuth, couponController.getEditCoupon);
router.post('/editCoupon/:id',adminAuth.adminAuth, couponController.updateCoupon);
router.post('/deleteCoupon/:id',adminAuth.adminAuth,couponController.deactivateCoupon);

//offer management
router.get('/offer-management',adminAuth.adminAuth,offerController.getOffers)
router.get('/getCreateOffer',adminAuth.adminAuth,offerController.getCreateOffer)
router.post('/createOffer',adminAuth.adminAuth,offerController.createOffer)
router.get('/editOffer/:offerId',adminAuth.adminAuth,offerController.getEditOffer)
router.post('/updateOffer/:offerId',adminAuth.adminAuth,offerController.editOffer)
router.post('/toggleOfferStatus/:offerId',adminAuth.adminAuth,offerController.deactivateOffer)

router.get('/report', adminAuth.adminAuth, reportController.renderSalesReport);
router.post('/getSalesReport',adminAuth.adminAuth,reportController.getSalesReport);
router.get('/downloadSalesReport/excel',adminAuth.adminAuth, reportController.downloadExcel);
router.get('/downloadSalesReport/pdf',adminAuth.adminAuth, reportController.downloadPdf);


module.exports = router