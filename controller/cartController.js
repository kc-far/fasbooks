const User = require("../models/userModel")
const router = require("../route/adminRoute")
const Cart = require("../models/cartModel")
const bcrypt = require('bcrypt')
const mongoose = require("mongoose")
const Book = require('../models/productModel');
const Address = require('../models/addressModel')
const axios = require('axios');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const sendOtpToEmail = require('../config/sendOtpToEmail');
const Wishlist = require('../models/wishListModel')
//const Offer = require('../models/offerModel')

const addToCart = async (req, res) => {
    const { productId } = req.params;
    const userId = req.session.user.id;
    

    try {
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const product = await Book.findById(productId);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        let currentQuantityInCart = 0;
        if (existingItemIndex >= 0) {
            currentQuantityInCart = cart.items[existingItemIndex].quantity;
        }

        const requestedQuantity = currentQuantityInCart + 1;
        if (requestedQuantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Stock of this is Limited`
            });
        }

        if (requestedQuantity > 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum quantity is 5'
            })
        }

        if (existingItemIndex >= 0) {
            if (currentQuantityInCart < product.stock) {
                cart.items[existingItemIndex].quantity += 1;
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock - currentQuantityInCart} more items can be added to the cart`
                });
            }
        } else {
            cart.items.push({ productId: product._id, quantity: 1 });
        }

        await cart.save();
    // Remove product from wishlist after adding to cart
    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });
    }

        // Respond with JSON (not render or redirect)
        res.json({ success: true, message: 'Product added to cart successfully!' });

    } catch (error) {
        
        res.status(500).json({ success: false, message: 'Error adding to cart' });
        console.error(error)

    }
};
    

const getCart = async (req, res) => {
    const userId = req.session.user?.id;

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            return res.render('user/cart', { items: [] ,errorMessage:null});
        }

        const items = cart.items.map(item => {
            return {
                productId: item.productId._id,
                name: item.productId.title,
                imageUrl: item.productId.images[0], 
                price: item.productId.price,
                quantity: item.quantity,
                total: item.productId.price * item.quantity 
            };
        })
        res.render('user/cart', { items,errorMessage:null });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error fetching cart');
    }
};
//remove from cart
const removeFromCart = async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.user?.id; 

  try {
    
    // Find the user's cart
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // Find the index of the product in the cart
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );
  

    if (itemIndex >= 0) {
      cart.items.splice(itemIndex, 1);
     
      if (cart.items.length === 0) {
        await Cart.deleteOne({ userId });
      } else {
        await cart.save();
      }
      
      return res
        .status(200)
        .json({ success: true, message: "Item removed from cart" });
       
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }
   
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error removing item from cart" });
  }
};

//update cart
const updateCart = async (req, res) => {
  const { productId } = req.params;
  const { action } = req.body;
  const userId = req.session.user.id;

  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(
      (item) => item.productId._id.toString() === productId
    );
    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found in cart" });
    }

    const product = cart.items[itemIndex].productId;

    if (action === "decrease") {
      if (cart.items[itemIndex].quantity <= 1) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot decrease quantity below 1",
          });
      }
      cart.items[itemIndex].quantity -= 1;
    } else if (action === "increase") {
      if (cart.items[itemIndex].quantity >= product.stock) {
        return res.status(400).json({
          success: false,
          message: "You cannot add more than the available stock.",
          stock: product.stock,
        });
      }else if(cart.items[itemIndex].quantity >= 5){
        return res.status(400).json({
          success: false,
          message: "Your limit reached",
        });
      }
      cart.items[itemIndex].quantity += 1;
    } else if (action === "decrease") {
      if (cart.items[itemIndex].quantity <= 1) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity -= 1;
      }
    }

    if (cart.items[itemIndex].quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    }

    await cart.save();

    const cartTotal = cart.items.reduce((total, item) => {
      return total + item.quantity * item.productId.price;
    }, 0);

    res.json({
      success: true,
      quantity: cart.items[itemIndex] ? cart.items[itemIndex].quantity : 0,
      cartTotal,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error updating cart" });
  }
};

const addToCartFromWishlist = async (req, res) => {
    

    try {
        const { productId } = req.body;
        const userId = req.session.user.id;
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const product = await Book.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the product is already in the cart
        const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        let currentQuantityInCart = existingItemIndex >= 0 ? cart.items[existingItemIndex].quantity : 0;

        // Verify stock availability
        if (currentQuantityInCart + 1 > product.stock) {
            return res.status(400).json({ 
                success: false, 
                message: `Only ${product.stock - currentQuantityInCart} more items can be added to the cart`
            });
        }

        // Update quantity if the product is already in the cart, else add as a new item
        if (existingItemIndex >= 0) {
            cart.items[existingItemIndex].quantity += 1;
        } else {
            cart.items.push({ productId: product._id, quantity: 1 });
        }

        // Save updated cart
        await cart.save();

        // Remove the product from the wishlist after adding it to the cart
        await Wishlist.findOneAndDelete({ userId, productId });


        // Redirect to the wishlist page or send a success response
        res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error moving item to cart' });
    }
};

module.exports = {
    addToCart,
    getCart,
    removeFromCart,
    updateCart,
    addToCartFromWishlist,
}