const User=require('../../models/userModel')
// const isLogin = (req, res, next) => {
//   if (req.session.user) {
//     return res.redirect('/home');
//   } else {
//     next();
//   }
// }



const checkSession = async (req, res, next) => {
  if (req.session.user) {
      const user = await User.findById(req.session.user._id);

      if (user && user.isBlocked) {
        return res.render('user/login', { error: 'Your account is blocked.' }); 
       
      }
      return next();
  }
  res.redirect('/login');
};

const isLogin = async(req, res, next) => {
   if (req.session.user && req.path === '/signup' && req.query.ref) {
        return next();
    }
  // Prevent infinite loop by allowing access to home and logout pages
  //if ( req.path !== '/home' && req.path !== '/logout') {
  if (req.session.user && !['/login', '/signup', '/verify-otp', '/logout'].includes(req.path)) {
       return res.redirect('/home');
  }
  next();
};

// const isLogin = async (req, res, next) => {
//   try {
//     if (req.session.user && req.path === '/signup' && req.query.ref) {
//       return next();
//     }

//     if (req.session.user) {
//       const user = await User.findById(req.session.user._id);

//       if (user && user.isBlocked) {
//         console.log('BLOCKED USER:', user.email);

//         // Destroy session
//         req.session.destroy((err) => {
//           if (err) console.error('Session destroy error:', err);
//           else console.log('Session destroyed');
//         });

//         // Clear cookie
//         res.clearCookie('connect.sid');

//         // Flash message
//         req.flash('error', 'Your account has been blocked. Please contact support.');

//         // Redirect
//         return res.redirect('/login');
//       }

//       // Redirect logged-in users away from login/signup
//       if (!['/home', '/logout'].includes(req.path)) {
//         return res.redirect('/home');
//       }
//     }

//     next();
//   } catch (err) {
//     console.error('isLogin error:', err);
//     req.flash('error', 'Server error');
//     res.redirect('/login');
//   }
// };

module.exports = { checkSession, isLogin };
