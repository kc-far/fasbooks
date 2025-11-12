const User = require("../models/userModel")
const Address = require('../models/addressModel')
const Order = require('../models/orderModel');
const bcrypt = require('bcrypt')

//profile page
const getProfile = async (req, res) => {
  try {
    // Get user session details
    const { email } = req.session.user;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch the user's address document
    const addressDocument = await Address.findOne({ userId: user._id });

    const addresses = addressDocument ? addressDocument.addresses : [];

    const firstAddress = addresses.length > 0 ? addresses[0] : [];

    //order details
    const orders = await Order.find({ userId: user._id })
      .populate("items.productId", "title images")
      .sort({ createdAt: -1 });
     
    //referralLink
    const referralLink = await User.generateReferralLink(user._id);


    // Pass user and addresses to the EJS template
    res.render("user/profilePersonal", {
      user,
      addresses,
      orders,
      firstAddress,
      referralLink
    });
    
  } catch (error) {
    console.error("Error loading profile:", error);
    //res.render("user/home", { message: "Server error" });
    res.status(500).send("Error loading profile");
  }
};

const editProfile = async (req, res) => {
  try {
    const { name, email, currentPassword,newPassword } = req.body;
    const userId = req.session.user?.id;
    const user=await User.findById(userId)
    if (!user) {
      return res 
        .status(401)
        .json( { success: false, error: 'User not found' });
    }
    const isMatch=await bcrypt.compare(currentPassword , user.password)
    if(currentPassword && !isMatch){
        return res.status(400).json({ success: false, error: 'Invalid current password' })
    }  
    if(email !==user.email){
        const userExist=await User.findOne({email})
        if(userExist){
            return res.status(400).json({ success: false, error: 'Email already in use' })
        }
    }
    user.name=name;
    user.email=email;
    if(newPassword){
        user.password=newPassword
    }
    await user.save()

    req.session.user = {
    id: user._id,
    name: user.name,
    email: user.email
    };
    return res.json({ success: true, message: "Profile updated successfully" });  
  } catch (error) {
    console.error("Error updating profile:", error);
     res.status(500).json({success:false,error:'Internal Server Error'});
  }
};
//get orders
const getOrders = async (req, res) => {
    try {
        const userId = req.session.user.id;
         const { email } = req.session.user;
         const user = await User.findOne({ email });
        const page = parseInt(req.query.page) || 1; 
        const limit = 3; 
        const search = req.query.search || '';

        const query = search ? { $or: [
            { OrderId: { $regex: search, $options: 'i' } },
            { status: { $regex: search, $options: 'i' } }
        ] }: {};
        // Query to get total number of orders
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);
         
        // Fetch orders for the current page with pagination and populate product details
        const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('items.productId');

        res.render('user/profileOrders', {
            orders,
            user,
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};
//order details
const orderDetails=async(req,res)=>{
    try{
        const { email } = req.session.user;
        const user = await User.findOne({ email });
        const orderId = req.params.orderId  
        const order = await Order.findById(orderId).populate('items.productId',"title images")
            
        if(!order){
            return res.status(404).send('order not found')
        } 
        res.render('user/orderDetails',{
           user,
           order,
        })
    }catch(err){
     console.error(err);
    }
}
//referral link
const getReferralLink=async (req,res)=>{
    try {
        const user= await User.findById(req.user.id)
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const referralLink = `${baseUrl}/register?ref=${user.referralCode}`;
        res.json({ success: true, referralLink });
    } catch (error) {
        console.error('Error generating referral link:', error);
        res.status(500).json({ success: false, message: 'Error generating referral link.' });
    }
}

module.exports={
    getProfile,
    getOrders,
    orderDetails,
    editProfile,
    getReferralLink,
}