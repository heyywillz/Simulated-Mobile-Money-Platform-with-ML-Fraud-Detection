const jwt = require('jsonwebtoken');

function authUser(req, res, next) {
  console.log('jwt check');
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  const token = req.cookies?.jwt || req.headers['jwt'] || bearerToken;
  console.log('jwt token:', token);
  if (!token)
    return res.status(400).json({
      message: 'Unauthorise user register an account before making a deposit',
    });

  console.log('token pass ');

  try {
    const decode = jwt.decode(token);
    console.log('token', decode);
    req.user = decode;
    next();
  } catch (error) {
    console.log('error', error);
    return res.status(400).json({ message: error?.message || error });
  }
}

module.exports = { authUser };
