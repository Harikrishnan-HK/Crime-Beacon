const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");




const crimeDetailsSchema = new mongoose.Schema({
    title: String,
    description: String,
    imageLink: String,
    personPhone: Number,
    personName: String,
    date: Date,
    location: String,
    status: String,
    userId: String,
    comments: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
          required: true,
        },
        userName: String,
        commentText: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lwComments:String,
  });
  
  // Add the addComment method to the schema
  crimeDetailsSchema.methods.addComment = async function (
    userId,
    userName,
    commentText
  ) {
    this.comments.push({ userId, userName, commentText });
    await this.save();
  };
  
  // Create the crimeDetails model using the schema
  const crimeDetails = mongoose.model("crime", crimeDetailsSchema);
  
  
  module.exports = crimeDetails;
  