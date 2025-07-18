const mongoose = require("mongoose")

//db connection

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI,{})
    console.log("MongoDb Connected")
  } catch(error) {
    console.log("fail to connect db")
    console.log(error);
  }
}

module.exports = connectDb