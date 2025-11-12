const User = require("../models/userModel");
const Book = require('../models/productModel'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path = require('path');
const upload = require('../config/multerConfig');
const mongoose = require("mongoose")
const fs = require('fs');
const Category = require('../models/categoryModel');
const Cart = require('../models/cartModel');
const Offer = require('../models/offerModel')
const Wishlist = require('../models/wishListModel')
//---------------------admin side-----------------

// Add books
const addBooks = async (req, res) => {
    
    try { 
        
        const { title, author, description, price, stock, categoryId } = req.body;
        const images = req.files 

        if (!title || !author || !description || !price || !stock || !categoryId) {
            
            return res.redirect('/admin/products?error=All fields are required');
        }
      
        if (isNaN(price) || Number(price) <= 0) {
            
            return res.redirect('/admin/products?error=Price must be a positive number');
        }
        
        if (isNaN(stock) || Number(stock) < 0) {
          
            return res.redirect('/admin/products?error=Stock must be a non-negative number');
        }
      
        // if (!images || images.length === 0) {
            
        //     return res.redirect('/admin/products?error=No Image Uploaded');
        // }
        if (!images || !Array.isArray(images) || images.length !== 3) {
            return res.status(400).json({ error: 'Exactly 3 images are required.' });
        }
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        
        for (let i = 0; i < images.length; i++) {
            const file = images[i];

             if (!allowedTypes.includes(file.mimetype)) {
               return res.status(400).json({
                    error: `Image ${i + 1}: Only JPG or PNG allowed. Got ${file.mimetype}`
               });
            }
        }

        const existingBook = await Book.findOne({ title }); 
        if (existingBook) {   
            return res.status(409).json({ message: 'Book with this title already exists.' });
        }
        const newBook = new Book({
            title,
            author,
            description,
            price,
            stock,
            images: images.map(img => img.filename),
            categoryId,
        });
        await newBook.save();
        res.redirect('/admin/products?message=Book Added');
        
    } catch (error) {    
        console.error('Error adding book:', error);
        res.redirect('/admin/products?error=Error Adding Book');
    }
};
      
const getBooks = async (req, res) => {
    try {
        const { message, error, search, page = 1, limit = 5 } = req.query;
        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);
        const skip = (parsedPage - 1) * parsedLimit;

        //for search
        const filter = {};
        if (search) {
            const regex = new RegExp(search, 'i');
            const categories = await Category.find({ name: regex }).select('_id');
            const categoryIds = categories.map(cat => cat._id);

            filter.$or = [
                { title: regex },
                { author: regex },
                { categoryId: { $in: categoryIds } }
            ];
        }

        // Fetch books with filter and pagination
        const books = await Book.find(filter)
            .populate({
                path: 'categoryId',
                select: 'name'
            })
            .skip(skip)
            .limit(parsedLimit)
            .sort({ createdAt: -1 });
    
        const totalBooks = await Book.countDocuments(filter);
        const totalPages = Math.ceil(totalBooks / parsedLimit);

        res.render('admin/products', {
            books,
            message,
            error,
            search, 
            currentPage: parsedPage,
            totalPages,
            limit: parsedLimit,
            categories: await Category.find({ isActive: true }) //active categories while adding
        });
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).send('Error fetching books');
    }
};
const editBooks = async (req, res) => {
  try {
    
    const { id, title, author, description, price, stock } = req.body;

    const book = await Book.findById(id);
    if (!book) {
      return res.redirect('/admin/products?error=Book Not Found');  
    }

    // Update basic fields
    book.title = title || book.title;
    book.author = author || book.author;
    book.description = description || book.description;
    book.price = price || book.price;
    book.stock = stock || book.stock;

    const images=[]
    if(req.files && req.files.length>0){
        for(i=0;i<req.files.length;i++){
            images.push(req.files[i].filename)
        }
    }
    if(images.length>0){
        book.images.push(...images)
    }
    await book.save();
   
    res.redirect('/admin/products?message=Book Updated');
  } catch (error) {
    console.error('Error updating book:', error);
    res.redirect('/admin/products?error=Error updating book');
  }
};

const deleteImage= async (req, res) => {
    const { bookId, index } = req.body;
    try {
        const book = await Book.findById(bookId);
        if (!book || index < 0 || index >= book.images.length) {
            return res.json({ success: false, error: 'Invalid book or image index' });
        }
        book.images.splice(index, 1); 
        await book.save();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error: 'Server error' });
    }
};
    
//soft delete book
const deleteBook = async (req, res) => {
    
    try {
        const { bookId } = req.body;
        if (!bookId) {
          return res.render(  
            "admin/products?error=Book ID is required"
          );
        }
        await Book.findByIdAndUpdate(bookId, { isActive: false });
        res.redirect(
          "/admin/products?message=Category deleted successfully"
        );
      } catch (error) {
        console.error("Error deleting book:", error);
        res.render("admin/products?error=Error deleting book");
      }
};

