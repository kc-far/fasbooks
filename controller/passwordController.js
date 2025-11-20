const User = require("../models/userModel")
const bcrypt = require('bcrypt')
const sendOtpToEmail = require('../config/sendOtpToEmail');
// Send OTP for Forgot Password
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.render('user/forgotPassword', { error: 'User not found!' });
    }

    const otp = Math.floor(100000 + Math.random() * 90000 ).toString();
    req.session.forgotPasswordOtp = otp;
    req.session.otpExpires = new Date(Date.now() + 60 * 1000); // OTP valid for 1 minute
    req.session.userEmail = email; 

    console.log(`OTP sent to ${email}: ${otp}`);
    await sendOtpToEmail(email, otp);
    return res.render('user/verifyForgotPasswordOtp',{email:user.email}); // Redirect to verify OTP page
};


// Verify OTP for Forgot Password
const verifyForgotPasswordOtp = async (req, res) => {
    const { otp } = req.body;
    console.log('getted otp',otp)
    if (!req.session.forgotPasswordOtp || new Date() > req.session.otpExpires) {
        return res.render('user/verifyForgotPasswordOtp', { error: 'OTP is invalid or has expired.', email: req.session.resetEmail });
    }

    if (otp !== req.session.forgotPasswordOtp) {
        return res.render('user/verifyForgotPasswordOtp', { error: 'Invalid OTP. Please try again.', email: req.session.resetEmail });
    }
    res.render('user/resetPassword');
};
//resend otp for forgot password
const resendForgotPasswordOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.forgotPasswordOtp = otp;
    req.session.otpExpires = Date.now() + 30 * 1000; // 5 minutes
    req.session.resetEmail = email;

    await sendOtpToEmail(email, otp); // your email function
    console.log('resendeted otp',otp)

    return res.json({ success: true, message: 'New OTP sent successfully!' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};
// Reset Password
const resetPassword = async (req, res) => {
    const { newPassword } = req.body;
    const email = req.session.userEmail;
    console.log(`password ${newPassword} and email is ${email}`)
    if (!email) {
        return res.render('user/login', { error: 'Invalid request. Please try again.',message:"" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    delete req.session.forgotPasswordOtp;
    delete req.session.otpExpires;
    delete req.session.resetEmail;

    res.render('user/login', { error: null, message: 'Password reset successful. You can now log in.' });
};


const forgotPasswordPage = (req, res) => {
    res.render('user/forgotPassword', { error: null });
};


const verifyOtpPass = (req, res) => {
    const email = req.session.userEmail || null; // Retrieve the email from the session
    res.render('user/verifyForgotPasswordOtp', { error: null, email });
};

const resetPasswordPage = (req, res) => {
    res.render('user/resetPassword', { error: null });
};


module.exports={
    forgotPassword,
    resetPassword,
    verifyForgotPasswordOtp,
    resendForgotPasswordOtp,
    forgotPasswordPage,
    verifyOtpPass,
    resetPasswordPage,
}