const Address = require('../models/addressModel')
const User = require("../models/userModel")

const getAddress=async(req,res)=>{
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
    res.render("user/profileAddress", {
      user,
      addresses,
      firstAddress,
      activeTab: 'address'
    });
    
  } catch (error) {
    console.error("Error loading profile:", error);
    //res.render("user/home", { message: "Server error" });
    res.status(500).send("Error loading profile");
  }
};


//add address
const addAddress = async (req, res) => {
  try {
    
    const {
      name,
      phone,
      pincode,
      locality,
      city,
      state,
      address,
      landmark,
      alternatePhone,
    } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.render("user/profileAddress", { message: "Unauthorized" });
    }

    // Find the user's address document or create a new one if it doesn't exist
    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({
        userId,
        addresses: [],
      });
    }

    // Append the new address
    userAddress.addresses.push({
      name,
      phone,
      pincode,
      locality,
      city,
      state,
      address,
      landmark,
      alternatePhone,
    });

    // Save the document
    await userAddress.save();

    res.redirect("/profileAddress?section=addressBook");
  } catch (error) {
    console.error("Error adding address:", error);
    res.redirect("/profileAddress?section=addressBook&error=true");
  }
};

//edit address
const editAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.render("user/profileAddress", { message: "Unauthorized" });
    }

    const {
      name,
      address,
      locality,
      city,
      state,
      pincode,
      phone,
      alternatePhone,
      landmark,
    } = req.body;

    // Use MongoDB's `$set` operator to update the specific address in the array
    const updatedUser = await Address.findOneAndUpdate(
      { userId, "addresses._id": addressId },
      {
        $set: {
          "addresses.$.name": name,
          "addresses.$.address": address,
          "addresses.$.locality": locality,
          "addresses.$.city": city,
          "addresses.$.state": state,
          "addresses.$.pincode": pincode,
          "addresses.$.phone": phone,
          "addresses.$.alternatePhone": alternatePhone,
          "addresses.$.landmark": landmark,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send("Address not found or user unauthorized");
    }

    res.redirect("/profileAddress?section=addressBook");
  } catch (error) {
    console.error("Error updating address:", error);
    res.redirect("/profileAddress?section=addressBook&error=true");
  }
};

//delete address
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.session.user?.id;
    if (!userId) {
      return res.render("user/profileAddress", { message: "Unauthorized" });
    }

    //remove the address from the addresses array
    const updatedUser = await Address.findOneAndUpdate(
      { userId },
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).send("Address not found or user unauthorized");
    }

    res.redirect("/profileAddress?section=addressBook");
  } catch (error) {
    console.error("Error deleting address:", error);
    res.redirect("/profileAddress?section=addressBook&error=true");
  }
};


module.exports={
    getAddress,
    addAddress,
    editAddress,
    deleteAddress,
}