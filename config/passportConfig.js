const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userModel"); // Adjust the path as necessary

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            return done(new Error("User not found"));
        }
        done(null, user);
    } catch (error) {
        console.error("Error deserializing user:", error);
        done(error);
    }
});

const CALLBACK_URL = process.env.NODE_ENV === 'production' //-------------------------------------------------------
    'http://localhost:3000/auth/google/callback';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
            return done(null, existingUser);
        }

        const existingEmailUser = await User.findOne({ email: profile.emails[0].value });

        if (existingEmailUser) {
            // You could handle merging accounts here if necessary
            return done(null, existingEmailUser); 
        }

        const newUser = await new User({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            password:profile.id
        }).save();

        done(null, newUser);
    } catch (err) {
        console.error(err);
        done(err, null);
    }

    
}));