const activeBook=async (req,res)=>{
     try {
         const { bookId } = req.body;
         if (!bookId) {
           return res.status(400).send("Book ID is required");
         }
         await Book.findByIdAndUpdate(bookId, { isActive: true });
         res.redirect(
           "/admin/products?message=Book activated successfully"
         );
       } catch (error) {
         console.error("Error activating book:", error);
         res.status(500).send("Server Error");
       }
}

//----------------------userSide-----------------------

//product page
const getProducts = async (req, res) => {
    try {
        const { sort, category, search, page = 1 } = req.query;
        const filter = { isActive: true }; 
        const limit = 6;
        const skip = (page - 1) * limit;
        const userId = req.session.user.id; 

        const cart = await Cart.findOne({ userId: userId }, { items: 1 });
        const itemCount = cart ? cart.items.length : 0;       
            if (category && category !== 'all') {
                filter.categoryId = category; // Ensure category field matches schema
            }

        if (search) {
            filter.title = new RegExp(search, 'i'); // Case-insensitive search on title
        }

        let sortCriteria = {};
        switch (sort) {
            case 'price-low-high':
                sortCriteria.price = 1;
                break;
            case 'price-high-low':
                sortCriteria.price = -1;
                break;
            case 'average-ratings':
                sortCriteria.averageRating = -1;
                break;
            case 'new-arrivals':
                sortCriteria.createdAt = -1;
                break;
            case 'a-z':
                sortCriteria.title = 1;
                break;
            case 'z-a':
                sortCriteria.title = -1;
                break;
            case 'in-stock':
                filter.stock = { $gt: 0 };
                break;
        }

        const offers = await Offer.find({ isActive: true });

        const [products, totalProducts] = await Promise.all([
            Book.find(filter).sort(sortCriteria).skip(skip).limit(limit).populate('categoryId', 'name'),
            Book.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);
        const currentDate = new Date();
        const productsWithOffers = products.map(product => {
            let maxDiscountedPrice = product.price; // Start with the original price
            let hasDiscount = false;

            offers.forEach(offer => {
                const isOfferActive = !offer.validUntil || offer.validUntil > currentDate; // Check if the offer is still valid
                const isProductEligible = offer.applicableProducts.some(id => id.equals(product._id)); // Check if product ID is in applicableProducts
                const isCategoryEligible = offer.applicableCategories.some(id => id.equals(product.categoryId?._id)); // Check if category ID is in applicableCategories

                if (isOfferActive && (isProductEligible || isCategoryEligible)) {
                    const calculatedDiscountedPrice = product.price - (product.price * (offer.discount / 100));

                    if (calculatedDiscountedPrice < maxDiscountedPrice) {
                        maxDiscountedPrice = calculatedDiscountedPrice;
                        hasDiscount = true;
                    }
                }
            });

            return {
                ...product.toObject(),
                discountedPrice: maxDiscountedPrice, // Final discounted price (if applicable)
                hasDiscount 
            };
        });

        
        if (req.xhr) {
            return res.json({
                products: productsWithOffers,
                totalPages,
                currentPage: Number(page)
            });
        }
        const wishlistStatus = await Wishlist.find({ userId });
        res.render('user/products', {
            products: productsWithOffers, // Pass updated products with discount info
            categories: await Category.find({ isActive: true }),
            currentPage: page,
            totalPages,
            sort,
            category,
            search,
            itemCount,
            wishlistStatus: wishlistStatus.map(status => status.productId.toString())
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send("Error fetching products");
    }
};

//product details
const getProductDetail = async (req, res) => {
    
    try {
        const userId = req.session.user?.id;
        const productId = req.params.id; 
        
        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).render('404', { message: "Bad request: Invalid product ID" });
        }

        const product = await Book.findOne({ _id: productId, isActive: true }).populate('categoryId');
        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' });
        }

        const offers = await Offer.find({ isActive: true });

        let discountedPrice = null;

        offers.forEach(offer => {
            const isProductEligible = offer.applicableProducts.includes(product._id);
            const isCategoryEligible = offer.applicableCategories.includes(product.categoryId?.name);

            if (isProductEligible || isCategoryEligible) {
                discountedPrice = product.price - (product.price * (offer.discount / 100));
            }
        });

        const productWithOffer = {
            ...product.toObject(),
            discountedPrice: discountedPrice || product.price,
            hasDiscount: !!discountedPrice
        };
        const products = await Book.find({ categoryId:product.categoryId._id,
                       _id:{$ne:productId}, isActive: true });
       
        const wishlistStatus = await Wishlist.find({ userId });
        res.render('user/product-detail', { 
            product: productWithOffer, 
            products ,
            wishlistStatus: wishlistStatus.map(status => status.productId.toString())
        });

    } catch (error) {
        console.error(error);
        res.status(500).render('404', { message: 'Server error' });
    }
    
};

module.exports={
 addBooks,
    getBooks,
    editBooks,
    deleteImage,
    deleteBook,
    activeBook,

    getProducts,
    getProductDetail,
}