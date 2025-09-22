const express = require('express')
const router = express.Router()
const adminController = require('../controller/adminController')
const categoryController=require('../controller/categoryController')
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
router.post('/addBooks', upload.array('images', 3), adminController.addBooks);
router.get('/products',adminAuth.adminAuth, adminController.getBooks);
router.post('/editBooks',adminAuth.adminAuth, upload.array('images', 12), adminController.editBooks);
router.post('/deleteBook',adminController.deleteBook)
router.post('/activeBook',adminController.activeBook)

//
router.get('/orders',adminAuth.adminAuth,adminController.getOrders)
router.post('/orders/:id/status',adminAuth.adminAuth, adminController.orderStatus);
router.get('/returnOrders',adminAuth.adminAuth,adminController.getReturnOrders)
router.post('/acceptReturn/:orderId',adminAuth.adminAuth, adminController.acceptReturn);
router.post('/rejectReturn/:orderId', adminAuth.adminAuth,adminController.rejectReturn);

//coupon management
router.get('/coupons',adminAuth.adminAuth,adminController.getCoupons);
router.get('/getCreateCoupon',adminAuth.adminAuth,adminController.getCreateCoupon)
router.post('/create-coupon',adminAuth.adminAuth, adminController.createCoupon);
router.get('/editCoupon/:id',adminAuth.adminAuth, adminController.getEditCoupon);
router.post('/editCoupon/:id',adminAuth.adminAuth, adminController.updateCoupon);
router.post('/deleteCoupon/:id',adminAuth.adminAuth,adminController.deactivateCoupon);

//offer management
router.get('/offer-management',adminAuth.adminAuth,adminController.getOffers)
router.get('/getCreateOffer',adminAuth.adminAuth,adminController.getCreateOffer)
router.post('/createOffer',adminAuth.adminAuth, adminController.createOffer)
router.get('/editOffer/:offerId',adminAuth.adminAuth, adminController.getEditOffer)
router.post('/updateOffer/:offerId',adminAuth.adminAuth, adminController.editOffer)
router.post('/toggleOfferStatus/:offerId',adminAuth.adminAuth, adminController.deactivateOffer)

router.get('/report', adminAuth.adminAuth, adminController.renderSalesReport);
router.post('/getSalesReport',adminAuth.adminAuth,adminController.getSalesReport);
router.get('/downloadSalesReport/excel',adminAuth.adminAuth, adminController.downloadExcel);
router.get('/downloadSalesReport/pdf',adminAuth.adminAuth, adminController.downloadPdf);


module.exports = router