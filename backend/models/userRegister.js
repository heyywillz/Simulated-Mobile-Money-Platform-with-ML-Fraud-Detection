const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Joi = require('joi');
const PasswordComplexity = require('joi-password-complexity');

const complexityOptions = {
  min: 3,
  max: 50,
  numeric: 1,
  symbol: 1,
  lowerCase: 1,
  upperCase: 1,
  requirementCount: 1,
};

function validateRegisterInputs(reqBody) {
  const schema = Joi.object({
    fullName: Joi.string().required(),
    email: Joi.string().email().required(),
    ghanaCard: Joi.string()
      .pattern(/^GHA-\d{9}-\d$/)
      .messages({
        'string.pattern.base':
          'Ghana Card must be in the format GHA-XXXXXXXXX-X',
        'string.empty': 'Ghana Card is required',
        'any.required': 'Ghana Card is required',
      })
      .required(),
    location: Joi.object({
      lat: Joi.number().required(),
      long: Joi.number().required(),
    }),
    device: Joi.string().required(),

    password: PasswordComplexity(complexityOptions),
  });

  return schema.validate(reqBody, { abortEarly: false, allowUnknown: false });
}

function validateUserLogin(reqBody) {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    ghanaCard: Joi.string()
      .pattern(/^GHA-\d{9}-\d$/)
      .messages({
        'string.pattern.base':
          'Ghana Card must be in the format GHA-XXXXXXXXX-X',
        'string.empty': 'Ghana Card is required',
        'any.required': 'Ghana Card is required',
      })
      .required(),
  });

  return schema.validate(reqBody, { allowUnknown: true, abortEarly: false });
}

const userLocation = new mongoose.Schema({
  lat: { type: Number, required: true },
  long: { type: Number, required: true },
});

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, minlength: 3, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      minlength: 10,
      maxlength: 255,
    },
    password: { type: String, required: true, maxlength: 1024 },
    ghanaCard: { type: String, required: true },
    device: { type: String, required: true },
    location: userLocation,
    balance: { type: Number, default: 50000 },
    status: {
      type: String,
      enum: ['active', 'frozen', 'suspended'],
      default: 'active',
    },
    frozenReason: { type: String, default: null },
    frozenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

//authentication token
userSchema.methods.getAuthToken = function () {
  const token = jwt.sign(
    { id: this._id, email: this.email },
    process.env.SECRET_KEY,
  );

  return token;
};

//on-save encrypt password

userSchema.pre('save', async function (doc) {
  if (!this.isModified()) return;

  const salt = await bcrypt.genSalt(10);
  const hashPassword = await bcrypt.hash(this.password, salt);

  console.log('hassPassword', hashPassword);
  this.password = hashPassword;
});

const UserRegister = mongoose.model('UserRegister', userSchema);

module.exports = { UserRegister, validateRegisterInputs, validateUserLogin };
