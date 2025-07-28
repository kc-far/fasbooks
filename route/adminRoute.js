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

router.get('/report',adminAuth.adminAuth,adminController.getDeliveredSalesReport)
router.route('/downloadSalesReport')
  .get(adminAuth.adminAuth,adminController.downloadSalesReport)
  .post(adminAuth.adminAuth,adminController.downloadSalesReport);
router.post('/filterSalesReport',adminAuth.adminAuth,adminController.filterSalesReport)
router.post('/acceptReturn/:orderId',adminAuth.adminAuth, adminController.acceptReturn);
router.post('/rejectReturn/:orderId', adminAuth.adminAuth,adminController.rejectReturn);


module.exports = router