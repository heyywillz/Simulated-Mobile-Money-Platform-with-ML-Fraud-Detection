import { createSlice } from "@reduxjs/toolkit";

const initialState = { user: null, userInput: null }
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    loginUser: (state, action) => {
      state.user = action.payload;
    },
    updateUser: (state, action) => {
      state.userInput = action.payload; 
    }
  }
})

export const { loginUser, updateUser } = userSlice.actions;

export default userSlice.reducer;
