const bcrpyt = require('bcrypt');
const _ = require('lodash');
const express = require('express');
const {
  validateRegisterInputs,
  UserRegister,
  validateUserLogin,
} = require('../models/userRegister');
const { Router } = express;

const jsonwebtoken = require('jsonwebtoken');
const { authUser } = require('../auth/authUser');

const userRegisterRoutes = Router();

userRegisterRoutes.post('/', async (req, res) => {
  const { error } = validateRegisterInputs(req.body);

  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // finding user existence
    const { email } = req.body;
    const user = await UserRegister.findOne({ email });

    if (user) return res.status(400).json({ message: 'user already registered' });

    //create a new user
    const newUser = new UserRegister(
      _.pick(req.body, [
        'fullName',
        'email',
        'password',
        'ghanaCard',
        'device',
        'location',
      ]),
    );

    const token = newUser.getAuthToken();

    const cookiesOption = {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('jwt', token, cookiesOption);

    const new_user = await newUser.save();
    return res.status(200).json({
      ...new_user.toObject(),
      token,
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ message: error.message || 'Database error occurred' });
  }
});

userRegisterRoutes.post('/login', async (req, res) => {
  const { error } = validateUserLogin(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    //email check
    const { email, password, ghanaCard } = req.body;
    const user = await UserRegister.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: 'email , Password, or ghanacard not valid' });

    const isSamePassword = await bcrpyt.compare(password, user.password);

    if (!isSamePassword)
      return res
        .status(404)
        .json({ message: 'email , Password, or ghanacard not valid' });

    if (ghanaCard !== user.ghanaCard)
      return res
        .status(404)
        .json({ message: 'email , Password, or ghanacard not valid' });

    // set the token
    const token = user.getAuthToken();
    const cookiesOption = {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
    res.cookie('jwt', token, cookiesOption);

    return res.status(200).json({
      message: 'successfully login',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        ghanaCard: user.ghanaCard,
        device: user.device,
        location: user.location,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: error.message || 'Database error occurred' });
  }
});

userRegisterRoutes.get('/user', [authUser], async (req, res) => {
  console.log('user started');
  const { id } = req.user;
  console.log('user started', id);
  try {
    const user = await UserRegister.findById(id);
    console.log('user started final', user);

    return res.status(200).json(user);
  } catch (error) {
    console.log(error?.message);
    return;
  }
});

module.exports = userRegisterRoutes;
