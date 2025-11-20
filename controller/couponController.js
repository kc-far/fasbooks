
const Coupon = require('../models/couponModel');
const Order = require("../models/orderModel");

//--------------------admin side-----------------------
const setEndOfDay = (dateString) => {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
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
        coupon.validUntil =setEndOfDay(validUntil) //new Date(validUntil);

        const now = new Date();
        if (coupon.validFrom <= now && coupon.validUntil >= now && coupon.usageLimit > 0) {
            coupon.isActive = true;
        } else {
            coupon.isActive = false;
        }
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

//--------------user side------------------------

const validateCoupon = async (req, res) => {
    const { couponCode, subtotal } = req.body;
    const userId = req.session.user?.id;
    try {
        const coupon = await Coupon.findOne({ 
            code: couponCode, 
            isActive: true ,
            usageLimit: { $gt: 0 },
            $or: [{ userId: userId }, { userId: null }],});

        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon' });
        }

        const currentDate = new Date();
        if (currentDate < coupon.validFrom || currentDate > coupon.validUntil) {
            return res.status(400).json({ message: 'Coupon is not valid at this time' });
        }

        if (subtotal < coupon.minOrderValue) {
            return res.status(400).json({ message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}` });
        }

        if (coupon.isFirstOrder) {
            const orderCount = await Order.countDocuments({ userId });
            if (orderCount > 0) {
                return res.status(400).json({ message: 'Coupon valid only for your first order' });
            }
        }

        // Calculate discount
        let discount = (subtotal * coupon.discount) / 100;
        if (coupon.maxDiscountLimit && discount > coupon.maxDiscountLimit) {
            discount = coupon.maxDiscountLimit;
        }
      

        let discountedTotal=subtotal-discount
        discountedTotal=Math.round(discountedTotal)

        // coupon.usageLimit -= 1;
        // if (coupon.usageLimit <= 0) {
        //     coupon.isActive = false;
        // }
        // await coupon.save();

        res.json({ discountedTotal, discount, message: 'Coupon applied successfully' });
    } catch (error) {
        console.error('Error validating coupon:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
const getAvailableCoupons = async (req, res) => {
  const userId = req.session.user?.id;
  
    try {
      const currentDate = new Date();
      const orderCount = await Order.countDocuments({ userId });

        const coupons = await Coupon.find({ isActive: true,
          usageLimit: { $gt: 0 },
          validFrom: { $lte: currentDate },
          validUntil: { $gte: currentDate },
          $or: [{ userId: userId }, { userId: null }],
          
         });

        if (!coupons || coupons.length === 0) {
            return res.status(404).json({ message: 'No coupons available' });
        }

        const availableCoupons = coupons.map(coupon => ({
            code: coupon.code,
            description: `${coupon.discount}% OFF - Min Order ₹${coupon.minOrderValue} `,                       
             minOrderValue: coupon.minOrderValue,
             isFirstOrder: coupon.isFirstOrder,
            userId: coupon.userId ? coupon.userId : null
        }));
        

        res.json({ coupons: availableCoupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports={
    getCoupons,
    getCreateCoupon,
    createCoupon,
    getEditCoupon,
    updateCoupon,
    deactivateCoupon,

    validateCoupon,
    getAvailableCoupons,
}