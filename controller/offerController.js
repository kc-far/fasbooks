const Book = require('../models/productModel'); 
const Offer=require('../models/offerModel')
const Category = require('../models/categoryModel');

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

module.exports={
    getOffers,
    getCreateOffer,
    createOffer,
    getEditOffer,
    editOffer,
    deactivateOffer,
}