const mongoose = require("mongoose");
const Category = require("../models/categoryModel");
const Book =require('../models/productModel')

//category management
const categoryManagement = async (req, res) => {
  try {
    const { message, error  } = req.query;
     const page = parseInt(req.query.page) || 1; 
        const limit = 5; 
        const skip = (page - 1) * limit; 


        let search="";
        if(req.query.search){
            search=req.query.search;
        }

        const totalCategories=await Category.countDocuments({name: { $regex: search, $options: 'i' }})
        const categories=await Category.find({name: { $regex: search, $options: 'i' }})
                                       .skip(skip)
                                       .limit(limit)
                                       .sort({$natural:-1 });
        
        const totalPages = Math.ceil(totalCategories / limit); 
        res.render('admin/category', {
            categories,
            currentPage: page,   
            totalPages: totalPages ,
            search,
            message,
            error
        });
   

    // const categories = await Category.find().sort({createdAt:-1});
    // res.render("admin/category", { categories, message, error });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

//load create category
const createCategory = async (req, res) => {
  try {
    res.render("admin/createCategory",{error:null});
    // res.render("admin/createCategory", {
    //   error: req.query.error || null,  // Accept error via query param if exists
    //   message: req.query.message || null
    // });
    
  } catch (error) {
    console.log(error);
  }
};

 //add category page
 const addCategory = async (req, res) => {
  try {
      const { name } = req.body;

      // Input validation
      const trimmedName = name?.trim();
      if (!trimmedName) {
          return res.status(400).json({
              message: "Category name cannot be empty or only spaces."
          });
      }

      // Case-insensitive duplicate check
      const existing = await Category.findOne({
          name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      });
      
      if (existing) {
          return res.status(400).json({
              message: "Category with this name already exists"
          });
      }

      // Name validation
      const validNamePattern = /^[A-Za-z\s]{3,15}$/;
      if (!validNamePattern.test(trimmedName)) {
          return res.status(400).json({
              message: "Invalid category name,Please enter a valide category"
          });
      }
      if (/(.)\1\1/.test(trimmedName)) {
          return res.status(400).json({
            message: "Too many repeating characters (e.g., aaa, xxxx not allowed)"
          });
      }

      // Create category
      const newCategory = new Category({ name: trimmedName });
      await newCategory.save();
      res.status(200).json({success:true, message: "Category Added" })

  } catch (error) {
      console.error("Error adding category:", error);
      return res.status(500).json({
          message: "An error occurred while processing your request"
      });
  }
};


///load edit category
const loadEditCategory = async (req, res) => {
  try {
    const { message, error } = req.query;
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect(
        "/admin/category?error=Invalid category ID."
      );
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.redirect("/admin/category?error=Category not found");
    }

    res.render("admin/editCategory", { category, message, error });
  } catch (error) {
    console.error("Error loading edit category page:", error);
    res.redirect(
      "/admin/category?error=Server error while loading category."
    );
  }
};

//edit category
const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
       return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const trimmedName = name?.trim();

    //check format
     const validNamePattern = /^[A-Za-z\s]{3,15}$/;
      if (!validNamePattern.test(trimmedName)) {
          return res.status(400).json({
              message: "Invalid category name,Please enter a valide category"
          })
      }
    //check for reapeated characters
      if (/(.)\1\1/.test(trimmedName)) {
          return res.status(400).json({
            message: "Too many repeating characters (e.g., aaa, xxxx not allowed)"
          });
      }
    
    const duplicateCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
      _id: { $ne: id },
    });
    // Check for duplicates
    if (duplicateCategory) {
      return res.status(400).json({ success: false, message: "Category name already exists" }); 
    }

    await Category.findByIdAndUpdate(id, { name: trimmedName }, { new: true });

    res.status(200).json({success:true, message: "Category Updated" })
  } catch (error) {
    console.error("Error updating category:", error);
    res.redirect(
      `/admin/editCategory/${req.params.id}?error=Server error while updating category.`
    );
  }
};

//delete category
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      return res.render(  
        "admin/category?error=Category ID is required"
      );
    }
    await Category.findByIdAndUpdate(categoryId, { isActive: false });
    await Book.updateMany({ categoryId, isActive: true }, { isActive: false });
    res.redirect(
      "/admin/category?message=Category deleted successfully"
    );
  } catch (error) {
    console.error("Error deleting category:", error);
    res.render("admin/category?error=Error deleting category");
  }
};

//active category
const activeCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).send("Category ID is required");
    }
    await Category.findByIdAndUpdate(categoryId, { isActive: true });
    await Book.updateMany({ categoryId, isActive: false }, { isActive: true });
    
    res.redirect(
      "/admin/category?message=Category activated successfully"
    );
  } catch (error) {
    console.error("Error activating category:", error);
    res.status(500).send("Server Error");
  }
};

//--------------------------------------------------  admin side end ----------------------------------------------------

module.exports = {
  //admin side

  categoryManagement,
  addCategory,
  createCategory,
  loadEditCategory,
  editCategory,
  deleteCategory,
  activeCategory,

  //userside
};
