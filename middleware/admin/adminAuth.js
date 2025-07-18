const adminAuth=(req,res,next)=>{
    if(req.session.admin ){
       return next()
    }
    res.redirect('/admin')
    
}

const isLogin=(req,res,next)=>{
    if(req.session.admin){
       return res.redirect('/admin/home')
    }
    next()
}

module.exports  = {adminAuth,isLogin}