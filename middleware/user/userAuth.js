// const checkSession = (req, res, next) => {
//   if (req.session.user) {
//     return next();
//   } else {
//     res.redirect('/login');
//   }
// };

// const isLogin = (req, res, next) => {
//   if (req.session.user) {
//     return res.redirect('/home');
//   } else {
//     next();
//   }
// }

// module.exports = { checkSession, isLogin };

const checkSession = (req, res, next) => {
  if (req.session.user) {
      return next();
  }
  res.redirect('/login');
};

const isLogin = (req, res, next) => {
  // Prevent infinite loop by allowing access to home and logout pages
  if (req.session.user && req.path !== '/home' && req.path !== '/logout') {
      return res.redirect('/home');
  }
  next();
};

module.exports = { checkSession, isLogin };
